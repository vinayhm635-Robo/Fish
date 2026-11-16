import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDynamicPrice,
  calculateFairPriceBand,
  calculateFreshnessGrade,
  evaluateNegotiationOffer,
  haversineDistanceKm,
  parseVoiceCommandFallback,
} from './fishEconomics';
import type { FishSpecies } from '../types/domain';

const sampleMackerel: FishSpecies = {
  id: 'sp-mackerel',
  name: 'Indian Mackerel (Bangude)',
  localNameKn: 'ಬಂಗುಡೆ',
  localNameTulu: 'Bangude',
  category: 'Mackerel',
  defaultMarketRatePerKg: 240,
  middlemanRatePerKg: 175,
  decayRatePerHourPct: 3.5,
  maxFreshWindowHours: 10,
  suitableProcessors: ['dry_fish', 'fish_meal'],
  defaultImageUrl: '/src/assets/images/fish_indian_mackerel_1794821247535.jpg',
};

test('calculateFreshnessGrade classifies scores into expected demo grades', () => {
  assert.equal(calculateFreshnessGrade(92).grade, 'A');
  assert.equal(calculateFreshnessGrade(75).grade, 'B');
  assert.equal(calculateFreshnessGrade(55).grade, 'C');
  assert.equal(calculateFreshnessGrade(38).grade, 'Recovery');
});

test('calculateFairPriceBand produces starting price above floor and middleman rate', () => {
  const band = calculateFairPriceBand({
    species: sampleMackerel,
    freshnessScore: 90,
    quantityKg: 40,
    hourOfDay: 7,
  });

  assert.ok(band.aiStartingPrice > band.recommendedFloor);
  assert.ok(band.recommendedFloor > sampleMackerel.middlemanRatePerKg);
  assert.ok(band.upliftOverMiddlemanPct > 20);
});

test('calculateDynamicPrice decays faster in warm storage than iced storage and respects floor', () => {
  const now = Date.now();
  const fourHoursAgo = now - 4 * 60 * 60 * 1000;

  const iced = calculateDynamicPrice({
    startingPrice: 250,
    minFloor: 205,
    initialFreshnessScore: 92,
    catchTimestampMs: fourHoursAgo,
    nowMs: now,
    storageTempC: 1.8,
    speciesDecayRatePerHourPct: 3.5,
    maxFreshWindowHours: 10,
  });

  const warm = calculateDynamicPrice({
    startingPrice: 250,
    minFloor: 205,
    initialFreshnessScore: 92,
    catchTimestampMs: fourHoursAgo,
    nowMs: now,
    storageTempC: 8.5,
    speciesDecayRatePerHourPct: 3.5,
    maxFreshWindowHours: 10,
  });

  assert.ok(warm.currentPrice <= iced.currentPrice);
  assert.ok(warm.effectiveFreshnessScore < iced.effectiveFreshnessScore);
  assert.ok(iced.currentPrice >= 205);
  assert.ok(warm.currentPrice >= 205);
  assert.equal(iced.priceCurve.length, 7);
});

test('evaluateNegotiationOffer never accepts below hidden fisherman floor', () => {
  const belowFloor = evaluateNegotiationOffer({
    buyerOfferPrice: 185,
    requestedKg: 25,
    availableKg: 40,
    currentPrice: 235,
    minAcceptablePrice: 210,
    remainingWindowMinutes: 240,
    buyerCompletedOrdersCount: 4,
  });

  assert.equal(belowFloor.decision, 'counter');
  assert.ok(belowFloor.counterPrice >= 210);

  const validOffer = evaluateNegotiationOffer({
    buyerOfferPrice: 220,
    requestedKg: 25,
    availableKg: 40,
    currentPrice: 235,
    minAcceptablePrice: 210,
    remainingWindowMinutes: 240,
    buyerCompletedOrdersCount: 4,
  });

  assert.equal(validOffer.decision, 'accept');
  assert.equal(validOffer.finalPrice, 220);

  const tooMuchQty = evaluateNegotiationOffer({
    buyerOfferPrice: 240,
    requestedKg: 80,
    availableKg: 40,
    currentPrice: 235,
    minAcceptablePrice: 210,
    remainingWindowMinutes: 240,
    buyerCompletedOrdersCount: 1,
  });

  assert.equal(tooMuchQty.decision, 'reject');
  assert.equal(tooMuchQty.reasonCode, 'INVALID_QUANTITY');
});

test('parseVoiceCommandFallback extracts Kannada, Tulu, and English fish listings', () => {
  const kn = parseVoiceCommandFallback('40 kg ಬಂಗುಡೆ ಮೀನು, 2 ಗಂಟೆ ಹಿಂದೆ ಮಲ್ಪೆ ಬಂದರಿನಲ್ಲಿ ಹಿಡಿದಿದ್ದು');
  assert.equal(kn.speciesId, 'sp-mackerel');
  assert.equal(kn.quantityKg, 40);
  assert.equal(kn.catchHoursAgo, 2);
  assert.equal(kn.locationName, 'Malpe Fishing Harbor');
  assert.equal(kn.languageDetected, 'Kannada');

  const tulu = parseVoiceCommandFallback('25 kilo yetti ullal 3 gante');
  assert.equal(tulu.speciesId, 'sp-prawns');
  assert.equal(tulu.quantityKg, 25);
  assert.equal(tulu.catchHoursAgo, 3);
  assert.equal(tulu.locationName, 'Ullal Landing Center');
  assert.equal(tulu.languageDetected, 'Tulu');
});

test('haversineDistanceKm returns realistic distance around Mangalore coast', () => {
  // Bunder Harbor (12.858, 74.832) to Panambur Beach (12.948, 74.801) ~10.5 km
  const dist = haversineDistanceKm(12.858, 74.832, 12.948, 74.801);
  assert.ok(dist > 8 && dist < 13);
});
