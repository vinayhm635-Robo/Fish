export type UserRole = 'fisherman' | 'buyer' | 'processor' | 'admin' | 'delivery';

export type FreshnessGrade = 'A' | 'B' | 'C' | 'Recovery';

export type ListingStatus =
  | 'active'
  | 'paused'
  | 'sold_out'
  | 'unsold_expired'
  | 'routed_to_processor'
  | 'recovered'
  | 'flagged';

export type OrderStatus =
  | 'offer_received'
  | 'negotiation_in_progress'
  | 'deal_confirmed'
  | 'payment_pending'
  | 'payment_completed'
  | 'pickup_delivery_in_progress'
  | 'order_completed';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  verified: boolean;
  locationName: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export interface FishermanProfile {
  userId: string;
  boatName: string;
  boatRegNo: string;
  homeHarbor: string;
  preferredLanguage: 'kn' | 'tulu' | 'en';
  upiId: string;
  rating: number;
}

export interface BuyerProfile {
  userId: string;
  businessName: string;
  buyerType: 'hotel' | 'restaurant' | 'retailer' | 'household';
  gstNumber?: string;
  completedOrdersCount: number;
}

export interface ProcessorProfile {
  userId: string;
  facilityName: string;
  processorType: 'dry_fish' | 'fish_meal' | 'animal_feed';
  dailyCapacityKg: number;
  safetyCertified: boolean;
}

export interface FishSpecies {
  id: string;
  name: string;
  localNameKn: string;
  localNameTulu: string;
  category: string;
  defaultMarketRatePerKg: number;
  middlemanRatePerKg: number;
  decayRatePerHourPct: number;
  maxFreshWindowHours: number;
  suitableProcessors: Array<'dry_fish' | 'fish_meal' | 'animal_feed'>;
  defaultImageUrl: string;
}

export interface FreshnessAssessment {
  id: string;
  listingId?: string;
  capturedAt: string;
  isLiveCameraCapture: boolean;
  gpsLat?: number;
  gpsLng?: number;
  imageUrl: string;
  freshnessScore: number;
  grade: FreshnessGrade;
  gradeLabel: string;
  eyeClarity: string;
  gillColor: string;
  skinSheen: string;
  observations: string[];
  handlingUrgency: string;
  confidence: number;
  analysisMode: 'gemini-vision' | 'demo-simulated';
  disclaimer: string;
}

export interface PricingRule {
  speciesId: string;
  baseDemandMultiplier: number;
  maxFloorDiscountPct: number;
  freshnessPremiumPct: number;
  processorRecoveryDiscountPct: number;
  gradeAThreshold: number;
  gradeBThreshold: number;
  gradeCThreshold: number;
  updatedAt: string;
}

export interface PriceHistoryPoint {
  hourOffset: number;
  label: string;
  pricePerKg: number;
  projectedFreshness: number;
}

export interface DynamicPriceSnapshot {
  currentPrice: number;
  originalPrice: number;
  priceReduction: number;
  priceReductionPct: number;
  nextDropInMinutes: number;
  nextDropPrice: number;
  remainingWindowMinutes: number;
  effectiveFreshnessScore: number;
  shouldRouteToProcessor: boolean;
  storageConditionLabel: string;
  priceCurve: PriceHistoryPoint[];
}

export interface FishListing {
  id: string;
  fishermanId: string;
  fishermanName: string;
  boatName: string;
  speciesId: string;
  speciesName: string;
  localName: string;
  totalQuantityKg: number;
  availableQuantityKg: number;
  catchTimestamp: string;
  listedAt: string;
  locationName: string;
  lat: number;
  lng: number;
  imageUrl: string;
  isLiveVerifiedCapture: boolean;
  freshnessScore: number;
  freshnessGrade: FreshnessGrade;
  assessmentId: string;
  assessment?: FreshnessAssessment;
  aiStartingPrice: number;
  /** Strictly confidential on server. Never exposed to buyers. */
  minAcceptablePrice: number;
  aiRecommendedFloor: number;
  marketReferencePrice: number;
  middlemanBaselinePrice: number;
  storageTempC: number;
  status: ListingStatus;
  flagReason?: string;
}

export type PublicFishListing = Omit<FishListing, 'minAcceptablePrice'> & {
  dynamicPricing: DynamicPriceSnapshot;
  isOwnerView?: boolean;
  minAcceptablePrice?: number;
};

export interface NegotiationMessage {
  id: string;
  sender: 'buyer' | 'ai_agent' | 'system';
  text: string;
  offerPricePerKg?: number;
  quantityKg?: number;
  decision?: 'accept' | 'counter' | 'reject' | 'info';
  timestamp: string;
  aiMode?: 'gemini-llm' | 'deterministic-fallback';
}

export interface Negotiation {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  requestedKg: number;
  currentOfferPrice: number;
  agreedPricePerKg?: number;
  status: 'open' | 'deal_confirmed' | 'rejected' | 'expired';
  messages: NegotiationMessage[];
  updatedAt: string;
}

export interface Offer {
  id: string;
  listingId: string;
  negotiationId: string;
  buyerId: string;
  buyerName: string;
  offeredPricePerKg: number;
  quantityKg: number;
  status: 'pending' | 'accepted' | 'countered' | 'rejected';
  createdAt: string;
}

export interface Order {
  id: string;
  listingId: string;
  speciesName: string;
  buyerId: string;
  buyerName: string;
  fishermanId: string;
  fishermanName: string;
  negotiationId?: string;
  quantityKg: number;
  agreedPricePerKg: number;
  totalAmountInr: number;
  middlemanSavingsInr: number;
  fulfillmentMode: 'dock_pickup' | 'cold_delivery';
  pickupLocation: string;
  deliveryAddress?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  method: 'upi_test';
  upiRef: string;
  amountInr: number;
  status: 'pending' | 'test_completed';
  isSimulatedTestPayment: true;
  paidAt?: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  driverName: string;
  vehicleInfo: string;
  status: 'scheduled' | 'in_transit' | 'delivered';
  etaMinutes: number;
  updatedAt: string;
}

export interface ProcessorRequest {
  id: string;
  listingId: string;
  speciesName: string;
  fishermanId: string;
  fishermanName: string;
  locationName: string;
  quantityKg: number;
  recoveryPricePerKg: number;
  suitableCategory: 'dry_fish' | 'fish_meal' | 'animal_feed';
  freshnessScoreAtExpiry: number;
  safetyChecklistPassed: boolean;
  safetyNotes: string;
  status: 'pending_processor' | 'accepted_by_processor' | 'completed';
  processorId?: string;
  processorName?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface TemperatureReading {
  id: string;
  deviceId: string;
  listingId?: string;
  locationLabel: string;
  temperatureC: number;
  humidityPct: number;
  status: 'optimal' | 'warning' | 'critical';
  isSimulated: boolean;
  recordedAt: string;
}

export interface NotificationItem {
  id: string;
  targetRole: UserRole | 'all';
  targetUserId?: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  read: boolean;
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  orderId?: string;
  processorRequestId?: string;
  type: 'direct_sale' | 'processor_recovery';
  speciesName: string;
  quantityKg: number;
  pricePerKg: number;
  totalInr: number;
  fishermanExtraIncomeInr: number;
  catchToSaleMinutes: number;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
}
