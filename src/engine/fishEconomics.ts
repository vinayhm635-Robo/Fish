import type {
  DynamicPriceSnapshot,
  FishSpecies,
  FreshnessGrade,
  PriceHistoryPoint,
  PricingRule,
} from '../types/domain';

export function calculateFreshnessGrade(
  score: number,
  thresholds = { gradeA: 85, gradeB: 68, gradeC: 48 }
): { grade: FreshnessGrade; label: string; urgency: string } {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= thresholds.gradeA) {
    return {
      grade: 'A',
      label: 'Grade A – Prime Fresh (Demo Threshold)',
      urgency: 'Ideal for direct retail, hotels, and sashimi/premium dining.',
    };
  }
  if (clamped >= thresholds.gradeB) {
    return {
      grade: 'B',
      label: 'Grade B – Good Fresh (Demo Threshold)',
      urgency: 'Best sold within 4–6 hours on crushed ice.',
    };
  }
  if (clamped >= thresholds.gradeC) {
    return {
      grade: 'C',
      label: 'Grade C – Same-Day Sale (Demo Threshold)',
      urgency: 'Apply accelerated pricing; route to processor if unsold soon.',
    };
  }
  return {
    grade: 'Recovery',
    label: 'Recovery Tier – Processor Routing (Demo Threshold)',
    urgency: 'Requires handling/safety inspection before dry-fish or fish-meal processing.',
  };
}

export interface FairPriceInput {
  species: FishSpecies;
  freshnessScore: number;
  quantityKg: number;
  hourOfDay: number;
  demandIndex?: number;
  pricingRule?: PricingRule;
}

export interface FairPriceOutput {
  aiStartingPrice: number;
  recommendedFloor: number;
  marketReferencePrice: number;
  middlemanBaselinePrice: number;
  estimatedTotalStartingInr: number;
  estimatedTotalFloorInr: number;
  upliftOverMiddlemanPct: number;
}

export function calculateFairPriceBand(input: FairPriceInput): FairPriceOutput {
  const { species, freshnessScore, quantityKg, hourOfDay, demandIndex = 1.04, pricingRule } = input;
  const clampedScore = Math.max(20, Math.min(100, freshnessScore));
  const marketRef = species.defaultMarketRatePerKg;
  const middlemanBase = species.middlemanRatePerKg;

  // Freshness factor: 90+ gets a freshness premium, lower scores scale down proportionally
  const premiumPct = pricingRule?.freshnessPremiumPct ?? 8;
  const freshnessFactor =
    clampedScore >= 85
      ? 1 + ((clampedScore - 80) / 20) * (premiumPct / 100)
      : 0.72 + (clampedScore / 85) * 0.28;

  // Time-of-day factor (early morning Mangalore harbor landing peak 5am-10am)
  const timeFactor = hourOfDay >= 5 && hourOfDay <= 10 ? 1.03 : hourOfDay >= 17 ? 0.94 : 0.98;

  // Bulk quantity mild adjustment (>50kg gets slight volume competitiveness)
  const bulkFactor = quantityKg >= 60 ? 0.97 : quantityKg >= 30 ? 0.99 : 1.0;

  const ruleDemand = pricingRule?.baseDemandMultiplier ?? 1.0;
  const rawStart = marketRef * freshnessFactor * timeFactor * bulkFactor * demandIndex * ruleDemand;
  const aiStartingPrice = Math.max(Math.round(rawStart / 5) * 5, middlemanBase + 20);

  // Floor preserves fisherman margin well above middleman while allowing competitive negotiation
  const maxFloorDiscount = (pricingRule?.maxFloorDiscountPct ?? 16) / 100;
  const rawFloor = aiStartingPrice * (1 - maxFloorDiscount);
  const recommendedFloor = Math.max(
    Math.round(rawFloor / 5) * 5,
    Math.round((middlemanBase * 1.12) / 5) * 5
  );

  const safeQty = Math.max(1, quantityKg);
  const upliftOverMiddlemanPct = Math.round(((aiStartingPrice - middlemanBase) / middlemanBase) * 100);

  return {
    aiStartingPrice,
    recommendedFloor: Math.min(recommendedFloor, aiStartingPrice - 10),
    marketReferencePrice: marketRef,
    middlemanBaselinePrice: middlemanBase,
    estimatedTotalStartingInr: aiStartingPrice * safeQty,
    estimatedTotalFloorInr: Math.min(recommendedFloor, aiStartingPrice - 10) * safeQty,
    upliftOverMiddlemanPct,
  };
}

export interface DynamicPriceInput {
  startingPrice: number;
  minFloor: number;
  initialFreshnessScore: number;
  catchTimestampMs: number;
  nowMs: number;
  storageTempC: number;
  speciesDecayRatePerHourPct: number;
  maxFreshWindowHours: number;
}

export function calculateDynamicPrice(input: DynamicPriceInput): DynamicPriceSnapshot {
  const {
    startingPrice,
    minFloor,
    initialFreshnessScore,
    catchTimestampMs,
    nowMs,
    storageTempC,
    speciesDecayRatePerHourPct,
    maxFreshWindowHours,
  } = input;

  const elapsedHours = Math.max(0, (nowMs - catchTimestampMs) / (1000 * 60 * 60));

  // Storage temperature multiplier (ESP32 or simulated sensor)
  let tempMultiplier = 1.0;
  let storageConditionLabel = 'Standard Ice Box';
  if (storageTempC <= 2.5) {
    tempMultiplier = 0.65;
    storageConditionLabel = `Optimal Ice Slurry (${storageTempC.toFixed(1)}°C)`;
  } else if (storageTempC <= 5.0) {
    tempMultiplier = 1.0;
    storageConditionLabel = `Chilled Ice Box (${storageTempC.toFixed(1)}°C)`;
  } else {
    tempMultiplier = 1.45;
    storageConditionLabel = `Warm Alert (${storageTempC.toFixed(1)}°C) · Accelerated Decay`;
  }

  // Freshness decay curve over elapsed time
  const effectiveDecayPerHour = speciesDecayRatePerHourPct * tempMultiplier;
  const freshnessLoss = elapsedHours * (effectiveDecayPerHour * 1.35);
  const effectiveFreshnessScore = Math.max(25, Math.round(initialFreshnessScore - freshnessLoss));

  // Price decays smoothly inside [minFloor, startingPrice], weighted by freshness & elapsed window
  const windowFraction = Math.min(1.2, elapsedHours / Math.max(1, maxFreshWindowHours));
  const rawDecayPct = Math.min(0.35, (elapsedHours * effectiveDecayPerHour) / 100);
  const targetPrice = startingPrice * (1 - rawDecayPct);
  const clampedPrice = Math.max(minFloor, Math.min(startingPrice, Math.round(targetPrice / 5) * 5));

  const priceReduction = Math.max(0, startingPrice - clampedPrice);
  const priceReductionPct = startingPrice > 0 ? Math.round((priceReduction / startingPrice) * 100) : 0;

  // Next ₹5/kg step drop calculation
  const stepIntervalMinutes = Math.max(15, Math.round((60 / Math.max(1, effectiveDecayPerHour)) * 2.5));
  const elapsedMinutes = Math.round(elapsedHours * 60);
  const nextDropInMinutes = Math.max(5, stepIntervalMinutes - (elapsedMinutes % stepIntervalMinutes));
  const nextDropPrice = Math.max(minFloor, clampedPrice - 5);

  const remainingWindowMinutes = Math.max(0, Math.round((maxFreshWindowHours - elapsedHours) * 60));
  const shouldRouteToProcessor = remainingWindowMinutes <= 0 || effectiveFreshnessScore < 48 || windowFraction >= 1.0;

  // Build 8-point price-decay curve from catch time across the selling window
  const priceCurve: PriceHistoryPoint[] = [];
  const totalCurveHours = Math.max(6, Math.round(maxFreshWindowHours));
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const h = Math.round((totalCurveHours / steps) * i * 10) / 10;
    const decayPctAtH = Math.min(0.35, (h * effectiveDecayPerHour) / 100);
    const pAtH = Math.max(minFloor, Math.round((startingPrice * (1 - decayPctAtH)) / 5) * 5);
    const fAtH = Math.max(25, Math.round(initialFreshnessScore - h * effectiveDecayPerHour * 1.35));
    priceCurve.push({
      hourOffset: h,
      label: h === 0 ? 'Catch' : `+${h}h`,
      pricePerKg: pAtH,
      projectedFreshness: fAtH,
    });
  }

  return {
    currentPrice: clampedPrice,
    originalPrice: startingPrice,
    priceReduction,
    priceReductionPct,
    nextDropInMinutes,
    nextDropPrice,
    remainingWindowMinutes,
    effectiveFreshnessScore,
    shouldRouteToProcessor,
    storageConditionLabel,
    priceCurve,
  };
}

export interface NegotiationEvaluationInput {
  buyerOfferPrice: number;
  requestedKg: number;
  availableKg: number;
  currentPrice: number;
  minAcceptablePrice: number;
  remainingWindowMinutes: number;
  buyerCompletedOrdersCount: number;
}

export interface NegotiationEvaluationResult {
  decision: 'accept' | 'counter' | 'reject';
  counterPrice: number;
  finalPrice?: number;
  reasonCode:
    | 'INVALID_QUANTITY'
    | 'ABOVE_OR_AT_CURRENT'
    | 'WITHIN_ACCEPTABLE_BAND'
    | 'CLOSE_TO_FLOOR_COUNTER'
    | 'BELOW_FLOOR_COUNTER';
}

export function evaluateNegotiationOffer(
  input: NegotiationEvaluationInput
): NegotiationEvaluationResult {
  const {
    buyerOfferPrice,
    requestedKg,
    availableKg,
    currentPrice,
    minAcceptablePrice,
    remainingWindowMinutes,
    buyerCompletedOrdersCount,
  } = input;

  if (requestedKg <= 0 || requestedKg > availableKg) {
    return {
      decision: 'reject',
      counterPrice: currentPrice,
      reasonCode: 'INVALID_QUANTITY',
    };
  }

  const safeOffer = Math.round(buyerOfferPrice);
  const floor = Math.min(minAcceptablePrice, currentPrice);

  // If buyer meets or exceeds current dynamic price, immediate acceptance
  if (safeOffer >= currentPrice) {
    return {
      decision: 'accept',
      counterPrice: safeOffer,
      finalPrice: safeOffer,
      reasonCode: 'ABOVE_OR_AT_CURRENT',
    };
  }

  // Loyalty & bulk volume flexibility inside the permitted band [floor, currentPrice]
  const isBulk = requestedKg >= 20;
  const isLoyal = buyerCompletedOrdersCount >= 3;
  const isUrgentWindow = remainingWindowMinutes <= 120;

  // Dynamic acceptance threshold inside [floor, currentPrice] (never below floor!)
  let concessionRatio = 0.45;
  if (isBulk) concessionRatio += 0.2;
  if (isLoyal) concessionRatio += 0.15;
  if (isUrgentWindow) concessionRatio += 0.2;
  concessionRatio = Math.min(1.0, concessionRatio);

  const autoAcceptThreshold = Math.max(
    floor,
    Math.round((currentPrice - (currentPrice - floor) * concessionRatio) / 5) * 5
  );

  if (safeOffer >= autoAcceptThreshold && safeOffer >= floor) {
    return {
      decision: 'accept',
      counterPrice: safeOffer,
      finalPrice: safeOffer,
      reasonCode: 'WITHIN_ACCEPTABLE_BAND',
    };
  }

  // Offer is inside [floor, autoAcceptThreshold) -> counter slightly closer to floor
  if (safeOffer >= floor) {
    const midpoint = Math.max(
      floor,
      Math.round(((safeOffer + autoAcceptThreshold) / 2) / 5) * 5
    );
    return {
      decision: 'counter',
      counterPrice: midpoint,
      reasonCode: 'CLOSE_TO_FLOOR_COUNTER',
    };
  }

  // Offer is strictly below hidden fisherman floor -> NEVER accept; counter above/at permitted range without leaking exact floor
  const spread = Math.max(10, currentPrice - floor);
  const safeCounter = Math.max(
    floor + (isBulk ? 5 : 10),
    Math.round((currentPrice - spread * (isBulk ? 0.55 : 0.4)) / 5) * 5
  );
  const clampedCounter = Math.min(currentPrice, Math.max(floor, safeCounter));

  return {
    decision: 'counter',
    counterPrice: clampedCounter,
    reasonCode: 'BELOW_FLOOR_COUNTER',
  };
}

export interface ParsedVoiceListing {
  speciesId: string;
  speciesName: string;
  quantityKg: number;
  catchHoursAgo: number;
  locationName: string;
  expectedMinPrice?: number;
  languageDetected: 'Kannada' | 'Tulu' | 'English' | 'Mixed Coastal';
  confidence: number;
}

const SPECIES_KEYWORDS: Array<{ id: string; name: string; tokens: string[] }> = [
  {
    id: 'sp-mackerel',
    name: 'Indian Mackerel (Bangude)',
    tokens: ['mackerel', 'bangude', 'bangda', 'ಬಂಗುಡೆ', 'ಬಾಂಗುಡೆ'],
  },
  {
    id: 'sp-sardine',
    name: 'Oil Sardine (Bhootai)',
    tokens: ['sardine', 'sardines', 'bhootai', 'boodai', 'buthai', 'ಭೂತಾಯಿ', 'ಬೂದಾಯಿ'],
  },
  {
    id: 'sp-pomfret',
    name: 'Silver Pomfret (Manji)',
    tokens: ['pomfret', 'manji', 'ಮಾಂಜಿ', 'ಪಾಂಫ್ರೆಟ್'],
  },
  {
    id: 'sp-seer',
    name: 'Seer Fish (Anjal)',
    tokens: ['seer', 'kingfish', 'anjal', 'ಅಂಜಲ್'],
  },
  {
    id: 'sp-prawns',
    name: 'Tiger Prawns (Yetti)',
    tokens: ['prawn', 'prawns', 'shrimp', 'yetti', 'shetli', 'ಯೆಟ್ಟಿ', 'ಸೀಗಡಿ'],
  },
  {
    id: 'sp-tuna',
    name: 'Yellowfin Tuna (Kedar)',
    tokens: ['tuna', 'kedar', 'ಕೇದಾರ್', 'ಟ್ಯೂನ'],
  },
  {
    id: 'sp-squid',
    name: 'Indian Squid (Bondas)',
    tokens: ['squid', 'bondas', 'ಕಣವಾಯಿ', 'ಬೋಂಡಾಸ್'],
  },
  {
    id: 'sp-crab',
    name: 'Mud Crab (Denji)',
    tokens: ['crab', 'denji', 'ಏಡಿ', 'ಡೆಂಜಿ'],
  },
];

export function parseVoiceCommandFallback(transcript: string): ParsedVoiceListing {
  const lower = transcript.toLowerCase();

  let matchedSpecies = SPECIES_KEYWORDS[0];
  for (const sp of SPECIES_KEYWORDS) {
    if (sp.tokens.some((t) => lower.includes(t.toLowerCase()) || transcript.includes(t))) {
      matchedSpecies = sp;
      break;
    }
  }

  // Extract quantity in kg (supports digits before kg / kilo / ಕಿಲೋ)
  const qtyMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos|ಕಿಲೋ|ಕೆಜಿ)/i) || lower.match(/\b(\d+)\b/);
  const quantityKg = qtyMatch ? Math.max(1, Math.min(2000, Math.round(Number(qtyMatch[1])))) : 30;

  // Extract catch hours ago
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|ಗಂಟೆ|gante)/i);
  const catchHoursAgo = hourMatch ? Math.max(0.5, Math.min(24, Number(hourMatch[1]))) : 2;

  // Extract optional minimum price (₹ / rs / rupees / rupayi)
  const priceMatch = lower.match(/(?:₹|rs\.?|rupees|rupayi|ರೂಪಾಯಿ|minimum|min)\s*(\d{2,4})/i);
  const expectedMinPrice = priceMatch ? Number(priceMatch[1]) : undefined;

  // Detect Mangalore harbor location
  let locationName = 'Mangalore Bunder Harbor';
  if (lower.includes('malpe') || lower.includes('ಮಲ್ಪೆ')) locationName = 'Malpe Fishing Harbor';
  else if (lower.includes('ullal') || lower.includes('ಉಳ್ಳಾಲ')) locationName = 'Ullal Landing Center';
  else if (lower.includes('panambur') || lower.includes('ಪಣಂಬೂರು')) locationName = 'Panambur Dock';
  else if (lower.includes('surathkal') || lower.includes('ಸುರತ್ಕಲ್')) locationName = 'Surathkal Coast';

  const hasKannadaScript = /[\u0C80-\u0CFF]/.test(transcript);
  const hasTuluWords = /(yetti|boodai|bangude|manji|anjal|gante|denji|bondas)/i.test(lower);
  const languageDetected: ParsedVoiceListing['languageDetected'] = hasKannadaScript
    ? 'Kannada'
    : hasTuluWords
      ? 'Tulu'
      : 'English';

  return {
    speciesId: matchedSpecies.id,
    speciesName: matchedSpecies.name,
    quantityKg,
    catchHoursAgo,
    locationName,
    expectedMinPrice,
    languageDetected,
    confidence: 0.89,
  };
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
