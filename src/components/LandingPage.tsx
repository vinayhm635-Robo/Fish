import React from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  MapPin,
  Mic,
  Moon,
  Recycle,
  Scale,
  Sun,
} from 'lucide-react';
import type { AnalyticsResponse } from '../services/api';
import type { PublicFishListing, UserRole } from '../types/domain';

interface LandingPageProps {
  analytics: AnalyticsResponse | null;
  listings: PublicFishListing[];
  darkMode: boolean;
  onToggleTheme: () => void;
  onNavigateAuth: () => void;
  onNavigateRoles: () => void;
  onStartDemoRole: (role: UserRole) => void;
  onStartHackathonTour: () => void;
}

export function LandingPage({
  analytics,
  listings,
  darkMode,
  onToggleTheme,
  onNavigateAuth,
  onNavigateRoles,
  onStartDemoRole,
  onStartHackathonTour,
}: LandingPageProps) {
  const activeListings = listings.filter((l) => l.status === 'active').slice(0, 3);

  return (
    <div className="min-h-screen bg-[#F6FAFB] dark:bg-[#07131D] text-[#0B2334] dark:text-[#EAF3F8]">
      {/* Top Bar: Strict 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#07131D]/95 backdrop-blur border-b border-[#DCE7EC] dark:border-[#1B354B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-xl font-display font-bold tracking-tight text-[#0B3B5B] dark:text-white whitespace-nowrap shrink-0"
          >
            FishFresh AI
          </a>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#innovations"
              className="hover:text-[#0B3B5B] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Innovations
            </a>
            <a
              href="#harbor-live"
              className="hover:text-[#0B3B5B] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Live Catch
            </a>
            <a
              href="#impact"
              className="hover:text-[#0B3B5B] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Zero Waste
            </a>
            <button
              type="button"
              onClick={onNavigateRoles}
              className="hover:text-[#0B3B5B] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Roles
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onStartHackathonTour}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white transition-colors whitespace-nowrap shrink-0"
            >
              Launch Demo
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-14 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="text-sm font-medium text-[#0D9488] flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Mangalore Fisheries Corridor · Bunder · Malpe · Ullal · Panambur</span>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-[#0B2334] dark:text-white leading-[1.1]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Fish price should follow freshness, not middlemen.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                From boat to plate with zero waste. Fishermen list daily catch by speaking Kannada,
                Tulu, or English, verify freshness with live camera AI, and let an intelligent agent
                negotiate fair prices without revealing their confidential minimum rate.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onStartHackathonTour}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0B3B5B] hover:bg-[#092F49] text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  Start 3-Min Hackathon Demo
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onNavigateAuth}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0D1F2E] text-[#0B2334] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  Sign In / Register
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Kannada & Tulu Voice AI</span>
                <span aria-hidden="true">·</span>
                <span>Live Vision Freshness Grading</span>
                <span aria-hidden="true">·</span>
                <span>Zero-Waste Processor Routing</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[280px] lg:min-h-[420px] rounded-xl overflow-hidden border border-[#DCE7EC] dark:border-[#1B354B] bg-[#0B3B5B]">
                <img
                  src="/src/assets/images/hero_mangalore_harbor_1794821248243.jpg"
                  alt="Mangalore fishing harbor boats unloading fresh catch into iced crates at sunrise"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07131D]/85 via-[#07131D]/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <p className="text-xs font-medium text-teal-300">
                    Freshness Meets Fair Pricing. Zero Fish Wastage.
                  </p>
                  <p className="text-lg font-display font-semibold mt-0.5">
                    Direct Bunder & Malpe landings connected to coastal kitchens and marine processors
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Harbor Impact Strip below Hero Split */}
          <div
            id="impact"
            className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl p-5"
          >
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Active Fresh Lots</div>
              <div className="font-mono text-2xl font-bold tabular-nums text-[#0B2334] dark:text-white mt-1">
                {analytics?.summary.activeListingsCount ?? listings.length} lots
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Avg. Harbor Freshness</div>
              <div className="font-mono text-2xl font-bold tabular-nums text-[#16A34A] mt-1">
                {analytics?.summary.avgFreshnessScore ?? 89} / 100
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Fish Saved from Waste</div>
              <div className="font-mono text-2xl font-bold tabular-nums text-[#0D9488] mt-1">
                {analytics?.summary.totalKgSavedFromWaste ?? 139} kg
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Extra Fisherman Income</div>
              <div className="font-mono text-2xl font-bold tabular-nums text-[#EA580C] mt-1">
                ₹{(analytics?.summary.totalExtraIncomeInr ?? 14930).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </section>

        {/* Three Core Innovations */}
        <section id="innovations" className="border-t border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0B1926] py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B2334] dark:text-white">
                Three core innovations transforming coastal fisheries
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-2">
                Built around real harbor workflows in Dakshina Kannada—voice-first for fishermen,
                transparent for buyers, and circular for processors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl border border-[#DCE7EC] dark:border-[#1B354B] bg-[#F6FAFB] dark:bg-[#0D1F2E] space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#0D9488]/15 text-[#0D9488] flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-[#0B2334] dark:text-white">
                  01. Live AI Freshness Vision
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Captures live dockside photos with GPS & timestamp lock—preventing gallery spoofing—and
                  evaluates eye clarity, gill colour, and skin sheen on a 0–100 demo rubric.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[#DCE7EC] dark:border-[#1B354B] bg-[#F6FAFB] dark:bg-[#0D1F2E] space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#0B3B5B]/15 text-[#0B3B5B] dark:text-sky-300 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-[#0B2334] dark:text-white">
                  02. Confidential AI Negotiation
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Freshness-linked price decay updates rates automatically over time while deterministic
                  backend rules enforce the fisherman&apos;s hidden minimum acceptable price.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[#DCE7EC] dark:border-[#1B354B] bg-[#F6FAFB] dark:bg-[#0D1F2E] space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center">
                  <Recycle className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-[#0B2334] dark:text-white">
                  03. Zero-Waste Processor Routing
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Unsold catch approaching its freshness limit routes automatically to verified
                  dry-fish, fish-meal, and animal-feed makers with dockside safety checklists.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Live Harbor Marketplace Preview */}
        <section id="harbor-live" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B2334] dark:text-white">
                Fresh Mangalore landings available now
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Live server-computed prices updating with freshness and ice-box storage temperature.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onStartDemoRole('buyer')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B3B5B] dark:text-teal-300 hover:underline whitespace-nowrap"
            >
              Browse Full Marketplace
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {activeListings.map((lot) => (
              <div
                key={lot.id}
                className="bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <img
                    src={lot.imageUrl}
                    alt={lot.speciesName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {lot.locationName} · Grade {lot.freshnessGrade} ({lot.dynamicPricing.effectiveFreshnessScore}/100)
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#0B2334] dark:text-white mt-1">
                      {lot.speciesName}
                    </h3>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-[#DCE7EC] dark:border-[#1B354B] pt-3">
                    <div>
                      <span className="font-mono text-xl font-bold text-[#0B2334] dark:text-white">
                        ₹{lot.dynamicPricing.currentPrice}/kg
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {lot.availableQuantityKg} kg left
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartDemoRole('buyer')}
                      className="text-xs font-semibold text-[#EA580C] hover:underline whitespace-nowrap"
                    >
                      Make Offer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Role Launchers */}
        <section className="border-t border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0B1926] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <h2 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
                  Fair Price. Faster Sales. Less Waste.
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Switch instantly across Fisherman, Buyer, Processor, and Admin workspaces for the live demo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => onStartDemoRole('fisherman')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0B3B5B] text-white text-sm font-semibold hover:bg-[#092F49] transition-colors whitespace-nowrap"
                >
                  <Mic className="w-4 h-4" />
                  Fisherman View
                </button>
                <button
                  type="button"
                  onClick={() => onStartDemoRole('buyer')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] transition-colors whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Buyer Marketplace
                </button>
                <button
                  type="button"
                  onClick={() => onStartDemoRole('processor')}
                  className="px-4 py-2.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Processor View
                </button>
                <button
                  type="button"
                  onClick={() => onStartDemoRole('admin')}
                  className="px-4 py-2.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Admin & Impact
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#DCE7EC] dark:border-[#1B354B] py-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>FishFresh AI · Mangalore, Karnataka · Boat to Plate With Zero Waste</span>
          <span>Hackathon Demonstration Platform · Simulated payments & configurable freshness thresholds</span>
        </div>
      </footer>
    </div>
  );
}
