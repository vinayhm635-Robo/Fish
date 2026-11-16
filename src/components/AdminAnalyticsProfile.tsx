import React, { useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Flag,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sun,
} from 'lucide-react';
import type {
  FishSpecies,
  PricingRule,
  ProcessorRequest,
  PublicFishListing,
  User,
} from '../types/domain';
import { api, type AnalyticsResponse } from '../services/api';
import { SpeciesRevenueBars } from './Charts';
import { MangaloreMap } from './MangaloreMap';

interface AdminViewProps {
  analytics: AnalyticsResponse | null;
  users: User[];
  speciesList: FishSpecies[];
  pricingRules: PricingRule[];
  listings: PublicFishListing[];
  onRefreshData: () => Promise<void>;
}

export function AdminDashboardView({
  analytics,
  users,
  speciesList,
  pricingRules,
  listings,
  onRefreshData,
}: AdminViewProps) {
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(pricingRules[0]?.speciesId ?? 'sp-mackerel');
  const activeRule = pricingRules.find((r) => r.speciesId === selectedSpeciesId) ?? pricingRules[0];

  const [demandMult, setDemandMult] = useState(activeRule?.baseDemandMultiplier ?? 1.04);
  const [maxDiscount, setMaxDiscount] = useState(activeRule?.maxFloorDiscountPct ?? 16);
  const [gradeAThresh, setGradeAThresh] = useState(activeRule?.gradeAThreshold ?? 85);
  const [savingRule, setSavingRule] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  const handleSelectRuleSpecies = (id: string) => {
    setSelectedSpeciesId(id);
    const r = pricingRules.find((rule) => rule.speciesId === id);
    if (r) {
      setDemandMult(r.baseDemandMultiplier);
      setMaxDiscount(r.maxFloorDiscountPct);
      setGradeAThresh(r.gradeAThreshold);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRule(true);
    try {
      await api.updatePricingRule(selectedSpeciesId, {
        baseDemandMultiplier: demandMult,
        maxFloorDiscountPct: maxDiscount,
        gradeAThreshold: gradeAThresh,
      });
      await onRefreshData();
      setStatusNote(`Updated pricing & demo grading thresholds for ${selectedSpeciesId}.`);
    } finally {
      setSavingRule(false);
    }
  };

  const s = analytics?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
          Harbor Operations & Governance Console
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Verify Mangalore fishermen and processors, configure species pricing bands, and monitor platform audit logs.
        </p>
      </div>

      {statusNote && (
        <div className="p-3 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/30 text-xs text-[#15803D] dark:text-emerald-300">
          {statusNote}
        </div>
      )}

      {/* Admin KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Fishermen', value: s?.registeredFishermen ?? 2 },
          { label: 'Buyers', value: s?.registeredBuyers ?? 1 },
          { label: 'Active Listings', value: s?.activeListingsCount ?? 0 },
          { label: 'Total Revenue', value: `₹${(s?.totalRevenueInr ?? 0).toLocaleString('en-IN')}` },
          { label: 'Saved From Waste', value: `${s?.totalKgSavedFromWaste ?? 0} kg` },
        ].map((k) => (
          <div
            key={k.label}
            className="p-4 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B]"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{k.label}</div>
            <div className="font-mono text-2xl font-bold tabular-nums mt-1 text-[#0B2334] dark:text-white">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Verification */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Registered Users & Verification</h2>
            <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#DCE7EC] dark:border-[#1B354B] text-slate-500">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 text-right font-medium">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7EC] dark:divide-[#1B354B]">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-3 font-medium">
                      <div>{u.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{u.phone}</div>
                    </td>
                    <td className="py-2.5 pr-3 capitalize">{u.role}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{u.locationName}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.updateUser(u.id, { verified: !u.verified });
                          await onRefreshData();
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                          u.verified
                            ? 'bg-[#16A34A]/15 text-[#16A34A]'
                            : 'bg-amber-500/15 text-[#D97706]'
                        }`}
                      >
                        {u.verified ? 'Verified' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing Rules Configurator */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">AI Pricing & Demo Threshold Rules</h2>
            <Sliders className="w-4 h-4 text-[#0B3B5B] dark:text-teal-300" />
          </div>

          <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
            <div>
              <label htmlFor="admin-rule-species" className="block font-medium mb-1">
                Fish Species
              </label>
              <select
                id="admin-rule-species"
                value={selectedSpeciesId}
                onChange={(e) => handleSelectRuleSpecies(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
              >
                {speciesList.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="rule-demand" className="block font-medium mb-1">
                  Demand Mult.
                </label>
                <input
                  id="rule-demand"
                  type="number"
                  step={0.02}
                  value={demandMult}
                  onChange={(e) => setDemandMult(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                />
              </div>
              <div>
                <label htmlFor="rule-disc" className="block font-medium mb-1">
                  Max Floor %
                </label>
                <input
                  id="rule-disc"
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                />
              </div>
              <div>
                <label htmlFor="rule-gradea" className="block font-medium mb-1">
                  Grade A Min
                </label>
                <input
                  id="rule-gradea"
                  type="number"
                  value={gradeAThresh}
                  onChange={(e) => setGradeAThresh(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingRule}
              className="w-full py-2 rounded-lg bg-[#0B3B5B] text-white font-semibold"
            >
              {savingRule ? 'Saving...' : 'Update Harbor Pricing Rule'}
            </button>
          </form>
        </div>
      </div>

      {/* Listing Moderation & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-3">
          <h2 className="font-display text-lg font-semibold">Monitor Listings</h2>
          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {listings.map((l) => (
              <div
                key={l.id}
                className="p-3 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-semibold">{l.speciesName}</div>
                  <div className="text-slate-500">
                    {l.fishermanName} · {l.availableQuantityKg} kg · Status: {l.status}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await api.updateListing(l.id, {
                      status: l.status === 'flagged' ? 'active' : 'flagged',
                      flagReason: l.status === 'flagged' ? '' : 'Manual admin quality review',
                    });
                    await onRefreshData();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#DCE7EC] dark:border-[#1B354B] hover:border-[#EA580C]"
                >
                  <Flag className="w-3 h-3 text-[#EA580C]" />
                  {l.status === 'flagged' ? 'Unflag' : 'Flag'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-3">
          <h2 className="font-display text-lg font-semibold">System Audit Trail</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
            {(analytics?.auditLogs ?? []).map((log) => (
              <div key={log.id} className="p-2.5 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] space-y-0.5">
                <div className="font-mono font-semibold text-[#0D9488]">{log.action}</div>
                <div className="text-slate-600 dark:text-slate-300">{log.details}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsAndImpactView({
  analytics,
  listings,
  users,
  processorRequests,
  onSelectListing,
  onRequestGps,
  userLocation,
}: {
  analytics: AnalyticsResponse | null;
  listings: PublicFishListing[];
  users: User[];
  processorRequests: ProcessorRequest[];
  onSelectListing: (lot: PublicFishListing) => void;
  onRequestGps: () => void;
  userLocation?: { lat: number; lng: number; label: string };
}) {
  const s = analytics?.summary;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
          Fair Price. Faster Sales. Less Waste.
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Live Mangalore impact metrics calculated directly from active orders, direct sales, and processor recovery logs (Demo Dataset).
        </p>
      </div>

      {/* Impact KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B]">
          <div className="text-xs text-slate-500">Fisherman Uplift vs Middlemen</div>
          <div className="font-mono text-2xl font-bold text-[#16A34A] mt-1">
            +₹{(s?.totalExtraIncomeInr ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Direct harbor-to-buyer margin</div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B]">
          <div className="text-xs text-slate-500">Avg. Catch to Sale Time</div>
          <div className="font-mono text-2xl font-bold text-[#0B3B5B] dark:text-sky-300 mt-1">
            {s?.avgCatchToSaleMinutes ?? 120} min
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Vs ~480 min traditional auction</div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B]">
          <div className="text-xs text-slate-500">Kilograms Saved From Waste</div>
          <div className="font-mono text-2xl font-bold text-[#0D9488] mt-1">
            {s?.totalKgSavedFromWaste ?? 0} kg
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {processorRequests.filter((r) => r.status !== 'pending_processor').length} recovered batches
          </div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B]">
          <div className="text-xs text-slate-500">Avg. Harbor Freshness</div>
          <div className="font-mono text-2xl font-bold text-[#EA580C] mt-1">
            {s?.avgFreshnessScore ?? 89} / 100
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Live camera verified catches</div>
        </div>
      </div>

      {/* Charts & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
          <h2 className="font-display text-lg font-bold">Volume & Revenue by Species</h2>
          <SpeciesRevenueBars items={analytics?.speciesBreakdown ?? []} />
        </div>

        <div className="lg:col-span-6 p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
          <h2 className="font-display text-lg font-bold">Recent Verified Transactions</h2>
          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {(analytics?.transactions ?? []).map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold">
                    {t.speciesName} · {t.quantityKg} kg
                  </div>
                  <div className="text-slate-500">
                    {t.type === 'direct_sale' ? 'Direct Marketplace' : 'Zero-Waste Recovery'} · ₹
                    {t.pricePerKg}/kg
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold">₹{t.totalInr.toLocaleString('en-IN')}</div>
                  <div className="text-[#16A34A]">+₹{t.fishermanExtraIncomeInr} extra</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Mangalore Map */}
      <MangaloreMap
        listings={listings}
        users={users}
        userLocation={userLocation}
        onRequestGps={onRequestGps}
        onSelectListing={onSelectListing}
      />

      {/* Future-Ready Architecture Roadmap */}
      <div className="p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B2334] dark:text-white">
            Future-Ready Coastal Architecture (Planned Expansion Modules)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Schema & API hooks prepared for coastal scaling across Karnataka, Kerala, Goa & Tamil Nadu.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {[
            {
              title: 'Pre-Landing Boat Auctions',
              desc: 'Reserve catch lots while trawlers are 2 hours offshore returning to Bunder or Malpe.',
            },
            {
              title: 'Hotel & Society Group Demand',
              desc: 'Aggregate bulk morning orders from Mangalore hotels and apartment communities.',
            },
            {
              title: 'QR Boat-to-Plate Traceability',
              desc: 'Printable crate QR codes linking vessel ID, catch timestamp, and cold-chain log.',
            },
            {
              title: 'Sustainability & Juvenile Guard',
              desc: 'Species size checks and monsoon trawl-ban calendar compliance alerts.',
            },
            {
              title: 'Fisherman Credit Scoring',
              desc: 'Verified transaction history enabling low-interest ice-box and net micro-loans.',
            },
            {
              title: 'Perishable Multi-Verticals',
              desc: 'Same freshness-decay engine adaptable to coastal dairy, jasmine flowers, and produce.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B] space-y-1"
            >
              <div className="font-semibold text-[#0B3B5B] dark:text-teal-300">{item.title}</div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileAndSettingsView({
  user,
  darkMode,
  onToggleTheme,
  userLocation,
  onRequestGps,
  onResetDemo,
  onRefreshData,
  onLogout,
}: {
  user: User;
  darkMode: boolean;
  onToggleTheme: () => void;
  userLocation?: { lat: number; lng: number; label: string };
  onRequestGps: () => void;
  onResetDemo: () => Promise<void>;
  onRefreshData: () => Promise<void>;
  onLogout: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [locationName, setLocationName] = useState(user.locationName);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateUser(user.id, { name, locationName });
      await onRefreshData();
      setSavedNote('Profile updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
          Profile, GPS & Demo Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your business details, location permissions, display theme, and hackathon demo state.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-[#0D9488] uppercase">{user.role} Account</div>
            <div className="text-xs text-slate-500 mt-0.5">{user.phone}</div>
          </div>
          {user.verified && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
              <CheckCircle2 className="w-4 h-4" />
              Verified Account
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-medium mb-1">
              Display / Business Name
            </label>
            <input
              id="prof-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
            />
          </div>
          <div>
            <label htmlFor="prof-loc" className="block text-xs font-medium mb-1">
              Harbor / Business Area
            </label>
            <input
              id="prof-loc"
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
            />
          </div>
        </div>

        {savedNote && <p className="text-xs text-[#16A34A]">{savedNote}</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#0B3B5B] text-white text-xs font-semibold"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div className="p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
        <h2 className="font-display text-lg font-semibold">Preferences & Hardware Controls</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-[#DCE7EC] dark:border-[#1B354B]">
          <div>
            <div className="text-sm font-medium">Appearance Theme</div>
            <div className="text-xs text-slate-500">Switch between Coastal Light and Deep Ocean Dark mode</div>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-semibold"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-[#DCE7EC] dark:border-[#1B354B]">
          <div>
            <div className="text-sm font-medium">GPS Location Permission</div>
            <div className="text-xs text-slate-500 font-mono">
              Current: {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Mangalore Default'}
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestGps}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-semibold"
          >
            <Compass className="w-4 h-4" />
            Update GPS Coordinates
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <div className="text-sm font-medium">Hackathon Demo Dataset</div>
            <div className="text-xs text-slate-500">Restore original Mangalore seed catch, offers, and zero-waste state</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#EA580C]/40 text-[#EA580C] text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
