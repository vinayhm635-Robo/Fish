import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Search,
  Send,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
import type {
  Delivery,
  FishSpecies,
  Negotiation,
  Order,
  Payment,
  PublicFishListing,
  User,
} from '../types/domain';
import { api } from '../services/api';
import { CircularFreshnessGauge, PriceDecayChart } from './Charts';

export type BuyerPage = 'marketplace' | 'product-detail' | 'negotiation' | 'orders';

interface BuyerFlowProps {
  page: BuyerPage;
  onNavigate: (page: BuyerPage) => void;
  user: User;
  speciesList: FishSpecies[];
  listings: Array<PublicFishListing & { distanceKm?: number }>;
  negotiations: Negotiation[];
  orders: Order[];
  payments: Payment[];
  deliveries: Delivery[];
  selectedListingId: string | null;
  onSelectListing: (id: string) => void;
  onRefreshData: () => Promise<void>;
}

const CATEGORIES = [
  'All',
  'Mackerel',
  'Sardines',
  'Pomfret',
  'Tuna',
  'Seer fish',
  'Prawns',
  'Squid',
  'Crab',
];

const ORDER_STEPS: Array<{ key: Order['status']; label: string }> = [
  { key: 'offer_received', label: 'Offer Received' },
  { key: 'negotiation_in_progress', label: 'Negotiation' },
  { key: 'deal_confirmed', label: 'Deal Confirmed' },
  { key: 'payment_pending', label: 'Payment Pending' },
  { key: 'payment_completed', label: 'Paid (Test)' },
  { key: 'pickup_delivery_in_progress', label: 'Pickup / Transit' },
  { key: 'order_completed', label: 'Completed' },
];

export function BuyerFlow({
  page,
  onNavigate,
  user,
  speciesList,
  listings,
  negotiations,
  orders,
  payments,
  deliveries,
  selectedListingId,
  onSelectListing,
  onRefreshData,
}: BuyerFlowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [minFreshness, setMinFreshness] = useState(0);
  const [sortBy, setSortBy] = useState<'freshness' | 'price_asc' | 'distance' | 'quantity'>('freshness');

  // Negotiation & Order State
  const [requestedKg, setRequestedKg] = useState(20);
  const [offerPricePerKg, setOfferPricePerKg] = useState(215);
  const [chatMessage, setChatMessage] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState<'dock_pickup' | 'cold_delivery'>('dock_pickup');
  const [deliveryAddress, setDeliveryAddress] = useState(user.locationName || 'Kodialbail, Mangalore');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [confirmingDeal, setConfirmingDeal] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activeListings = useMemo(() => listings.filter((l) => l.status === 'active'), [listings]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeListings
      .filter((l) => {
        if (activeCategory !== 'All') {
          const sp = speciesList.find((s) => s.id === l.speciesId);
          if (sp?.category !== activeCategory) return false;
        }
        if (l.dynamicPricing.effectiveFreshnessScore < minFreshness) return false;
        if (q) {
          const hay = `${l.speciesName} ${l.localName} ${l.locationName} ${l.fishermanName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'freshness') {
          return b.dynamicPricing.effectiveFreshnessScore - a.dynamicPricing.effectiveFreshnessScore;
        }
        if (sortBy === 'price_asc') {
          return a.dynamicPricing.currentPrice - b.dynamicPricing.currentPrice;
        }
        if (sortBy === 'distance') {
          return (a.distanceKm ?? 5) - (b.distanceKm ?? 5);
        }
        return b.availableQuantityKg - a.availableQuantityKg;
      });
  }, [activeListings, activeCategory, minFreshness, searchQuery, sortBy, speciesList]);

  const selectedListing =
    listings.find((l) => l.id === selectedListingId) ?? activeListings[0] ?? listings[0];

  const activeNegotiation = selectedListing
    ? negotiations.find(
        (n) => n.listingId === selectedListing.id && n.buyerId === user.id && n.status === 'open'
      ) ?? negotiations.find((n) => n.listingId === selectedListing.id)
    : undefined;

  const openNegotiateFor = (lot: PublicFishListing) => {
    onSelectListing(lot.id);
    setRequestedKg(Math.min(20, lot.availableQuantityKg));
    setOfferPricePerKg(Math.max(50, lot.dynamicPricing.currentPrice - 20));
    setErrorMsg('');
    setSuccessMsg('');
    onNavigate('negotiation');
  };

  const openDetailFor = (lot: PublicFishListing) => {
    onSelectListing(lot.id);
    setRequestedKg(Math.min(15, lot.availableQuantityKg));
    setErrorMsg('');
    setSuccessMsg('');
    onNavigate('product-detail');
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    setErrorMsg('');
    setSendingOffer(true);
    try {
      await api.sendNegotiationOffer({
        listingId: selectedListing.id,
        buyerId: user.id,
        buyerName: user.name,
        offerPricePerKg,
        requestedKg,
        message:
          chatMessage.trim() ||
          `I want ${requestedKg} kg of ${selectedListing.speciesName} at ₹${offerPricePerKg}/kg.`,
      });
      setChatMessage('');
      await onRefreshData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Offer submission failed');
    } finally {
      setSendingOffer(false);
    }
  };

  const handleConfirmDeal = async (negotiationId: string) => {
    setConfirmingDeal(true);
    setErrorMsg('');
    try {
      const res = await api.confirmNegotiation(negotiationId, {
        fulfillmentMode,
        deliveryAddress: fulfillmentMode === 'cold_delivery' ? deliveryAddress : undefined,
      });
      await onRefreshData();
      setSuccessMsg(`Deal confirmed! Order ${res.order.id} created and inventory reserved.`);
      onNavigate('orders');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not confirm deal');
    } finally {
      setConfirmingDeal(false);
    }
  };

  const handleDirectBuy = async () => {
    if (!selectedListing) return;
    setConfirmingDeal(true);
    setErrorMsg('');
    try {
      const res = await api.placeDirectOrder({
        listingId: selectedListing.id,
        buyerId: user.id,
        buyerName: user.name,
        quantityKg: requestedKg,
        fulfillmentMode,
        deliveryAddress: fulfillmentMode === 'cold_delivery' ? deliveryAddress : undefined,
      });
      await onRefreshData();
      setSuccessMsg(`Order ${res.order.id} reserved at ₹${res.order.agreedPricePerKg}/kg.`);
      onNavigate('orders');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not place direct order');
    } finally {
      setConfirmingDeal(false);
    }
  };

  const handlePayTest = async (orderId: string) => {
    setPayingOrderId(orderId);
    setErrorMsg('');
    try {
      await api.payOrderTest(orderId);
      await onRefreshData();
      setSuccessMsg(`Simulated Test UPI Payment recorded for Order ${orderId}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Test payment failed');
    } finally {
      setPayingOrderId(null);
    }
  };

  const myOrders = orders.filter((o) => o.buyerId === user.id || user.role === 'admin');
  const invoiceOrder = myOrders.find((o) => o.id === invoiceOrderId);
  const invoicePayment = invoiceOrder ? payments.find((p) => p.orderId === invoiceOrder.id) : undefined;

  return (
    <div className="space-y-6">
      {/* Sub-Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl">
          {(
            [
              ['marketplace', 'Marketplace'],
              ['product-detail', 'Catch Details'],
              ['negotiation', 'AI Negotiation'],
              ['orders', `Orders & UPI (${myOrders.length})`],
            ] as Array<[BuyerPage, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                page === id
                  ? 'bg-[#0D9488] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/30 text-sm text-[#15803D] dark:text-emerald-300 flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-sm text-[#DC2626]">
          {errorMsg}
        </div>
      )}

      {/* 1. BUYER MARKETPLACE */}
      {page === 'marketplace' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
                Mangalore Direct Seafood Marketplace
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Real-time freshness-verified landings · Direct from boat owners to hotels, kitchens & households
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Bangude, Anjal, Malpe..."
                aria-label="Search fresh fish listings"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0D1F2E] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>

          {/* Categories & Sort Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    activeCategory === cat
                      ? 'bg-[#0B3B5B] text-white'
                      : 'bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] text-slate-600 dark:text-slate-300 hover:border-[#0D9488]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={minFreshness}
                onChange={(e) => setMinFreshness(Number(e.target.value))}
                aria-label="Filter by minimum freshness"
                className="px-2.5 py-1.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0D1F2E]"
              >
                <option value={0}>All Freshness Scores</option>
                <option value={85}>Grade A Only (85+)</option>
                <option value={70}>Grade B+ (70+)</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                aria-label="Sort listings"
                className="px-2.5 py-1.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0D1F2E]"
              >
                <option value="freshness">Sort: Highest Freshness</option>
                <option value="price_asc">Sort: Lowest Price</option>
                <option value="distance">Sort: Nearest Harbor</option>
                <option value="quantity">Sort: Bulk Quantity</option>
              </select>
            </div>
          </div>

          {filteredListings.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-3">
              <p className="text-sm text-slate-500">
                No fresh catches match your current filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('All');
                  setMinFreshness(0);
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-lg bg-[#0B3B5B] text-white text-xs font-semibold"
              >
                Reset Marketplace Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((lot) => {
                const score = lot.dynamicPricing.effectiveFreshnessScore;
                const scoreColor =
                  score >= 85
                    ? 'text-[#16A34A]'
                    : score >= 68
                      ? 'text-[#0D9488]'
                      : 'text-[#D97706]';

                return (
                  <article
                    key={lot.id}
                    className="bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl overflow-hidden flex flex-col transition-transform hover:-translate-y-0.5"
                  >
                    <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                      <img
                        src={lot.imageUrl}
                        alt={lot.speciesName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="truncate">{lot.locationName}</span>
                          <span className="font-mono shrink-0">
                            {lot.distanceKm !== undefined ? `${lot.distanceKm} km` : 'Mangalore'}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-[#0B2334] dark:text-white">
                          {lot.speciesName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className={`font-mono font-semibold ${scoreColor}`}>
                            Freshness {score}/100 · Grade {lot.freshnessGrade}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">·</span>
                          <span className="text-slate-500 dark:text-slate-400 font-mono">
                            {lot.availableQuantityKg} kg available
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          Boat: {lot.boatName} · Drops in{' '}
                          <span className="font-mono text-[#EA580C]">
                            {lot.dynamicPricing.nextDropInMinutes}m
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#DCE7EC] dark:border-[#1B354B] space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="font-mono text-2xl font-bold text-[#0B2334] dark:text-white">
                              ₹{lot.dynamicPricing.currentPrice}/kg
                            </span>
                            {lot.dynamicPricing.priceReduction > 0 && (
                              <span className="ml-2 text-xs font-mono text-slate-400 line-through">
                                ₹{lot.aiStartingPrice}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono text-[#0D9488]">
                            {Math.floor(lot.dynamicPricing.remainingWindowMinutes / 60)}h left
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => openDetailFor(lot)}
                            className="py-2 px-3 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openNegotiateFor(lot)}
                            className="py-2 px-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold transition-colors"
                          >
                            Make an Offer
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. PRODUCT DETAILS */}
      {page === 'product-detail' && selectedListing && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => onNavigate('marketplace')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#0B3B5B]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="aspect-[16/10] rounded-xl overflow-hidden border border-[#DCE7EC] dark:border-[#1B354B] bg-slate-100">
                <img
                  src={selectedListing.imageUrl}
                  alt={selectedListing.speciesName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
                <h3 className="font-display text-lg font-bold text-[#0B2334] dark:text-white">
                  Freshness-Linked Price Decay & Storage Telemetry
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                  <span>Starting price: ₹{selectedListing.aiStartingPrice}/kg</span>
                  <span>Current price: ₹{selectedListing.dynamicPricing.currentPrice}/kg</span>
                  <span className="text-[#EA580C]">
                    Price drops in: {selectedListing.dynamicPricing.nextDropInMinutes} minutes
                  </span>
                  <span>Storage: {selectedListing.dynamicPricing.storageConditionLabel}</span>
                </div>
                <PriceDecayChart
                  curve={selectedListing.dynamicPricing.priceCurve}
                  currentPrice={selectedListing.dynamicPricing.currentPrice}
                  startingPrice={selectedListing.aiStartingPrice}
                />
              </div>

              {selectedListing.assessment && (
                <div className="p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
                  <div className="flex items-center gap-6">
                    <CircularFreshnessGauge
                      score={selectedListing.dynamicPricing.effectiveFreshnessScore}
                      grade={selectedListing.freshnessGrade}
                      size={110}
                    />
                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-bold">AI Visual Inspection Report</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedListing.assessment.gradeLabel} · Live Camera Verified
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Eyes: {selectedListing.assessment.eyeClarity} · Gills: {selectedListing.assessment.gillColor}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedListing.assessment.disclaimer}
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-20 p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-5">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0D9488]" />
                    {selectedListing.locationName} · Caught by {selectedListing.fishermanName} ({selectedListing.boatName})
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white mt-1">
                    {selectedListing.speciesName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Local names: {selectedListing.localName}
                  </p>
                </div>

                <div className="flex items-baseline justify-between border-y border-[#DCE7EC] dark:border-[#1B354B] py-4">
                  <div>
                    <div className="text-xs text-slate-500">Current Dynamic Price</div>
                    <div className="font-mono text-3xl font-bold text-[#0B2334] dark:text-white">
                      ₹{selectedListing.dynamicPricing.currentPrice}/kg
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs text-slate-500">Available</div>
                    <div className="text-lg font-bold text-[#0D9488]">
                      {selectedListing.availableQuantityKg} kg
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="detail-qty" className="block text-xs font-medium mb-1">
                      Order Quantity (kg)
                    </label>
                    <input
                      id="detail-qty"
                      type="number"
                      min={1}
                      max={selectedListing.availableQuantityKg}
                      value={requestedKg}
                      onChange={(e) => setRequestedKg(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                    />
                  </div>

                  <div>
                    <span className="block text-xs font-medium mb-1">Fulfillment Option</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFulfillmentMode('dock_pickup')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                          fulfillmentMode === 'dock_pickup'
                            ? 'border-[#0B3B5B] bg-[#0B3B5B]/10 text-[#0B3B5B] dark:border-teal-400 dark:text-teal-300'
                            : 'border-[#DCE7EC] dark:border-[#1B354B]'
                        }`}
                      >
                        Harbor Dock Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setFulfillmentMode('cold_delivery')}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                          fulfillmentMode === 'cold_delivery'
                            ? 'border-[#0B3B5B] bg-[#0B3B5B]/10 text-[#0B3B5B] dark:border-teal-400 dark:text-teal-300'
                            : 'border-[#DCE7EC] dark:border-[#1B354B]'
                        }`}
                      >
                        Insulated Cold Van
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => openNegotiateFor(selectedListing)}
                    className="w-full py-3 px-4 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Negotiate Price with AI Agent
                  </button>
                  <button
                    type="button"
                    disabled={confirmingDeal || selectedListing.availableQuantityKg <= 0}
                    onClick={handleDirectBuy}
                    className="w-full py-3 px-4 rounded-lg bg-[#0B3B5B] hover:bg-[#092F49] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Buy Now at ₹{selectedListing.dynamicPricing.currentPrice}/kg (₹
                    {(selectedListing.dynamicPricing.currentPrice * requestedKg).toLocaleString('en-IN')})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. AI NEGOTIATION CHAT */}
      {page === 'negotiation' && selectedListing && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4 h-fit">
            <img
              src={selectedListing.imageUrl}
              alt={selectedListing.speciesName}
              referrerPolicy="no-referrer"
              className="w-full h-40 object-cover rounded-lg"
            />
            <div>
              <div className="text-xs text-slate-500">{selectedListing.locationName}</div>
              <h2 className="font-display text-xl font-bold mt-0.5">{selectedListing.speciesName}</h2>
            </div>
            <div className="space-y-1.5 text-xs font-mono border-t border-[#DCE7EC] dark:border-[#1B354B] pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Dynamic Price</span>
                <span className="font-bold">₹{selectedListing.dynamicPricing.currentPrice}/kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Freshness Score</span>
                <span className="text-[#16A34A] font-semibold">
                  {selectedListing.dynamicPricing.effectiveFreshnessScore}/100 (Grade {selectedListing.freshnessGrade})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Available Stock</span>
                <span>{selectedListing.availableQuantityKg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Window Left</span>
                <span>{Math.floor(selectedListing.dynamicPricing.remainingWindowMinutes / 60)}h {selectedListing.dynamicPricing.remainingWindowMinutes % 60}m</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI Negotiation Guardrail: Counteroffers are validated server-side against the fisherman&apos;s
              confidential reserve band.
            </p>
          </div>

          <div className="lg:col-span-8 flex flex-col rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#DCE7EC] dark:border-[#1B354B] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0B2334] dark:text-white">
                  AI Price Negotiation Agent
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Submit a bulk or per-kg offer; accept the agreed counteroffer to lock inventory immediately.
                </p>
              </div>
              {activeNegotiation && activeNegotiation.status === 'open' && (
                <button
                  type="button"
                  disabled={confirmingDeal}
                  onClick={() => handleConfirmDeal(activeNegotiation.id)}
                  className="px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold whitespace-nowrap"
                >
                  {confirmingDeal
                    ? 'Locking Deal...'
                    : `Confirm Deal at ₹${activeNegotiation.agreedPricePerKg ?? activeNegotiation.currentOfferPrice}/kg`}
                </button>
              )}
            </div>

            {/* Chat Transcript */}
            <div className="p-5 space-y-3 min-h-[280px] max-h-[420px] overflow-y-auto bg-[#F6FAFB] dark:bg-[#07131D]">
              {!activeNegotiation || activeNegotiation.messages.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">
                  Start by proposing your quantity (kg) and target price (₹/kg) below.
                </div>
              ) : (
                activeNegotiation.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === 'buyer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-xl px-4 py-3 text-sm space-y-1 ${
                        m.sender === 'buyer'
                          ? 'bg-[#0B3B5B] text-white'
                          : 'bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] text-[#0B2334] dark:text-slate-100'
                      }`}
                    >
                      <div className="text-[11px] opacity-75 font-mono">
                        {m.sender === 'buyer' ? user.name : 'FishFresh AI Agent'}
                        {m.offerPricePerKg ? ` · ₹${m.offerPricePerKg}/kg` : ''}
                      </div>
                      <p className="leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Offer Submission Form */}
            <form
              onSubmit={handleSendOffer}
              className="p-4 border-t border-[#DCE7EC] dark:border-[#1B354B] space-y-3"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="neg-qty" className="block text-[11px] font-medium mb-1">
                    Quantity (kg)
                  </label>
                  <input
                    id="neg-qty"
                    type="number"
                    min={1}
                    max={selectedListing.availableQuantityKg}
                    value={requestedKg}
                    onChange={(e) => setRequestedKg(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                  />
                </div>
                <div>
                  <label htmlFor="neg-price" className="block text-[11px] font-medium mb-1">
                    Your Offer (₹/kg)
                  </label>
                  <input
                    id="neg-price"
                    type="number"
                    min={40}
                    value={offerPricePerKg}
                    onChange={(e) => setOfferPricePerKg(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="neg-msg" className="block text-[11px] font-medium mb-1">
                    Message to AI Agent
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="neg-msg"
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder={`Can you make it ₹${offerPricePerKg}/kg for ${requestedKg} kg?`}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                    />
                    <button
                      type="submit"
                      disabled={sendingOffer}
                      className="px-4 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingOffer ? 'Sending...' : 'Send Offer'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ORDERS, SIMULATED UPI PAYMENT & DIGITAL INVOICE */}
      {page === 'orders' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
              Orders, Fulfillment & Simulated UPI Test Checkout
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hackathon Demo Note: Payment actions below execute a clearly labelled simulated test-payment
              workflow—no real UPI funds are debited.
            </p>
          </div>

          {myOrders.length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-3">
              <p className="text-sm text-slate-500">No orders placed yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('marketplace')}
                className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-sm font-semibold"
              >
                Explore Mangalore Catch
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((order) => {
                const payment = payments.find((p) => p.orderId === order.id);
                const delivery = deliveries.find((d) => d.orderId === order.id);
                const activeStepIdx = Math.max(
                  0,
                  ORDER_STEPS.findIndex((s) => s.key === order.status)
                );

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-[#0D9488]">
                          Order {order.id} · {order.fulfillmentMode === 'dock_pickup' ? 'Harbor Dock Pickup' : 'Insulated Cold Delivery'}
                        </div>
                        <h3 className="font-display text-lg font-bold text-[#0B2334] dark:text-white mt-0.5">
                          {order.speciesName} · {order.quantityKg} kg
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Fisherman: {order.fishermanName} · Pickup: {order.pickupLocation}
                        </p>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xl font-bold text-[#0B2334] dark:text-white">
                          ₹{order.totalAmountInr.toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-slate-500">
                          ₹{order.agreedPricePerKg}/kg · Saved fisherman ₹{order.middlemanSavingsInr} vs middleman
                        </div>
                      </div>
                    </div>

                    {/* Lifecycle Progress */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-2">
                      {ORDER_STEPS.map((st, idx) => (
                        <div
                          key={st.key}
                          className={`text-[10px] py-1.5 px-2 rounded text-center font-medium truncate ${
                            idx <= activeStepIdx
                              ? 'bg-[#0D9488]/15 text-[#0F766E] dark:text-teal-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                        >
                          {st.label}
                        </div>
                      ))}
                    </div>

                    {delivery && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-[#F6FAFB] dark:bg-[#07131D] p-3 rounded-lg">
                        <Truck className="w-4 h-4 text-[#0D9488] shrink-0" />
                        <span>
                          Driver: {delivery.driverName} ({delivery.vehicleInfo}) · ETA {delivery.etaMinutes} min
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DCE7EC] dark:border-[#1B354B]">
                      {payment ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[#16A34A]">
                          <CheckCircle2 className="w-4 h-4" />
                          Simulated Test UPI Completed ({payment.upiRef})
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={payingOrderId === order.id}
                          onClick={() => handlePayTest(order.id)}
                          className="px-4 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold"
                        >
                          {payingOrderId === order.id
                            ? 'Processing Test UPI...'
                            : `Simulate UPI Test Payment (₹${order.totalAmountInr.toLocaleString('en-IN')})`}
                        </button>
                      )}

                      <div className="flex items-center gap-2 ml-auto">
                        {order.status !== 'order_completed' && payment && (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.updateOrderStatus(order.id, 'order_completed');
                              await onRefreshData();
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[#16A34A]/40 text-[#16A34A] text-xs font-semibold"
                          >
                            Mark Received
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setInvoiceOrderId(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Digital Invoice
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Digital Invoice Dialog */}
          {invoiceOrder && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Digital Invoice"
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#DCE7EC] dark:border-[#1B354B] pb-3">
                  <div>
                    <div className="font-display font-bold text-lg">FishFresh AI Invoice</div>
                    <div className="text-xs font-mono text-slate-500">{invoiceOrder.id}</div>
                  </div>
                  <Clock className="w-4 h-4 text-[#0D9488]" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Buyer</span>
                    <span className="font-medium">{invoiceOrder.buyerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fisherman</span>
                    <span className="font-medium">{invoiceOrder.fishermanName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Species & Weight</span>
                    <span className="font-mono">{invoiceOrder.speciesName} · {invoiceOrder.quantityKg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agreed Rate</span>
                    <span className="font-mono">₹{invoiceOrder.agreedPricePerKg}/kg</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-[#DCE7EC] dark:border-[#1B354B] pt-2">
                    <span>Total Amount</span>
                    <span className="font-mono">₹{invoiceOrder.totalAmountInr.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-xs text-slate-500 pt-1">
                    Payment Status:{' '}
                    {invoicePayment
                      ? `Test UPI Completed (${invoicePayment.upiRef} · Simulated Demo)`
                      : 'Pending Test Payment'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceOrderId(null)}
                  className="w-full py-2.5 rounded-lg bg-[#0B3B5B] text-white text-sm font-semibold"
                >
                  Close Invoice
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
