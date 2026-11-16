import type {
  AuditLog,
  Delivery,
  FishSpecies,
  Negotiation,
  NotificationItem,
  Order,
  Payment,
  PricingRule,
  ProcessorRequest,
  PublicFishListing,
  TemperatureReading,
  TransactionRecord,
  User,
  UserRole,
} from '../types/domain';
import type { FreshnessAiResult } from '../../server/ai';
import type { FairPriceOutput, NegotiationEvaluationResult, ParsedVoiceListing } from '../engine/fishEconomics';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface AnalyticsResponse {
  summary: {
    registeredFishermen: number;
    registeredBuyers: number;
    registeredProcessors: number;
    activeListingsCount: number;
    totalOrdersCount: number;
    totalKgSold: number;
    totalKgSavedFromWaste: number;
    totalRevenueInr: number;
    totalExtraIncomeInr: number;
    avgFreshnessScore: number;
    avgCatchToSaleMinutes: number;
    openNegotiationsCount: number;
    flaggedListingsCount: number;
  };
  speciesBreakdown: Array<{ species: string; kgSold: number; revenueInr: number }>;
  transactions: TransactionRecord[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
}

export const api = {
  getUsers: () => request<{ users: User[] }>('/api/users'),

  login: (payload: { phone?: string; role?: UserRole; name?: string; locationName?: string }) =>
    request<{ user: User; isNew: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (id: string, payload: Partial<User>) =>
    request<{ user: User }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getSpecies: () => request<{ species: FishSpecies[]; pricingRules: PricingRule[] }>('/api/species'),

  updatePricingRule: (speciesId: string, payload: Partial<PricingRule> & { actorId?: string }) =>
    request<{ rule: PricingRule }>(`/api/admin/pricing-rules/${speciesId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getListings: (params?: { viewerUserId?: string; viewerRole?: UserRole; lat?: number; lng?: number }) => {
    const qs = new URLSearchParams();
    if (params?.viewerUserId) qs.set('viewerUserId', params.viewerUserId);
    if (params?.viewerRole) qs.set('viewerRole', params.viewerRole);
    if (params?.lat) qs.set('lat', String(params.lat));
    if (params?.lng) qs.set('lng', String(params.lng));
    return request<{ listings: Array<PublicFishListing & { distanceKm?: number }> }>(
      `/api/listings?${qs.toString()}`
    );
  },

  createListing: (payload: Record<string, unknown>) =>
    request<{ listing: PublicFishListing }>('/api/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateListing: (id: string, payload: Record<string, unknown>) =>
    request<{ listing: PublicFishListing }>(`/api/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteListing: (id: string) =>
    request<{ deleted: boolean }>(`/api/listings/${id}`, { method: 'DELETE' }),

  simulateExpiry: (id: string) =>
    request<{ listing: PublicFishListing; createdRequests: ProcessorRequest[] }>(
      `/api/listings/${id}/simulate-expiry`,
      { method: 'POST' }
    ),

  analyzeFreshness: (payload: {
    imageBase64?: string;
    mimeType?: string;
    speciesName?: string;
    isLiveCameraCapture: boolean;
  }) =>
    request<{ assessment: FreshnessAiResult }>('/api/ai/freshness', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  parseVoiceListing: (payload: { transcript?: string; audioBase64?: string; audioMimeType?: string }) =>
    request<{
      parsed: ParsedVoiceListing & { transcriptText: string; mode: 'gemini-nlp' | 'demo-simulated' };
      fairBand: FairPriceOutput;
    }>('/api/ai/voice-parse', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getFairPrice: (payload: { speciesId: string; freshnessScore: number; quantityKg: number }) =>
    request<{ fairBand: FairPriceOutput }>('/api/ai/fair-price', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getNegotiations: (params?: { buyerId?: string; listingId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.buyerId) qs.set('buyerId', params.buyerId);
    if (params?.listingId) qs.set('listingId', params.listingId);
    return request<{ negotiations: Negotiation[] }>(`/api/negotiations?${qs.toString()}`);
  },

  sendNegotiationOffer: (payload: {
    listingId: string;
    buyerId: string;
    buyerName: string;
    offerPricePerKg: number;
    requestedKg: number;
    message?: string;
  }) =>
    request<{ negotiation: Negotiation; evaluation: NegotiationEvaluationResult }>(
      '/api/negotiations/offer',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  confirmNegotiation: (
    negotiationId: string,
    payload: { fulfillmentMode: 'dock_pickup' | 'cold_delivery'; deliveryAddress?: string }
  ) =>
    request<{ order: Order; negotiation: Negotiation; listing: PublicFishListing }>(
      `/api/negotiations/${negotiationId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  placeDirectOrder: (payload: {
    listingId: string;
    buyerId: string;
    buyerName: string;
    quantityKg: number;
    fulfillmentMode: 'dock_pickup' | 'cold_delivery';
    deliveryAddress?: string;
  }) =>
    request<{ order: Order }>('/api/orders/direct', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrders: () =>
    request<{ orders: Order[]; payments: Payment[]; deliveries: Delivery[] }>('/api/orders'),

  payOrderTest: (orderId: string) =>
    request<{ order: Order; payment: Payment; transaction: TransactionRecord }>(
      `/api/orders/${orderId}/pay-test`,
      { method: 'POST' }
    ),

  updateOrderStatus: (orderId: string, status: Order['status']) =>
    request<{ order: Order }>(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getProcessorRequests: () =>
    request<{ requests: ProcessorRequest[] }>('/api/processor/requests'),

  acceptProcessorRequest: (
    id: string,
    payload: {
      processorId: string;
      processorName: string;
      safetyChecklistPassed: boolean;
      safetyNotes?: string;
    }
  ) =>
    request<{ request: ProcessorRequest }>(`/api/processor/requests/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getTemperatureReadings: () =>
    request<{ readings: TemperatureReading[] }>('/api/iot/temperature'),

  simulateTemperature: (payload: { listingId?: string; temperatureC: number }) =>
    request<{ reading: TemperatureReading }>('/api/iot/temperature/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAnalytics: () => request<AnalyticsResponse>('/api/analytics'),

  resetDemo: () => request<{ ok: boolean }>('/api/demo/reset', { method: 'POST' }),
};
