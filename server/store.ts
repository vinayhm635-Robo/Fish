import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditLog,
  BuyerProfile,
  Delivery,
  FishermanProfile,
  FishListing,
  FishSpecies,
  FreshnessAssessment,
  Negotiation,
  NotificationItem,
  Offer,
  Order,
  Payment,
  PriceHistoryPoint,
  PricingRule,
  ProcessorProfile,
  ProcessorRequest,
  PublicFishListing,
  TemperatureReading,
  TransactionRecord,
  User,
  UserRole,
} from '../src/types/domain';
import { calculateDynamicPrice, calculateFreshnessGrade } from '../src/engine/fishEconomics';

export interface DatabaseState {
  users: User[];
  fishermanProfiles: FishermanProfile[];
  buyerProfiles: BuyerProfile[];
  processorProfiles: ProcessorProfile[];
  fishSpecies: FishSpecies[];
  fishListings: FishListing[];
  freshnessAssessments: FreshnessAssessment[];
  pricingRules: PricingRule[];
  priceHistory: Array<{ listingId: string; recordedAt: string; point: PriceHistoryPoint }>;
  negotiations: Negotiation[];
  offers: Offer[];
  orders: Order[];
  payments: Payment[];
  deliveries: Delivery[];
  processorRequests: ProcessorRequest[];
  temperatureReadings: TemperatureReading[];
  notifications: NotificationItem[];
  transactions: TransactionRecord[];
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'fishfresh-db.json');

const DISCLAIMER_TEXT =
  'Photograph-based grading is an AI visual estimate using configurable demo thresholds—not a laboratory food-safety certification.';

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function createSeedDatabase(): DatabaseState {
  const nowIso = new Date().toISOString();

  const users: User[] = [
    {
      id: 'usr-fish-1',
      name: 'Ramesh Mogaveera',
      phone: '+91 98451 22410',
      role: 'fisherman',
      verified: true,
      locationName: 'Mangalore Bunder Harbor',
      lat: 12.8582,
      lng: 74.8321,
      createdAt: hoursAgoIso(720),
    },
    {
      id: 'usr-fish-2',
      name: 'Sudhakar Karkera',
      phone: '+91 94481 77319',
      role: 'fisherman',
      verified: true,
      locationName: 'Malpe Fishing Harbor',
      lat: 13.3477,
      lng: 74.7029,
      createdAt: hoursAgoIso(650),
    },
    {
      id: 'usr-buyer-1',
      name: 'Ananya Shetty (Machali Kitchen)',
      phone: '+91 99001 44520',
      role: 'buyer',
      verified: true,
      locationName: 'Hampankatta, Mangalore',
      lat: 12.8698,
      lng: 74.8431,
      createdAt: hoursAgoIso(500),
    },
    {
      id: 'usr-proc-1',
      name: 'Karavali Dry-Fish & Marine Meal',
      phone: '+91 98802 66118',
      role: 'processor',
      verified: true,
      locationName: 'Ullal Processing Zone',
      lat: 12.8065,
      lng: 74.8559,
      createdAt: hoursAgoIso(800),
    },
    {
      id: 'usr-admin-1',
      name: 'Dr. Kavitha Pai (Harbor Ops)',
      phone: '+91 97410 11009',
      role: 'admin',
      verified: true,
      locationName: 'Mangalore Fisheries Command',
      lat: 12.862,
      lng: 74.839,
      createdAt: hoursAgoIso(900),
    },
    {
      id: 'usr-deliv-1',
      name: 'Prashanth Kulal (Cold Van)',
      phone: '+91 96115 88304',
      role: 'delivery',
      verified: true,
      locationName: 'Panambur Cold Hub',
      lat: 12.948,
      lng: 74.801,
      createdAt: hoursAgoIso(400),
    },
  ];

  const fishermanProfiles: FishermanProfile[] = [
    {
      userId: 'usr-fish-1',
      boatName: 'Sea Breeze IV',
      boatRegNo: 'KA-02-MM-4821',
      homeHarbor: 'Mangalore Bunder Harbor',
      preferredLanguage: 'kn',
      upiId: 'ramesh.bunder@okicici',
      rating: 4.9,
    },
    {
      userId: 'usr-fish-2',
      boatName: 'Matsya Deepa',
      boatRegNo: 'KA-20-MM-1934',
      homeHarbor: 'Malpe Fishing Harbor',
      preferredLanguage: 'tulu',
      upiId: 'sudhakar.malpe@oksbi',
      rating: 4.8,
    },
  ];

  const buyerProfiles: BuyerProfile[] = [
    {
      userId: 'usr-buyer-1',
      businessName: 'Machali Coastal Kitchen & Hotel',
      buyerType: 'restaurant',
      gstNumber: '29AABCM4912Q1Z5',
      completedOrdersCount: 14,
    },
  ];

  const processorProfiles: ProcessorProfile[] = [
    {
      userId: 'usr-proc-1',
      facilityName: 'Karavali Marine Recovery Co-op',
      processorType: 'dry_fish',
      dailyCapacityKg: 1200,
      safetyCertified: true,
    },
  ];

  const fishSpecies: FishSpecies[] = [
    {
      id: 'sp-mackerel',
      name: 'Indian Mackerel (Bangude)',
      localNameKn: 'ಬಂಗುಡೆ',
      localNameTulu: 'Bangude',
      category: 'Mackerel',
      defaultMarketRatePerKg: 240,
      middlemanRatePerKg: 175,
      decayRatePerHourPct: 3.4,
      maxFreshWindowHours: 10,
      suitableProcessors: ['dry_fish', 'fish_meal'],
      defaultImageUrl: '/src/assets/images/fish_indian_mackerel_1794821247535.jpg',
    },
    {
      id: 'sp-pomfret',
      name: 'Silver Pomfret (Manji)',
      localNameKn: 'ಮಾಂಜಿ',
      localNameTulu: 'Manji',
      category: 'Pomfret',
      defaultMarketRatePerKg: 760,
      middlemanRatePerKg: 580,
      decayRatePerHourPct: 2.6,
      maxFreshWindowHours: 12,
      suitableProcessors: ['dry_fish'],
      defaultImageUrl: '/src/assets/images/fish_silver_pomfret_1794821248720.jpg',
    },
    {
      id: 'sp-seer',
      name: 'Seer Fish (Anjal)',
      localNameKn: 'ಅಂಜಲ್',
      localNameTulu: 'Anjal',
      category: 'Seer fish',
      defaultMarketRatePerKg: 820,
      middlemanRatePerKg: 620,
      decayRatePerHourPct: 2.5,
      maxFreshWindowHours: 12,
      suitableProcessors: ['dry_fish', 'fish_meal'],
      defaultImageUrl: '/src/assets/images/fish_king_seer_1794821248743.jpg',
    },
    {
      id: 'sp-prawns',
      name: 'Tiger Prawns (Yetti)',
      localNameKn: 'ಸೀಗಡಿ',
      localNameTulu: 'Yetti',
      category: 'Prawns',
      defaultMarketRatePerKg: 540,
      middlemanRatePerKg: 410,
      decayRatePerHourPct: 4.1,
      maxFreshWindowHours: 8,
      suitableProcessors: ['dry_fish', 'animal_feed'],
      defaultImageUrl: '/src/assets/images/fish_tiger_prawns_1794821249259.jpg',
    },
    {
      id: 'sp-sardine',
      name: 'Oil Sardine (Bhootai)',
      localNameKn: 'ಭೂತಾಯಿ',
      localNameTulu: 'Boodai',
      category: 'Sardines',
      defaultMarketRatePerKg: 150,
      middlemanRatePerKg: 95,
      decayRatePerHourPct: 4.5,
      maxFreshWindowHours: 8,
      suitableProcessors: ['fish_meal', 'dry_fish', 'animal_feed'],
      defaultImageUrl: '/src/assets/images/fish_indian_mackerel_1794821247535.jpg',
    },
    {
      id: 'sp-tuna',
      name: 'Yellowfin Tuna (Kedar)',
      localNameKn: 'ಕೇದಾರ್',
      localNameTulu: 'Kedar',
      category: 'Tuna',
      defaultMarketRatePerKg: 320,
      middlemanRatePerKg: 230,
      decayRatePerHourPct: 3.0,
      maxFreshWindowHours: 11,
      suitableProcessors: ['dry_fish', 'fish_meal'],
      defaultImageUrl: '/src/assets/images/fish_king_seer_1794821248743.jpg',
    },
    {
      id: 'sp-squid',
      name: 'Indian Squid (Bondas)',
      localNameKn: 'ಬೋಂಡಾಸ್',
      localNameTulu: 'Bondas',
      category: 'Squid',
      defaultMarketRatePerKg: 360,
      middlemanRatePerKg: 265,
      decayRatePerHourPct: 3.6,
      maxFreshWindowHours: 9,
      suitableProcessors: ['dry_fish', 'animal_feed'],
      defaultImageUrl: '/src/assets/images/fish_tiger_prawns_1794821249259.jpg',
    },
    {
      id: 'sp-crab',
      name: 'Mud Crab (Denji)',
      localNameKn: 'ಏಡಿ',
      localNameTulu: 'Denji',
      category: 'Crab',
      defaultMarketRatePerKg: 480,
      middlemanRatePerKg: 350,
      decayRatePerHourPct: 2.8,
      maxFreshWindowHours: 10,
      suitableProcessors: ['animal_feed'],
      defaultImageUrl: '/src/assets/images/fish_tiger_prawns_1794821249259.jpg',
    },
  ];

  const pricingRules: PricingRule[] = fishSpecies.map((sp) => ({
    speciesId: sp.id,
    baseDemandMultiplier: 1.04,
    maxFloorDiscountPct: 16,
    freshnessPremiumPct: 8,
    processorRecoveryDiscountPct: 58,
    gradeAThreshold: 85,
    gradeBThreshold: 68,
    gradeCThreshold: 48,
    updatedAt: nowIso,
  }));

  const assessments: FreshnessAssessment[] = [
    {
      id: 'asmt-1',
      listingId: 'lst-mackerel-1',
      capturedAt: hoursAgoIso(1.5),
      isLiveCameraCapture: true,
      gpsLat: 12.8582,
      gpsLng: 74.8321,
      imageUrl: '/src/assets/images/fish_indian_mackerel_1794821247535.jpg',
      freshnessScore: 92,
      grade: 'A',
      gradeLabel: 'Grade A – Prime Fresh (Demo Threshold)',
      eyeClarity: 'Crystal clear, convex cornea with bright black pupil',
      gillColor: 'Rich crimson red, moist and clean gill filaments',
      skinSheen: 'Intact metallic blue-green stripes with natural marine sheen',
      observations: [
        'Clear convex eyes with zero cloudiness',
        'Healthy bright crimson gill colour',
        'Firm dorsal muscle bounce and natural skin sheen',
      ],
      handlingUrgency: 'Ideal for direct retail, hotels, and premium dining.',
      confidence: 0.94,
      analysisMode: 'demo-simulated',
      disclaimer: DISCLAIMER_TEXT,
    },
    {
      id: 'asmt-2',
      listingId: 'lst-pomfret-2',
      capturedAt: hoursAgoIso(1.0),
      isLiveCameraCapture: true,
      gpsLat: 12.948,
      gpsLng: 74.801,
      imageUrl: '/src/assets/images/fish_silver_pomfret_1794821248720.jpg',
      freshnessScore: 95,
      grade: 'A',
      gradeLabel: 'Grade A – Prime Fresh (Demo Threshold)',
      eyeClarity: 'Bright transparent eyes, zero sinking',
      gillColor: 'Deep cherry red with crisp lamellae',
      skinSheen: 'Pearlescent silver reflection, firm belly',
      observations: [
        'Bright clear eyes indicating immediate post-landing icing',
        'Firm pearlescent silver skin with zero bruising',
        'Clean neutral marine aroma profile',
      ],
      handlingUrgency: 'Top-grade export & restaurant cut ready.',
      confidence: 0.96,
      analysisMode: 'demo-simulated',
      disclaimer: DISCLAIMER_TEXT,
    },
    {
      id: 'asmt-3',
      listingId: 'lst-seer-3',
      capturedAt: hoursAgoIso(2.5),
      isLiveCameraCapture: true,
      gpsLat: 13.3477,
      gpsLng: 74.7029,
      imageUrl: '/src/assets/images/fish_king_seer_1794821248743.jpg',
      freshnessScore: 87,
      grade: 'A',
      gradeLabel: 'Grade A – Prime Fresh (Demo Threshold)',
      eyeClarity: 'Clear glossy eye surface',
      gillColor: 'Deep red, well-preserved on crushed ice',
      skinSheen: 'Distinct tiger stripes with moist translucent steaks',
      observations: [
        'Clear eyes and firm lateral line',
        'Thick translucent steak cuts without gaping',
        'Stored continuously in chilled ice slurry',
      ],
      handlingUrgency: 'High demand for Mangalore tawa fry & hotel orders.',
      confidence: 0.91,
      analysisMode: 'demo-simulated',
      disclaimer: DISCLAIMER_TEXT,
    },
    {
      id: 'asmt-4',
      listingId: 'lst-prawns-4',
      capturedAt: hoursAgoIso(3.2),
      isLiveCameraCapture: true,
      gpsLat: 12.8065,
      gpsLng: 74.8559,
      imageUrl: '/src/assets/images/fish_tiger_prawns_1794821249259.jpg',
      freshnessScore: 81,
      grade: 'B',
      gradeLabel: 'Grade B – Good Fresh (Demo Threshold)',
      eyeClarity: 'Glossy dark eyes firmly attached',
      gillColor: 'Clean pale gill chamber, no blackening',
      skinSheen: 'Tight translucent banded shell',
      observations: [
        'Firm head-to-tail attachment with zero melanosis',
        'Glossy striped carapace on crushed ice',
        'Recommended sale within next 4 hours',
      ],
      handlingUrgency: 'Best sold within 4–5 hours on crushed ice.',
      confidence: 0.89,
      analysisMode: 'demo-simulated',
      disclaimer: DISCLAIMER_TEXT,
    },
    {
      id: 'asmt-5',
      listingId: 'lst-sardine-5',
      capturedAt: hoursAgoIso(6.5),
      isLiveCameraCapture: true,
      gpsLat: 12.8582,
      gpsLng: 74.8321,
      imageUrl: '/src/assets/images/fish_indian_mackerel_1794821247535.jpg',
      freshnessScore: 61,
      grade: 'C',
      gradeLabel: 'Grade C – Same-Day Sale (Demo Threshold)',
      eyeClarity: 'Slightly cloudy outer lens',
      gillColor: 'Pale pink-brown gill edges',
      skinSheen: 'Reduced surface luster, soft belly',
      observations: [
        'Approaching fresh retail window threshold',
        'Dynamic price decay active to accelerate immediate sale',
        'Auto-routes to dry-fish or fish-meal processor at expiry',
      ],
      handlingUrgency: 'Immediate same-day sale or processor recovery routing.',
      confidence: 0.85,
      analysisMode: 'demo-simulated',
      disclaimer: DISCLAIMER_TEXT,
    },
  ];

  const fishListings: FishListing[] = [
    {
      id: 'lst-mackerel-1',
      fishermanId: 'usr-fish-1',
      fishermanName: 'Ramesh Mogaveera',
      boatName: 'Sea Breeze IV',
      speciesId: 'sp-mackerel',
      speciesName: 'Indian Mackerel (Bangude)',
      localName: 'ಬಂಗುಡೆ / Bangude',
      totalQuantityKg: 45,
      availableQuantityKg: 40,
      catchTimestamp: hoursAgoIso(2),
      listedAt: hoursAgoIso(1.5),
      locationName: 'Mangalore Bunder Harbor',
      lat: 12.8582,
      lng: 74.8321,
      imageUrl: '/src/assets/images/fish_indian_mackerel_1794821247535.jpg',
      isLiveVerifiedCapture: true,
      freshnessScore: 92,
      freshnessGrade: 'A',
      assessmentId: 'asmt-1',
      aiStartingPrice: 255,
      minAcceptablePrice: 210,
      aiRecommendedFloor: 210,
      marketReferencePrice: 240,
      middlemanBaselinePrice: 175,
      storageTempC: 1.8,
      status: 'active',
    },
    {
      id: 'lst-pomfret-2',
      fishermanId: 'usr-fish-1',
      fishermanName: 'Ramesh Mogaveera',
      boatName: 'Sea Breeze IV',
      speciesId: 'sp-pomfret',
      speciesName: 'Silver Pomfret (Manji)',
      localName: 'ಮಾಂಜಿ / Manji',
      totalQuantityKg: 28,
      availableQuantityKg: 24,
      catchTimestamp: hoursAgoIso(1.5),
      listedAt: hoursAgoIso(1.0),
      locationName: 'Panambur Dock',
      lat: 12.948,
      lng: 74.801,
      imageUrl: '/src/assets/images/fish_silver_pomfret_1794821248720.jpg',
      isLiveVerifiedCapture: true,
      freshnessScore: 95,
      freshnessGrade: 'A',
      assessmentId: 'asmt-2',
      aiStartingPrice: 795,
      minAcceptablePrice: 675,
      aiRecommendedFloor: 675,
      marketReferencePrice: 760,
      middlemanBaselinePrice: 580,
      storageTempC: 1.4,
      status: 'active',
    },
    {
      id: 'lst-seer-3',
      fishermanId: 'usr-fish-2',
      fishermanName: 'Sudhakar Karkera',
      boatName: 'Matsya Deepa',
      speciesId: 'sp-seer',
      speciesName: 'Seer Fish (Anjal)',
      localName: 'ಅಂಜಲ್ / Anjal',
      totalQuantityKg: 35,
      availableQuantityKg: 30,
      catchTimestamp: hoursAgoIso(3),
      listedAt: hoursAgoIso(2.5),
      locationName: 'Malpe Fishing Harbor',
      lat: 13.3477,
      lng: 74.7029,
      imageUrl: '/src/assets/images/fish_king_seer_1794821248743.jpg',
      isLiveVerifiedCapture: true,
      freshnessScore: 87,
      freshnessGrade: 'A',
      assessmentId: 'asmt-3',
      aiStartingPrice: 840,
      minAcceptablePrice: 705,
      aiRecommendedFloor: 705,
      marketReferencePrice: 820,
      middlemanBaselinePrice: 620,
      storageTempC: 2.1,
      status: 'active',
    },
    {
      id: 'lst-prawns-4',
      fishermanId: 'usr-fish-2',
      fishermanName: 'Sudhakar Karkera',
      boatName: 'Matsya Deepa',
      speciesId: 'sp-prawns',
      speciesName: 'Tiger Prawns (Yetti)',
      localName: 'ಸೀಗಡಿ / Yetti',
      totalQuantityKg: 22,
      availableQuantityKg: 18,
      catchTimestamp: hoursAgoIso(3.5),
      listedAt: hoursAgoIso(3.2),
      locationName: 'Ullal Landing Center',
      lat: 12.8065,
      lng: 74.8559,
      imageUrl: '/src/assets/images/fish_tiger_prawns_1794821249259.jpg',
      isLiveVerifiedCapture: true,
      freshnessScore: 81,
      freshnessGrade: 'B',
      assessmentId: 'asmt-4',
      aiStartingPrice: 540,
      minAcceptablePrice: 455,
      aiRecommendedFloor: 455,
      marketReferencePrice: 540,
      middlemanBaselinePrice: 410,
      storageTempC: 3.2,
      status: 'active',
    },
    {
      id: 'lst-sardine-5',
      fishermanId: 'usr-fish-1',
      fishermanName: 'Ramesh Mogaveera',
      boatName: 'Sea Breeze IV',
      speciesId: 'sp-sardine',
      speciesName: 'Oil Sardine (Bhootai)',
      localName: 'ಭೂತಾಯಿ / Boodai',
      totalQuantityKg: 60,
      availableQuantityKg: 48,
      catchTimestamp: hoursAgoIso(7),
      listedAt: hoursAgoIso(6.5),
      locationName: 'Mangalore Bunder Harbor',
      lat: 12.8582,
      lng: 74.8321,
      imageUrl: '/src/assets/images/fish_indian_mackerel_1794821247535.jpg',
      isLiveVerifiedCapture: true,
      freshnessScore: 61,
      freshnessGrade: 'C',
      assessmentId: 'asmt-5',
      aiStartingPrice: 145,
      minAcceptablePrice: 115,
      aiRecommendedFloor: 115,
      marketReferencePrice: 150,
      middlemanBaselinePrice: 95,
      storageTempC: 4.8,
      status: 'active',
    },
  ];

  const negotiations: Negotiation[] = [
    {
      id: 'neg-seed-1',
      listingId: 'lst-mackerel-1',
      buyerId: 'usr-buyer-1',
      buyerName: 'Ananya Shetty (Machali Kitchen)',
      requestedKg: 20,
      currentOfferPrice: 225,
      status: 'open',
      updatedAt: hoursAgoIso(0.3),
      messages: [
        {
          id: 'msg-1',
          sender: 'buyer',
          text: 'Looking for 20 kg of Grade A Bangude for lunch service at ₹200/kg.',
          offerPricePerKg: 200,
          quantityKg: 20,
          timestamp: hoursAgoIso(0.4),
        },
        {
          id: 'msg-2',
          sender: 'ai_agent',
          text: 'These Indian Mackerel scored 92/100 (Grade A) at Bunder Harbor just 2h ago. For 20 kg bulk pickup, I can meet you at ₹225/kg.',
          offerPricePerKg: 225,
          quantityKg: 20,
          decision: 'counter',
          aiMode: 'deterministic-fallback',
          timestamp: hoursAgoIso(0.3),
        },
      ],
    },
  ];

  const offers: Offer[] = [
    {
      id: 'off-1',
      listingId: 'lst-mackerel-1',
      negotiationId: 'neg-seed-1',
      buyerId: 'usr-buyer-1',
      buyerName: 'Ananya Shetty (Machali Kitchen)',
      offeredPricePerKg: 200,
      quantityKg: 20,
      status: 'countered',
      createdAt: hoursAgoIso(0.4),
    },
  ];

  const orders: Order[] = [
    {
      id: 'FF-2026-1041',
      listingId: 'lst-pomfret-2',
      speciesName: 'Silver Pomfret (Manji)',
      buyerId: 'usr-buyer-1',
      buyerName: 'Ananya Shetty (Machali Kitchen)',
      fishermanId: 'usr-fish-1',
      fishermanName: 'Ramesh Mogaveera',
      quantityKg: 12,
      agreedPricePerKg: 745,
      totalAmountInr: 8940,
      middlemanSavingsInr: 1980,
      fulfillmentMode: 'dock_pickup',
      pickupLocation: 'Panambur Dock Gate 2',
      status: 'order_completed',
      createdAt: hoursAgoIso(20),
      updatedAt: hoursAgoIso(18),
    },
    {
      id: 'FF-2026-1042',
      listingId: 'lst-seer-3',
      speciesName: 'Seer Fish (Anjal)',
      buyerId: 'usr-buyer-1',
      buyerName: 'Ananya Shetty (Machali Kitchen)',
      fishermanId: 'usr-fish-2',
      fishermanName: 'Sudhakar Karkera',
      quantityKg: 15,
      agreedPricePerKg: 790,
      totalAmountInr: 11850,
      middlemanSavingsInr: 2550,
      fulfillmentMode: 'cold_delivery',
      pickupLocation: 'Malpe Fishing Harbor',
      deliveryAddress: 'Machali Kitchen, Kodialbail, Mangalore',
      status: 'pickup_delivery_in_progress',
      createdAt: hoursAgoIso(3),
      updatedAt: hoursAgoIso(1),
    },
  ];

  const payments: Payment[] = [
    {
      id: 'pay-1041',
      orderId: 'FF-2026-1041',
      method: 'upi_test',
      upiRef: 'DEMO-UPI-8849201',
      amountInr: 8940,
      status: 'test_completed',
      isSimulatedTestPayment: true,
      paidAt: hoursAgoIso(19.5),
    },
    {
      id: 'pay-1042',
      orderId: 'FF-2026-1042',
      method: 'upi_test',
      upiRef: 'DEMO-UPI-8849317',
      amountInr: 11850,
      status: 'test_completed',
      isSimulatedTestPayment: true,
      paidAt: hoursAgoIso(2.5),
    },
  ];

  const deliveries: Delivery[] = [
    {
      id: 'del-1042',
      orderId: 'FF-2026-1042',
      driverName: 'Prashanth Kulal',
      vehicleInfo: 'KA-19-C-4410 · Chilled Insulated Van',
      status: 'in_transit',
      etaMinutes: 22,
      updatedAt: hoursAgoIso(0.2),
    },
  ];

  const processorRequests: ProcessorRequest[] = [
    {
      id: 'proc-req-1',
      listingId: 'lst-past-sardine',
      speciesName: 'Oil Sardine (Bhootai)',
      fishermanId: 'usr-fish-1',
      fishermanName: 'Ramesh Mogaveera',
      locationName: 'Mangalore Bunder Harbor',
      quantityKg: 85,
      recoveryPricePerKg: 62,
      suitableCategory: 'fish_meal',
      freshnessScoreAtExpiry: 44,
      safetyChecklistPassed: true,
      safetyNotes: 'Verified suitable for coastal fish-meal & dry curing; no contamination.',
      status: 'completed',
      processorId: 'usr-proc-1',
      processorName: 'Karavali Dry-Fish & Marine Meal',
      createdAt: hoursAgoIso(26),
      acceptedAt: hoursAgoIso(25),
    },
    {
      id: 'proc-req-2',
      listingId: 'lst-past-mackerel',
      speciesName: 'Indian Mackerel (Bangude)',
      fishermanId: 'usr-fish-2',
      fishermanName: 'Sudhakar Karkera',
      locationName: 'Malpe Fishing Harbor',
      quantityKg: 54,
      recoveryPricePerKg: 95,
      suitableCategory: 'dry_fish',
      freshnessScoreAtExpiry: 46,
      safetyChecklistPassed: true,
      safetyNotes: 'Salt-curing batch inspection passed at Ullal yard.',
      status: 'accepted_by_processor',
      processorId: 'usr-proc-1',
      processorName: 'Karavali Dry-Fish & Marine Meal',
      createdAt: hoursAgoIso(9),
      acceptedAt: hoursAgoIso(8),
    },
  ];

  const temperatureReadings: TemperatureReading[] = [
    {
      id: 'temp-1',
      deviceId: 'ESP32-ICEBOX-BUNDER-01',
      listingId: 'lst-mackerel-1',
      locationLabel: 'Sea Breeze IV · Insulated Crate A',
      temperatureC: 1.8,
      humidityPct: 86,
      status: 'optimal',
      isSimulated: true,
      recordedAt: hoursAgoIso(0.1),
    },
    {
      id: 'temp-2',
      deviceId: 'ESP32-ICEBOX-BUNDER-01',
      listingId: 'lst-mackerel-1',
      locationLabel: 'Sea Breeze IV · Insulated Crate A',
      temperatureC: 2.0,
      humidityPct: 85,
      status: 'optimal',
      isSimulated: true,
      recordedAt: hoursAgoIso(1.0),
    },
    {
      id: 'temp-3',
      deviceId: 'ESP32-ICEBOX-ULLAL-04',
      listingId: 'lst-sardine-5',
      locationLabel: 'Bunder Dock Crate C',
      temperatureC: 4.8,
      humidityPct: 89,
      status: 'warning',
      isSimulated: true,
      recordedAt: hoursAgoIso(0.15),
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      targetRole: 'fisherman',
      title: 'Offer received on Bangude (40 kg)',
      message: 'Machali Kitchen offered ₹200/kg; AI countered at ₹225/kg within your band.',
      severity: 'info',
      read: false,
      createdAt: hoursAgoIso(0.3),
    },
    {
      id: 'notif-2',
      targetRole: 'fisherman',
      title: 'Freshness window alert: Oil Sardine',
      message: '48 kg Bhootai is at Grade C (61/100). Dynamic decay active before processor routing.',
      severity: 'warning',
      read: false,
      createdAt: hoursAgoIso(0.5),
    },
    {
      id: 'notif-3',
      targetRole: 'processor',
      title: 'Zero-Waste batch recovered',
      message: '54 kg Malpe Mackerel routed to dry-fish curing at ₹95/kg.',
      severity: 'success',
      read: false,
      createdAt: hoursAgoIso(8),
    },
  ];

  const transactions: TransactionRecord[] = [
    {
      id: 'txn-1',
      orderId: 'FF-2026-1041',
      type: 'direct_sale',
      speciesName: 'Silver Pomfret (Manji)',
      quantityKg: 12,
      pricePerKg: 745,
      totalInr: 8940,
      fishermanExtraIncomeInr: 1980,
      catchToSaleMinutes: 110,
      timestamp: hoursAgoIso(19.5),
    },
    {
      id: 'txn-2',
      orderId: 'FF-2026-1042',
      type: 'direct_sale',
      speciesName: 'Seer Fish (Anjal)',
      quantityKg: 15,
      pricePerKg: 790,
      totalInr: 11850,
      fishermanExtraIncomeInr: 2550,
      catchToSaleMinutes: 135,
      timestamp: hoursAgoIso(2.5),
    },
    {
      id: 'txn-3',
      processorRequestId: 'proc-req-1',
      type: 'processor_recovery',
      speciesName: 'Oil Sardine (Bhootai)',
      quantityKg: 85,
      pricePerKg: 62,
      totalInr: 5270,
      fishermanExtraIncomeInr: 5270,
      catchToSaleMinutes: 540,
      timestamp: hoursAgoIso(25),
    },
    {
      id: 'txn-4',
      processorRequestId: 'proc-req-2',
      type: 'processor_recovery',
      speciesName: 'Indian Mackerel (Bangude)',
      quantityKg: 54,
      pricePerKg: 95,
      totalInr: 5130,
      fishermanExtraIncomeInr: 5130,
      catchToSaleMinutes: 490,
      timestamp: hoursAgoIso(8),
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-1',
      actorId: 'usr-admin-1',
      actorRole: 'admin',
      action: 'INITIALIZE_HARBOR_RULES',
      entityType: 'pricing_rules',
      entityId: 'mangalore-2026',
      details: 'Loaded Mangalore Bunder & Malpe baseline pricing thresholds.',
      timestamp: hoursAgoIso(48),
    },
    {
      id: 'aud-2',
      actorId: 'usr-proc-1',
      actorRole: 'processor',
      action: 'ZERO_WASTE_BATCH_ACCEPTED',
      entityType: 'processor_requests',
      entityId: 'proc-req-2',
      details: 'Accepted 54 kg Mackerel for dry-fish processing after safety checklist.',
      timestamp: hoursAgoIso(8),
    },
  ];

  return {
    users,
    fishermanProfiles,
    buyerProfiles,
    processorProfiles,
    fishSpecies,
    fishListings,
    freshnessAssessments: assessments,
    pricingRules,
    priceHistory: [],
    negotiations,
    offers,
    orders,
    payments,
    deliveries,
    processorRequests,
    temperatureReadings,
    notifications,
    transactions,
    auditLogs,
  };
}

let cachedDb: DatabaseState | null = null;

export function getDb(): DatabaseState {
  if (cachedDb) return cachedDb;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      cachedDb = JSON.parse(raw) as DatabaseState;
      return cachedDb;
    }
  } catch (err) {
    console.warn('Failed to load persisted DB, initializing seed data:', err);
  }
  cachedDb = createSeedDatabase();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: DatabaseState): void {
  cachedDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist DB:', err);
  }
}

export function resetDemoDb(): DatabaseState {
  const seed = createSeedDatabase();
  saveDb(seed);
  return seed;
}

export function computeListingDynamicSnapshot(listing: FishListing, db: DatabaseState) {
  const species = db.fishSpecies.find((s) => s.id === listing.speciesId) ?? db.fishSpecies[0];
  return calculateDynamicPrice({
    startingPrice: listing.aiStartingPrice,
    minFloor: listing.minAcceptablePrice,
    initialFreshnessScore: listing.freshnessScore,
    catchTimestampMs: new Date(listing.catchTimestamp).getTime(),
    nowMs: Date.now(),
    storageTempC: listing.storageTempC,
    speciesDecayRatePerHourPct: species.decayRatePerHourPct,
    maxFreshWindowHours: species.maxFreshWindowHours,
  });
}

/**
 * CRITICAL SECURITY PROJECTION:
 * Never expose `minAcceptablePrice` to buyers or public marketplace consumers.
 * Only the owning fisherman or an admin receives `minAcceptablePrice`.
 */
export function toPublicListing(
  listing: FishListing,
  db: DatabaseState,
  viewer?: { userId?: string; role?: UserRole }
): PublicFishListing {
  const dynamicPricing = computeListingDynamicSnapshot(listing, db);
  const assessment = db.freshnessAssessments.find((a) => a.id === listing.assessmentId);
  const { minAcceptablePrice, ...rest } = listing;
  const isOwnerOrAdmin =
    viewer?.role === 'admin' || (viewer?.role === 'fisherman' && viewer.userId === listing.fishermanId);

  return {
    ...rest,
    assessment,
    dynamicPricing,
    ...(isOwnerOrAdmin ? { isOwnerView: true, minAcceptablePrice } : { isOwnerView: false }),
  };
}

/**
 * Evaluates all active listings approaching or past freshness window and auto-routes to processors.
 */
export function evaluateZeroWasteRouting(db: DatabaseState): ProcessorRequest[] {
  const newlyCreated: ProcessorRequest[] = [];

  for (const listing of db.fishListings) {
    if (listing.status !== 'active' || listing.availableQuantityKg <= 0) continue;
    const snap = computeListingDynamicSnapshot(listing, db);
    if (snap.shouldRouteToProcessor) {
      listing.status = 'routed_to_processor';
      const species = db.fishSpecies.find((s) => s.id === listing.speciesId);
      const suitableCategory = species?.suitableProcessors[0] ?? 'fish_meal';
      const recoveryPricePerKg = Math.max(
        35,
        Math.round((listing.marketReferencePrice * 0.36) / 5) * 5
      );
      const req: ProcessorRequest = {
        id: `proc-req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        listingId: listing.id,
        speciesName: listing.speciesName,
        fishermanId: listing.fishermanId,
        fishermanName: listing.fishermanName,
        locationName: listing.locationName,
        quantityKg: listing.availableQuantityKg,
        recoveryPricePerKg,
        suitableCategory,
        freshnessScoreAtExpiry: snap.effectiveFreshnessScore,
        safetyChecklistPassed: false,
        safetyNotes: 'Pending processor dockside sensory & icing check before curing/meal intake.',
        status: 'pending_processor',
        createdAt: new Date().toISOString(),
      };
      db.processorRequests.unshift(req);
      newlyCreated.push(req);

      db.notifications.unshift({
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        targetRole: 'processor',
        title: `Zero-Waste Recovery Available: ${listing.speciesName}`,
        message: `${listing.availableQuantityKg} kg at ${listing.locationName} routed for ${suitableCategory.replace('_', '-')} recovery at ₹${recoveryPricePerKg}/kg.`,
        severity: 'warning',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (newlyCreated.length > 0) {
    saveDb(db);
  }
  return newlyCreated;
}

export function getFreshnessGradeHelper(score: number, db: DatabaseState, speciesId: string) {
  const rule = db.pricingRules.find((r) => r.speciesId === speciesId);
  return calculateFreshnessGrade(score, {
    gradeA: rule?.gradeAThreshold ?? 85,
    gradeB: rule?.gradeBThreshold ?? 68,
    gradeC: rule?.gradeCThreshold ?? 48,
  });
}
