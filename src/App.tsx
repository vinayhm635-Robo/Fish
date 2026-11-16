import React, { useCallback, useEffect, useState } from 'react';
import {
  Anchor,
  BarChart3,
  Bell,
  Factory,
  LogOut,
  Menu,
  Moon,
  PlayCircle,
  Recycle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  X,
} from 'lucide-react';
import type {
  Delivery,
  FishSpecies,
  Negotiation,
  Order,
  Payment,
  PricingRule,
  ProcessorRequest,
  PublicFishListing,
  TemperatureReading,
  User,
  UserRole,
} from './types/domain';
import { api, type AnalyticsResponse } from './services/api';
import { LandingPage } from './components/LandingPage';
import { AuthView, RoleSelectionView } from './components/AuthAndRoleViews';
import { FishermanFlow, type FishermanPage } from './components/FishermanFlow';
import { BuyerFlow, type BuyerPage } from './components/BuyerFlow';
import { ProcessorAndZeroWaste, type ProcessorPage } from './components/ProcessorAndZeroWaste';
import {
  AdminDashboardView,
  AnalyticsAndImpactView,
  ProfileAndSettingsView,
} from './components/AdminAnalyticsProfile';

type AppPage =
  | 'landing'
  | 'auth'
  | 'roles'
  | FishermanPage
  | BuyerPage
  | ProcessorPage
  | 'admin'
  | 'analytics'
  | 'profile';

const HACKATHON_DEMO_STEPS = [
  { step: 1, label: 'Fisherman Voice Listing (Kannada/Tulu)', page: 'fisherman-create' as AppPage, role: 'fisherman' as UserRole },
  { step: 2, label: 'Live Camera & AI Freshness Vision', page: 'fisherman-camera' as AppPage, role: 'fisherman' as UserRole },
  { step: 3, label: 'Fair Price Band & Confidential Floor', page: 'fisherman-listings' as AppPage, role: 'fisherman' as UserRole },
  { step: 4, label: 'Buyer Marketplace & Price-Decay Graph', page: 'marketplace' as AppPage, role: 'buyer' as UserRole },
  { step: 5, label: 'AI Buyer Negotiation & Order Confirm', page: 'negotiation' as AppPage, role: 'buyer' as UserRole },
  { step: 6, label: 'Zero-Waste Processor Routing', page: 'zero-waste' as AppPage, role: 'processor' as UserRole },
  { step: 7, label: 'Mangalore Impact & Map Analytics', page: 'analytics' as AppPage, role: 'admin' as UserRole },
];

export default function App() {
  const [page, setPage] = useState<AppPage>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'marketplace';
    }
    return 'landing';
  });

  const [darkMode, setDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [speciesList, setSpeciesList] = useState<FishSpecies[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [listings, setListings] = useState<Array<PublicFishListing & { distanceKm?: number }>>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [processorRequests, setProcessorRequests] = useState<ProcessorRequest[]>([]);
  const [temperatureReadings, setTemperatureReadings] = useState<TemperatureReading[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; label: string }>({
    lat: 12.8698,
    lng: 74.8431,
    label: 'Hampankatta, Mangalore',
  });
  const [showNotifs, setShowNotifs] = useState(false);
  const [showDemoGuide, setShowDemoGuide] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const refreshData = useCallback(
    async (userOverride?: User | null) => {
      const activeUser = userOverride !== undefined ? userOverride : currentUser;
      try {
        const [uRes, spRes, lstRes, negRes, ordRes, procRes, tempRes, anaRes] = await Promise.all([
          api.getUsers(),
          api.getSpecies(),
          api.getListings({
            viewerUserId: activeUser?.id,
            viewerRole: activeUser?.role,
            lat: userLocation.lat,
            lng: userLocation.lng,
          }),
          api.getNegotiations(),
          api.getOrders(),
          api.getProcessorRequests(),
          api.getTemperatureReadings(),
          api.getAnalytics(),
        ]);

        setUsers(uRes.users);
        setSpeciesList(spRes.species);
        setPricingRules(spRes.pricingRules);
        setListings(lstRes.listings);
        setNegotiations(negRes.negotiations);
        setOrders(ordRes.orders);
        setPayments(ordRes.payments);
        setDeliveries(ordRes.deliveries);
        setProcessorRequests(procRes.requests);
        setTemperatureReadings(tempRes.readings);
        setAnalytics(anaRes);

        if (!selectedListingId && lstRes.listings.length > 0) {
          setSelectedListingId(lstRes.listings[0].id);
        }
        // If autostart=1 was passed and no user yet, pick buyer demo account automatically
        if (!activeUser && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('autostart') === '1') {
            const demoBuyer = uRes.users.find((u) => u.role === 'buyer') ?? uRes.users[0];
            if (demoBuyer) setCurrentUser(demoBuyer);
          }
        }
      } catch (err) {
        console.error('Failed loading FishFresh AI workspace:', err);
      } finally {
        setLoading(false);
      }
    },
    [currentUser, selectedListingId, userLocation.lat, userLocation.lng]
  );

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const defaultPageForRole = (role: UserRole): AppPage => {
    if (role === 'fisherman') return 'fisherman-dashboard';
    if (role === 'buyer' || role === 'delivery') return 'marketplace';
    if (role === 'processor') return 'processor-dashboard';
    return 'admin';
  };

  const switchRoleQuick = async (role: UserRole, targetPage?: AppPage) => {
    const res = await api.login({ role });
    setCurrentUser(res.user);
    setPage(targetPage ?? defaultPageForRole(role));
    await refreshData(res.user);
  };

  const handleRequestGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: `GPS (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
        });
      },
      () => {}
    );
  };

  const handleResetDemo = async () => {
    await api.resetDemo();
    await refreshData();
  };

  // Unauthenticated / Fullscreen Pages
  if (page === 'landing') {
    return (
      <LandingPage
        analytics={analytics}
        listings={listings}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
        onNavigateAuth={() => setPage('auth')}
        onNavigateRoles={() => setPage('roles')}
        onStartDemoRole={(role) => void switchRoleQuick(role)}
        onStartHackathonTour={() => {
          setShowDemoGuide(true);
          void switchRoleQuick('fisherman', 'fisherman-create');
        }}
      />
    );
  }

  if (page === 'roles') {
    return (
      <RoleSelectionView
        onBack={() => setPage('landing')}
        onSelectRole={(role) => void switchRoleQuick(role)}
      />
    );
  }

  if (page === 'auth') {
    return (
      <AuthView
        onBack={() => setPage('landing')}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setPage(defaultPageForRole(user.role));
          void refreshData(user);
        }}
      />
    );
  }

  const activeUser: User = currentUser ??
    users.find((u) => u.role === 'buyer') ?? {
      id: 'usr-buyer-1',
      name: 'Demo User',
      phone: '+91 99001 44520',
      role: 'buyer',
      verified: true,
      locationName: 'Mangalore',
      lat: 12.8698,
      lng: 74.8431,
      createdAt: new Date().toISOString(),
    };

  const navItems: Array<{
    id: AppPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'fisherman-dashboard', label: 'Fisherman Hub', icon: Anchor },
    { id: 'marketplace', label: 'Marketplace', icon: Store },
    { id: 'orders', label: 'Orders & UPI', icon: ShoppingBag },
    { id: 'processor-dashboard', label: 'Processor', icon: Factory },
    { id: 'zero-waste', label: 'Zero Waste', icon: Recycle },
    { id: 'analytics', label: 'Impact & Map', icon: BarChart3 },
    { id: 'admin', label: 'Admin Console', icon: ShieldCheck },
    { id: 'profile', label: 'Settings', icon: Settings },
  ];

  const isFishermanPage = page.startsWith('fisherman-');
  const isBuyerPage =
    page === 'marketplace' ||
    page === 'product-detail' ||
    page === 'negotiation' ||
    page === 'orders';
  const isProcessorPage = page === 'processor-dashboard' || page === 'zero-waste';

  const notifications = analytics?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#F6FAFB] dark:bg-[#07131D] text-[#0B2334] dark:text-[#EAF3F8] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white dark:bg-[#0D1F2E] border-r border-[#DCE7EC] dark:border-[#1B354B]">
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#DCE7EC] dark:border-[#1B354B]">
          <button
            type="button"
            onClick={() => setPage('landing')}
            className="font-display text-lg font-bold tracking-tight text-[#0B3B5B] dark:text-white"
          >
            FishFresh AI
          </button>
        </div>

        <div className="p-4 border-b border-[#DCE7EC] dark:border-[#1B354B] space-y-2">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Hackathon Role Switcher
          </div>
          <select
            aria-label="Switch active demo user role"
            value={activeUser.role}
            onChange={(e) => void switchRoleQuick(e.target.value as UserRole)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-[#F6FAFB] dark:bg-[#07131D] capitalize"
          >
            <option value="fisherman">Fisherman · Ramesh</option>
            <option value="buyer">Buyer · Machali Kitchen</option>
            <option value="processor">Processor · Karavali Co-op</option>
            <option value="admin">Admin · Dr. Kavitha</option>
            <option value="delivery">Delivery · Prashanth</option>
          </select>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              page === item.id ||
              (item.id === 'fisherman-dashboard' && isFishermanPage) ||
              (item.id === 'marketplace' &&
                (page === 'marketplace' || page === 'product-detail' || page === 'negotiation'));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0B3B5B] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#DCE7EC] dark:border-[#1B354B] space-y-2">
          <button
            type="button"
            onClick={() => setShowDemoGuide((s) => !s)}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#EA580C]/10 text-[#EA580C] text-xs font-semibold hover:bg-[#EA580C]/20"
          >
            <PlayCircle className="w-4 h-4" />
            3-Min Hackathon Guide
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentUser(null);
              setPage('landing');
            }}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit to Landing
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 dark:bg-[#0D1F2E]/95 backdrop-blur border-b border-[#DCE7EC] dark:border-[#1B354B] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle workspace menu"
              className="lg:hidden p-1.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 truncate min-w-0">
              <span className="font-semibold text-[#0B2334] dark:text-white">{activeUser.name}</span>
              <span className="mx-1.5 text-slate-400">·</span>
              <span className="capitalize">{activeUser.role}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDemoGuide((v) => !v)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-semibold text-[#EA580C] whitespace-nowrap"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Demo Walkthrough
            </button>

            <button
              type="button"
              onClick={() => setShowNotifs((v) => !v)}
              aria-label="Open notifications"
              className="relative p-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-slate-600 dark:text-slate-300"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EA580C] text-white text-[10px] font-mono flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-slate-600 dark:text-slate-300"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-[#0D1F2E] border-b border-[#DCE7EC] dark:border-[#1B354B] p-4 space-y-3">
            <select
              aria-label="Switch mobile active role"
              value={activeUser.role}
              onChange={(e) => {
                setMobileMenuOpen(false);
                void switchRoleQuick(e.target.value as UserRole);
              }}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-[#F6FAFB] dark:bg-[#07131D]"
            >
              <option value="fisherman">Fisherman · Ramesh</option>
              <option value="buyer">Buyer · Machali Kitchen</option>
              <option value="processor">Processor · Karavali Co-op</option>
              <option value="admin">Admin · Dr. Kavitha</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className="px-3 py-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-medium text-left"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Panel */}
        {showNotifs && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Harbor & Negotiation Alerts</span>
              <button type="button" onClick={() => setShowNotifs(false)} className="text-slate-500">
                Close
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="p-2.5 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] text-xs">
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-slate-500 dark:text-slate-400">{n.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3-Minute Hackathon Demo Sequencer */}
        {showDemoGuide && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#0D9488] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#0D9488]">
                3-Minute Hackathon Demonstration Sequence
              </div>
              <button
                type="button"
                onClick={() => setShowDemoGuide(false)}
                className="text-xs text-slate-500 hover:underline shrink-0"
              >
                Hide
              </button>
            </div>
            <div className="flex sm:flex-wrap gap-2 overflow-x-auto pb-1 sm:pb-0">
              {HACKATHON_DEMO_STEPS.map((st) => (
                <button
                  key={st.step}
                  type="button"
                  onClick={() => void switchRoleQuick(st.role, st.page)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    page === st.page
                      ? 'bg-[#0B3B5B] text-white border-[#0B3B5B]'
                      : 'border-[#DCE7EC] dark:border-[#1B354B] hover:border-[#0D9488]'
                  }`}
                >
                  {st.step}. {st.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="space-y-4 py-10">
              <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {isFishermanPage && (
                <FishermanFlow
                  page={page as FishermanPage}
                  onNavigate={(p) => setPage(p)}
                  user={activeUser}
                  speciesList={speciesList}
                  listings={listings}
                  orders={orders}
                  processorRequests={processorRequests}
                  temperatureReadings={temperatureReadings}
                  onRefreshData={refreshData}
                />
              )}

              {isBuyerPage && (
                <BuyerFlow
                  page={page as BuyerPage}
                  onNavigate={(p) => setPage(p)}
                  user={activeUser}
                  speciesList={speciesList}
                  listings={listings}
                  negotiations={negotiations}
                  orders={orders}
                  payments={payments}
                  deliveries={deliveries}
                  selectedListingId={selectedListingId}
                  onSelectListing={(id) => setSelectedListingId(id)}
                  onRefreshData={refreshData}
                />
              )}

              {isProcessorPage && (
                <ProcessorAndZeroWaste
                  page={page as ProcessorPage}
                  onNavigate={(p) => setPage(p)}
                  user={activeUser}
                  requests={processorRequests}
                  listings={listings}
                  onRefreshData={refreshData}
                />
              )}

              {page === 'admin' && (
                <AdminDashboardView
                  analytics={analytics}
                  users={users}
                  speciesList={speciesList}
                  pricingRules={pricingRules}
                  listings={listings}
                  onRefreshData={refreshData}
                />
              )}

              {page === 'analytics' && (
                <AnalyticsAndImpactView
                  analytics={analytics}
                  listings={listings}
                  users={users}
                  processorRequests={processorRequests}
                  userLocation={userLocation}
                  onRequestGps={handleRequestGps}
                  onSelectListing={(lot) => {
                    setSelectedListingId(lot.id);
                    setPage('product-detail');
                  }}
                />
              )}

              {page === 'profile' && (
                <ProfileAndSettingsView
                  user={activeUser}
                  darkMode={darkMode}
                  onToggleTheme={() => setDarkMode((d) => !d)}
                  userLocation={userLocation}
                  onRequestGps={handleRequestGps}
                  onResetDemo={handleResetDemo}
                  onRefreshData={refreshData}
                  onLogout={() => {
                    setCurrentUser(null);
                    setPage('landing');
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Compact <= 56px, well under 15% mobile height cap) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white dark:bg-[#0D1F2E] border-t border-[#DCE7EC] dark:border-[#1B354B] grid grid-cols-5"
      >
        {[
          { id: 'fisherman-dashboard' as AppPage, label: 'Catch', icon: Anchor },
          { id: 'marketplace' as AppPage, label: 'Market', icon: Store },
          { id: 'orders' as AppPage, label: 'Orders', icon: ShoppingBag },
          { id: 'zero-waste' as AppPage, label: 'ZeroWaste', icon: Recycle },
          { id: 'analytics' as AppPage, label: 'Impact', icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-[#0B3B5B] dark:text-teal-300 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
