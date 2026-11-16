import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Factory, Recycle, ShieldAlert } from 'lucide-react';
import type { ProcessorRequest, PublicFishListing, User } from '../types/domain';
import { api } from '../services/api';

export type ProcessorPage = 'processor-dashboard' | 'zero-waste';

interface ProcessorFlowProps {
  page: ProcessorPage;
  onNavigate: (page: ProcessorPage) => void;
  user: User;
  requests: ProcessorRequest[];
  listings: PublicFishListing[];
  onRefreshData: () => Promise<void>;
}

export function ProcessorAndZeroWaste({
  page,
  onNavigate,
  user,
  requests,
  listings,
  onRefreshData,
}: ProcessorFlowProps) {
  const [checkedSafetyIds, setCheckedSafetyIds] = useState<Record<string, boolean>>({});
  const [safetyNotesMap, setSafetyNotesMap] = useState<Record<string, string>>({});
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const pendingRequests = requests.filter((r) => r.status === 'pending_processor');
  const recoveredRequests = requests.filter(
    (r) => r.status === 'accepted_by_processor' || r.status === 'completed'
  );
  const totalRecoveredKg = recoveredRequests.reduce((sum, r) => sum + r.quantityKg, 0);
  const totalRecoveryRevenueInr = recoveredRequests.reduce(
    (sum, r) => sum + r.quantityKg * r.recoveryPricePerKg,
    0
  );

  const activeFreshListings = listings.filter((l) => l.status === 'active');

  const handleAcceptBatch = async (req: ProcessorRequest) => {
    setErrorMsg('');
    if (!checkedSafetyIds[req.id]) {
      setErrorMsg(
        'Confirm the dockside sensory, temperature, and handling safety check before accepting for processing.'
      );
      return;
    }
    setAcceptingId(req.id);
    try {
      await api.acceptProcessorRequest(req.id, {
        processorId: user.id,
        processorName: user.name,
        safetyChecklistPassed: true,
        safetyNotes:
          safetyNotesMap[req.id] ||
          'Sensory & dockside ice-box audit passed for dry-fish / fish-meal intake.',
      });
      await onRefreshData();
      setSuccessMsg(
        `Recovered ${req.quantityKg} kg of ${req.speciesName}! Wastage avoided and ₹${(
          req.quantityKg * req.recoveryPricePerKg
        ).toLocaleString('en-IN')} credited to fisherman.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not accept processor batch');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleSimulateExpiry = async (listingId: string) => {
    setSimulatingId(listingId);
    setErrorMsg('');
    try {
      await api.simulateExpiry(listingId);
      await onRefreshData();
      setSuccessMsg('Unsold catch passed freshness limit and routed automatically to Processor Recovery.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to simulate expiry');
    } finally {
      setSimulatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5 p-1 w-fit bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl">
        <button
          type="button"
          onClick={() => onNavigate('processor-dashboard')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            page === 'processor-dashboard'
              ? 'bg-[#0B3B5B] text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Processor Recovery Queue ({pendingRequests.length})
        </button>
        <button
          type="button"
          onClick={() => onNavigate('zero-waste')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            page === 'zero-waste'
              ? 'bg-[#16A34A] text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Zero-Waste Impact & Routing
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/30 text-sm text-[#15803D] dark:text-emerald-300">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-sm text-[#DC2626]">
          {errorMsg}
        </div>
      )}

      {/* Hero Zero-Waste Metric */}
      <div className="p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        <div className="md:col-span-2 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center shrink-0">
            <Recycle className="w-7 h-7" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Kilograms of Fish Saved From Waste
            </div>
            <div className="font-mono text-4xl font-bold text-[#16A34A] tabular-nums">
              {totalRecoveredKg} kg
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Pending Recovery Offers</div>
          <div className="font-mono text-2xl font-bold text-[#EA580C] tabular-nums mt-1">
            {pendingRequests.length} batches
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Fisherman Recovery Revenue</div>
          <div className="font-mono text-2xl font-bold text-[#0B3B5B] dark:text-sky-300 tabular-nums mt-1">
            ₹{totalRecoveryRevenueInr.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* PROCESSOR DASHBOARD */}
      {page === 'processor-dashboard' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-[#F6FAFB] dark:bg-[#081A27] border border-[#DCE7EC] dark:border-[#1B354B] flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
            <ShieldAlert className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
            <span>
              Safety & Handling Policy: Unsold catch is never automatically marked safe for human
              consumption or processing. Processors must complete dockside sensory & handling checks
              before intake.
            </span>
          </div>

          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-[#0B2334] dark:text-white">
              Available Unsold Fish for Dry-Fish, Fish-Meal & Feed Recovery
            </h2>

            {pendingRequests.length === 0 ? (
              <div className="p-8 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] text-center space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No pending expired batches right now. Switch to Zero-Waste Impact & Routing to simulate
                  an unsold listing reaching its freshness limit.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('zero-waste')}
                  className="px-4 py-2 rounded-lg bg-[#0B3B5B] text-white text-xs font-semibold"
                >
                  Simulate Unsold Listing Routing
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono text-[#EA580C]">
                          Category: {req.suitableCategory.replace('_', '-').toUpperCase()} · Score {req.freshnessScoreAtExpiry}/100
                        </div>
                        <h3 className="font-display text-lg font-bold mt-0.5">
                          {req.speciesName} · {req.quantityKg} kg
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          From {req.fishermanName} · {req.locationName}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-lg font-bold text-[#0D9488]">₹{req.recoveryPricePerKg}/kg</div>
                        <div className="text-xs text-slate-500">
                          Total ₹{(req.quantityKg * req.recoveryPricePerKg).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B] space-y-2.5">
                      <label className="flex items-start gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(checkedSafetyIds[req.id])}
                          onChange={(e) =>
                            setCheckedSafetyIds((prev) => ({ ...prev, [req.id]: e.target.checked }))
                          }
                          className="mt-0.5 rounded border-slate-300"
                        />
                        <span>
                          I confirm dockside sensory inspection & spoilage segregation passed for{' '}
                          {req.suitableCategory.replace('_', '-')} processing.
                        </span>
                      </label>
                      <input
                        type="text"
                        value={safetyNotesMap[req.id] || ''}
                        onChange={(e) =>
                          setSafetyNotesMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="Optional safety inspection notes..."
                        className="w-full px-3 py-1.5 text-xs rounded border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0D1F2E]"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={acceptingId === req.id}
                      onClick={() => handleAcceptBatch(req)}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <Factory className="w-4 h-4" />
                      {acceptingId === req.id ? 'Recording Recovery...' : 'Accept Recovery Batch'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ZERO-WASTE MANAGEMENT & SIMULATOR */}
      {page === 'zero-waste' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B2334] dark:text-white">
              Hackathon Demo: Simulate Unsold Listing Auto-Routing
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trigger an active harbor lot to reach its freshness limit so you can observe automated
              dry-fish / fish-meal routing in real time.
            </p>
            <div className="space-y-3">
              {activeFreshListings.map((lot) => (
                <div
                  key={lot.id}
                  className="p-3.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-sm">{lot.speciesName}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {lot.availableQuantityKg} kg · {lot.locationName} · Score {lot.dynamicPricing.effectiveFreshnessScore}/100
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={simulatingId === lot.id}
                    onClick={() => handleSimulateExpiry(lot.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {simulatingId === lot.id ? 'Routing...' : 'Simulate Expiry'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B2334] dark:text-white">
              Completed Zero-Waste Recoveries
            </h2>
            <div className="space-y-3">
              {recoveredRequests.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B] flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#16A34A]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {r.suitableCategory.replace('_', '-').toUpperCase()} · {r.processorName}
                    </div>
                    <div className="font-semibold text-sm mt-0.5">
                      {r.speciesName} · {r.quantityKg} kg saved
                    </div>
                    <div className="text-xs text-slate-500">{r.safetyNotes}</div>
                  </div>
                  <div className="text-right font-mono text-sm font-bold">
                    ₹{(r.quantityKg * r.recoveryPricePerKg).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
