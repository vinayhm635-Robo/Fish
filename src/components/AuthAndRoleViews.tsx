import React, { useState } from 'react';
import { Anchor, ArrowLeft, Compass, Factory, ShieldCheck, Store, Truck } from 'lucide-react';
import type { User, UserRole } from '../types/domain';
import { api } from '../services/api';

interface AuthViewProps {
  onAuthenticated: (user: User) => void;
  onBack: () => void;
  initialRole?: UserRole;
}

const ROLE_CARDS: Array<{
  role: UserRole;
  title: string;
  subtitle: string;
  samplePhone: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    role: 'fisherman',
    title: 'Fisherman',
    subtitle: 'Voice listing in Kannada/Tulu, live camera freshness score, confidential floor.',
    samplePhone: '+91 98451 22410',
    icon: Anchor,
  },
  {
    role: 'buyer',
    title: 'Buyer (Hotel / Restaurant / Retail)',
    subtitle: 'Discover Mangalore catches, track decay curves, negotiate with AI agent.',
    samplePhone: '+91 99001 44520',
    icon: Store,
  },
  {
    role: 'processor',
    title: 'Fish Processor (Zero-Waste)',
    subtitle: 'Dry-fish, fish-meal & animal-feed recovery batches with safety checks.',
    samplePhone: '+91 98802 66118',
    icon: Factory,
  },
  {
    role: 'admin',
    title: 'Harbor Admin',
    subtitle: 'Verify fishermen & processors, configure pricing rules, audit transactions.',
    samplePhone: '+91 97410 11009',
    icon: ShieldCheck,
  },
  {
    role: 'delivery',
    title: 'Delivery Partner (Expansion)',
    subtitle: 'Cold-chain insulated pickup and restaurant delivery dispatch around Mangalore.',
    samplePhone: '+91 96115 88304',
    icon: Truck,
  },
];

export function RoleSelectionView({
  onSelectRole,
  onBack,
}: {
  onSelectRole: (role: UserRole) => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F6FAFB] dark:bg-[#07131D] text-[#0B2334] dark:text-[#EAF3F8] py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#0B3B5B] dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </button>

        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-[#0B2334] dark:text-white">
            Select your FishFresh AI workspace role
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Choose a coastal supply-chain role to sign in with seeded Mangalore demo credentials or
            register a new mobile account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.role}
                type="button"
                onClick={() => onSelectRole(card.role)}
                className="text-left p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] hover:border-[#0D9488] transition-colors flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0B3B5B]/10 dark:bg-teal-500/15 text-[#0B3B5B] dark:text-teal-300 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="font-display text-lg font-semibold text-[#0B2334] dark:text-white">
                    {card.title}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {card.subtitle}
                  </p>
                </div>
                <div className="text-xs font-mono text-[#0D9488] pt-3 border-t border-[#DCE7EC] dark:border-[#1B354B]">
                  Enter {card.title} Dashboard →
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AuthView({ onAuthenticated, onBack, initialRole = 'fisherman' }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [phone, setPhone] = useState('+91 98451 22410');
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('Mangalore Bunder Harbor');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('4829');
  const [gpsStatus, setGpsStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRolePreset = (selectedRole: UserRole) => {
    setRole(selectedRole);
    const match = ROLE_CARDS.find((c) => c.role === selectedRole);
    if (match && mode === 'login') {
      setPhone(match.samplePhone);
    }
  };

  const handleRequestGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation unavailable in this browser; using Mangalore Harbor defaults.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus(
          `GPS locked (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`
        );
      },
      () => {
        setGpsStatus('Location permission declined; using Mangalore coastal default.');
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('Please enter your 10-digit mobile number.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Please enter your full name or business name.');
      return;
    }

    if (!otpRequested) {
      setOtpRequested(true);
      return;
    }

    if (otpCode.trim().length < 4) {
      setError('Enter the 4-digit demo verification OTP.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login({
        phone: phone.trim(),
        role,
        name: mode === 'register' ? name.trim() : undefined,
        locationName,
      });
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6FAFB] dark:bg-[#07131D] text-[#0B2334] dark:text-[#EAF3F8] py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#0B3B5B] dark:hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <span className="font-display font-bold text-[#0B3B5B] dark:text-white">FishFresh AI</span>
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
            {mode === 'login' ? 'Mobile Number Sign In' : 'Create Coastal Account'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Role-based access for Mangalore fishermen, buyers, processors, and harbor admins.
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setOtpRequested(false);
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-[#0B3B5B] text-[#0B2334] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Sign In (Demo Accounts)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setPhone('+91 ');
              setOtpRequested(false);
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-[#0B3B5B] text-[#0B2334] dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            New Registration
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Account Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLE_CARDS.map((c) => (
                <button
                  key={c.role}
                  type="button"
                  onClick={() => handleRolePreset(c.role)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left capitalize transition-colors ${
                    role === c.role
                      ? 'border-[#0B3B5B] bg-[#0B3B5B]/10 text-[#0B3B5B] dark:border-teal-400 dark:bg-teal-500/15 dark:text-teal-200'
                      : 'border-[#DCE7EC] dark:border-[#1B354B] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {c.role}
                </button>
              ))}
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Full Name or Business Name
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mohan Kharvi / Taj Coastal Kitchen"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-phone"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Mobile Number
            </label>
            <input
              id="auth-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98451 22410"
              className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-location"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Mangalore Harbor / Area
              </label>
              <div className="flex gap-2">
                <input
                  id="auth-location"
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                <button
                  type="button"
                  onClick={handleRequestGps}
                  className="px-3 py-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Compass className="w-3.5 h-3.5" />
                  GPS
                </button>
              </div>
              {gpsStatus && (
                <p className="text-xs text-[#0D9488] mt-1">{gpsStatus}</p>
              )}
            </div>
          )}

          {otpRequested && (
            <div className="p-3.5 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B] space-y-1.5">
              <label
                htmlFor="auth-otp"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Demo SMS OTP Verification (Pre-filled demo code: 4829)
              </label>
              <input
                id="auth-otp"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tracking-widest rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#0D1F2E]"
              />
            </div>
          )}

          {error && (
            <div role="alert" className="text-xs text-[#DC2626] font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-[#0B3B5B] hover:bg-[#092F49] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {loading
              ? 'Verifying...'
              : otpRequested
                ? 'Verify OTP & Enter Workspace'
                : 'Send Demo OTP'}
          </button>
        </form>
      </div>
    </div>
  );
}
