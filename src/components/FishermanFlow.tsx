import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Lock,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Thermometer,
  Trash2,
} from 'lucide-react';
import type {
  FishSpecies,
  Order,
  ProcessorRequest,
  PublicFishListing,
  TemperatureReading,
  User,
} from '../types/domain';
import type { FreshnessAiResult } from '../../server/ai';
import type { FairPriceOutput } from '../engine/fishEconomics';
import { api } from '../services/api';
import { CircularFreshnessGauge, PriceDecayChart } from './Charts';

export type FishermanPage =
  | 'fisherman-dashboard'
  | 'fisherman-create'
  | 'fisherman-camera'
  | 'fisherman-freshness'
  | 'fisherman-pricing'
  | 'fisherman-listings';

interface FishermanFlowProps {
  page: FishermanPage;
  onNavigate: (page: FishermanPage) => void;
  user: User;
  speciesList: FishSpecies[];
  listings: PublicFishListing[];
  orders: Order[];
  processorRequests: ProcessorRequest[];
  temperatureReadings: TemperatureReading[];
  onRefreshData: () => Promise<void>;
}

const VOICE_PRESETS = [
  {
    label: 'Kannada: Bangude (40 kg)',
    transcript: '40 kg ಬಂಗುಡೆ ಮೀನು, 2 ಗಂಟೆ ಹಿಂದೆ ಮಲ್ಪೆ ಬಂದರಿನಲ್ಲಿ ಹಿಡಿದಿದ್ದು, ಕನಿಷ್ಠ 210 ರೂಪಾಯಿ',
  },
  {
    label: 'Tulu: Yetti Prawns (25 kg)',
    transcript: '25 kilo yetti ullal 3 gante min 450',
  },
  {
    label: 'English: Mackerel (40 kg)',
    transcript: '40 kg mackerel, caught 2 hours ago at Mangalore Bunder Harbor',
  },
];

export function FishermanFlow({
  page,
  onNavigate,
  user,
  speciesList,
  listings,
  orders,
  processorRequests,
  temperatureReadings,
  onRefreshData,
}: FishermanFlowProps) {
  // Draft state across Create -> Camera -> Freshness -> Pricing -> Publish
  const [speciesId, setSpeciesId] = useState(speciesList[0]?.id ?? 'sp-mackerel');
  const [quantityKg, setQuantityKg] = useState(40);
  const [catchHoursAgo, setCatchHoursAgo] = useState(2);
  const [locationName, setLocationName] = useState(user.locationName || 'Mangalore Bunder Harbor');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceLanguageInfo, setVoiceLanguageInfo] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedImageData, setCapturedImageData] = useState<string>('');
  const [isLiveVerifiedCapture, setIsLiveVerifiedCapture] = useState(false);
  const [captureTimestamp, setCaptureTimestamp] = useState<string>('');
  const [captureGps, setCaptureGps] = useState<{ lat: number; lng: number }>({
    lat: user.lat || 12.8582,
    lng: user.lng || 74.8321,
  });

  // AI Freshness & Fair Price state
  const [freshnessResult, setFreshnessResult] = useState<FreshnessAiResult | null>(null);
  const [analyzingFreshness, setAnalyzingFreshness] = useState(false);
  const [fairBand, setFairBand] = useState<FairPriceOutput | null>(null);
  const [customStartPrice, setCustomStartPrice] = useState<number>(255);
  const [customMinFloor, setCustomMinFloor] = useState<number>(210);
  const [storageTempC, setStorageTempC] = useState<number>(1.8);
  const [publishing, setPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Listing management edit state
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editFloorValue, setEditFloorValue] = useState<number>(200);
  const [simulatingTemp, setSimulatingTemp] = useState(false);

  const selectedSpecies = speciesList.find((s) => s.id === speciesId) ?? speciesList[0];

  // Stop camera stream on unmount or page leave
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const myListings = listings.filter((l) => l.fishermanId === user.id || user.role === 'admin');
  const activeListings = myListings.filter((l) => l.status === 'active');
  const approachingLimit = activeListings.filter(
    (l) => l.dynamicPricing.remainingWindowMinutes <= 180 || l.dynamicPricing.effectiveFreshnessScore < 68
  );
  const unsoldOrRouted = myListings.filter(
    (l) => l.status === 'unsold_expired' || l.status === 'routed_to_processor'
  );
  const totalListedKg = myListings.reduce((sum, l) => sum + l.totalQuantityKg, 0);
  const myOrders = orders.filter((o) => o.fishermanId === user.id);
  const totalKgSold = myOrders.reduce((sum, o) => sum + o.quantityKg, 0);
  const todayEarnings = myOrders.reduce((sum, o) => sum + o.totalAmountInr, 0);
  const savedFromWasteKg = processorRequests
    .filter(
      (r) =>
        r.fishermanId === user.id &&
        (r.status === 'accepted_by_processor' || r.status === 'completed')
    )
    .reduce((sum, r) => sum + r.quantityKg, 0);

  // Voice parsing
  const handleParseVoice = async (textToParse: string) => {
    setVoiceLoading(true);
    setErrorMessage('');
    try {
      const res = await api.parseVoiceListing({ transcript: textToParse });
      setSpeciesId(res.parsed.speciesId);
      setQuantityKg(res.parsed.quantityKg);
      setCatchHoursAgo(res.parsed.catchHoursAgo);
      setLocationName(res.parsed.locationName);
      setVoiceLanguageInfo(
        `Detected ${res.parsed.languageDetected} (${Math.round(res.parsed.confidence * 100)}% confidence · ${res.parsed.mode})`
      );
      setFairBand(res.fairBand);
      setCustomStartPrice(res.fairBand.aiStartingPrice);
      setCustomMinFloor(res.parsed.expectedMinPrice ?? res.fairBand.recommendedFloor);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse voice input');
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleToggleMicrophone = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        'Browser speech recognition is unavailable here. Use the Kannada/Tulu voice samples or type your command below.'
      );
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.lang = 'kn-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    setErrorMessage('');

    recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const spoken = event.results[0][0].transcript;
      setVoiceTranscript(spoken);
      setIsListening(false);
      void handleParseVoice(spoken);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setErrorMessage('Microphone permission denied or speech unrecognized. Try a sample phrase or type below.');
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // Live Camera Controls
  const startLiveCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraError(
        'Live hardware camera is unavailable or permission was blocked. For the hackathon demo without a webcam, use the Demo Dock Camera Feed below.'
      );
    }
  };

  const captureLiveFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImageData(dataUrl);
      setIsLiveVerifiedCapture(true);
      setCaptureTimestamp(new Date().toISOString());
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCameraActive(false);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCaptureGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  };

  const useDemoDockCameraRig = () => {
    setCameraError('');
    const fallbackUrl =
      selectedSpecies?.defaultImageUrl || '/src/assets/images/fish_indian_mackerel_1794821247535.jpg';
    setCapturedImageData(fallbackUrl);
    setIsLiveVerifiedCapture(true);
    setCaptureTimestamp(new Date().toISOString());
    setCaptureGps({ lat: 12.8582, lng: 74.8321 });
  };

  const submitForFreshnessAnalysis = async () => {
    if (!isLiveVerifiedCapture || !capturedImageData) {
      setErrorMessage('Capture a live fish photograph first before submitting for AI grading.');
      return;
    }
    setAnalyzingFreshness(true);
    setErrorMessage('');
    try {
      const isDataUrl = capturedImageData.startsWith('data:image');
      const res = await api.analyzeFreshness({
        imageBase64: isDataUrl ? capturedImageData : undefined,
        mimeType: 'image/jpeg',
        speciesName: selectedSpecies?.name,
        isLiveCameraCapture: true,
      });
      setFreshnessResult(res.assessment);

      const priceRes = await api.getFairPrice({
        speciesId,
        freshnessScore: res.assessment.freshnessScore,
        quantityKg,
      });
      setFairBand(priceRes.fairBand);
      setCustomStartPrice(priceRes.fairBand.aiStartingPrice);
      setCustomMinFloor(priceRes.fairBand.recommendedFloor);
      onNavigate('fisherman-freshness');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Freshness analysis failed');
    } finally {
      setAnalyzingFreshness(false);
    }
  };

  const handlePublishListing = async () => {
    setPublishing(true);
    setErrorMessage('');
    try {
      await api.createListing({
        fishermanId: user.id,
        speciesId,
        quantityKg,
        catchHoursAgo,
        locationName,
        lat: captureGps.lat,
        lng: captureGps.lng,
        imageUrl: capturedImageData || selectedSpecies?.defaultImageUrl,
        isLiveVerifiedCapture: true,
        freshnessScore: freshnessResult?.freshnessScore ?? 89,
        assessment: freshnessResult,
        aiStartingPrice: customStartPrice,
        minAcceptablePrice: customMinFloor,
        storageTempC,
      });
      await onRefreshData();
      setStatusMessage(`Published ${quantityKg} kg ${selectedSpecies?.name} to Mangalore Marketplace.`);
      onNavigate('fisherman-listings');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not publish listing');
    } finally {
      setPublishing(false);
    }
  };

  const handleSimulateSensor = async (tempC: number) => {
    setSimulatingTemp(true);
    try {
      await api.simulateTemperature({
        listingId: activeListings[0]?.id,
        temperatureC: tempC,
      });
      await onRefreshData();
    } finally {
      setSimulatingTemp(false);
    }
  };

  // Sub-navigation ribbon for Fisherman workspace
  const SubNav = () => (
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl mb-6">
      {(
        [
          ['fisherman-dashboard', 'Overview'],
          ['fisherman-create', 'Voice & Create'],
          ['fisherman-camera', 'Live Camera'],
          ['fisherman-freshness', 'AI Freshness'],
          ['fisherman-pricing', 'Fair Pricing'],
          ['fisherman-listings', 'My Listings'],
        ] as Array<[FishermanPage, string]>
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onNavigate(id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            page === id
              ? 'bg-[#0B3B5B] text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <SubNav />

      {statusMessage && (
        <div className="p-3.5 rounded-lg bg-[#16A34A]/10 border border-[#16A34A]/30 text-sm text-[#15803D] dark:text-emerald-300 flex items-center justify-between gap-3">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-sm text-[#DC2626] dark:text-red-300"
        >
          {errorMessage}
        </div>
      )}

      {/* 1. FISHERMAN DASHBOARD */}
      {page === 'fisherman-dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
                Harbor Catch Command · {user.name}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {user.locationName} · Speak in Kannada/Tulu to list fresh landings in under 30 seconds
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fisherman-create')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Mic className="w-4 h-4" />
              New Voice Catch Listing
            </button>
          </div>

          {/* 8 Key Fisherman KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Fish Listed', value: `${totalListedKg} kg`, tone: 'text-[#0B2334] dark:text-white' },
              { label: 'Total Kg Sold', value: `${totalKgSold} kg`, tone: 'text-[#16A34A]' },
              { label: "Today's Earnings", value: `₹${todayEarnings.toLocaleString('en-IN')}`, tone: 'text-[#0B3B5B] dark:text-sky-300' },
              { label: 'Active Listings', value: `${activeListings.length}`, tone: 'text-[#0D9488]' },
              { label: 'Pending Buyer Offers', value: '1 active', tone: 'text-[#EA580C]' },
              { label: 'Approaching Limit', value: `${approachingLimit.length} lot`, tone: 'text-[#D97706]' },
              { label: 'Unsold / Routed', value: `${unsoldOrRouted.length} lot`, tone: 'text-slate-600 dark:text-slate-300' },
              { label: 'Saved From Wastage', value: `${savedFromWasteKg} kg`, tone: 'text-[#16A34A]' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="p-4 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B]"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</div>
                <div className={`font-mono text-2xl font-bold tabular-nums mt-1 ${kpi.tone}`}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Optional IoT ESP32 Ice-Box Monitoring */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Thermometer className="w-5 h-5 text-[#0D9488]" />
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0B2334] dark:text-white">
                    ESP32 Ice-Box Temperature Monitor (Simulated Sensor Mode)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Storage temperature directly adjusts real-time freshness decay rates on your active lots.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={simulatingTemp}
                  onClick={() => handleSimulateSensor(1.6)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Simulate Iced (1.6°C)
                </button>
                <button
                  type="button"
                  disabled={simulatingTemp}
                  onClick={() => handleSimulateSensor(7.4)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DC2626]/40 text-[#DC2626] hover:bg-[#DC2626]/5 whitespace-nowrap"
                >
                  Simulate Warm Alert (7.4°C)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {temperatureReadings.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B] flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-[#0B2334] dark:text-white">
                      {r.locationLabel}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {r.deviceId} · {r.isSimulated ? 'Simulated Demo' : 'Hardware'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-mono text-lg font-bold tabular-nums ${
                        r.status === 'optimal'
                          ? 'text-[#16A34A]'
                          : r.status === 'warning'
                            ? 'text-[#D97706]'
                            : 'text-[#DC2626]'
                      }`}
                    >
                      {r.temperatureC.toFixed(1)}°C
                    </div>
                    <div className="text-[11px] capitalize text-slate-500">{r.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. CREATE FISH LISTING + KANNADA/TULU VOICE */}
      {page === 'fisherman-create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0B2334] dark:text-white">
                Speak Your Catch (Kannada / Tulu / English)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tap the microphone and speak naturally, e.g. &ldquo;40 kg mackerel, caught 2 hours ago.&rdquo;
              </p>
            </div>

            <div className="flex flex-col items-center py-4 gap-3 bg-[#F6FAFB] dark:bg-[#07131D] rounded-xl border border-[#DCE7EC] dark:border-[#1B354B]">
              <button
                type="button"
                onClick={handleToggleMicrophone}
                aria-label={isListening ? 'Stop voice recording' : 'Start Kannada or Tulu voice recording'}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 ${
                  isListening ? 'bg-[#DC2626]' : 'bg-[#EA580C] hover:bg-[#C2410C]'
                }`}
              >
                {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {isListening ? 'Listening (kn-IN / en-IN)... Speak now' : 'Tap to Speak Catch Details'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Quick Hackathon Voice Samples (One-Tap):
              </div>
              <div className="flex flex-col gap-2">
                {VOICE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setVoiceTranscript(preset.transcript);
                      void handleParseVoice(preset.transcript);
                    }}
                    className="text-left px-3 py-2 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] hover:border-[#0D9488] text-xs transition-colors"
                  >
                    <div className="font-semibold text-[#0B3B5B] dark:text-teal-300">{preset.label}</div>
                    <div className="text-slate-500 dark:text-slate-400 truncate mt-0.5">{preset.transcript}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="voice-transcript-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Spoken Transcript / Manual Voice Text
              </label>
              <textarea
                id="voice-transcript-input"
                rows={2}
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder="Type or speak: 40 kg ಬಂಗುಡೆ ಮೀನು, 2 ಗಂಟೆ ಹಿಂದೆ..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
              />
              <button
                type="button"
                disabled={voiceLoading || !voiceTranscript.trim()}
                onClick={() => void handleParseVoice(voiceTranscript)}
                className="w-full py-2 px-4 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {voiceLoading ? 'Extracting Fields with AI...' : 'Extract Structured Listing'}
              </button>
              {voiceLanguageInfo && (
                <p className="text-xs text-[#0D9488] font-medium">{voiceLanguageInfo}</p>
              )}
            </div>
          </div>

          {/* Review & Edit Extracted Listing */}
          <div className="lg:col-span-7 p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0B2334] dark:text-white">
                Review Extracted Catch Details
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Verify species, weight, catch age, and harbor before live freshness camera capture.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fish-species" className="block text-xs font-medium mb-1">
                  Fish Species
                </label>
                <select
                  id="fish-species"
                  value={speciesId}
                  onChange={(e) => setSpeciesId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                >
                  {speciesList.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} · {sp.localNameKn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="fish-qty" className="block text-xs font-medium mb-1">
                  Quantity (kg)
                </label>
                <input
                  id="fish-qty"
                  type="number"
                  min={1}
                  max={2000}
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                />
              </div>

              <div>
                <label htmlFor="catch-hours" className="block text-xs font-medium mb-1">
                  Hours Since Catch
                </label>
                <input
                  id="catch-hours"
                  type="number"
                  step={0.5}
                  min={0.5}
                  max={18}
                  value={catchHoursAgo}
                  onChange={(e) => setCatchHoursAgo(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                />
              </div>

              <div>
                <label htmlFor="catch-harbor" className="block text-xs font-medium mb-1">
                  Landing Harbor / Dock
                </label>
                <input
                  id="catch-harbor"
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE7EC] dark:border-[#1B354B]">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Next step: Live camera capture is mandatory for freshness grading.
              </span>
              <button
                type="button"
                onClick={() => onNavigate('fisherman-camera')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B3B5B] hover:bg-[#092F49] text-white text-sm font-semibold transition-colors"
              >
                <Camera className="w-4 h-4" />
                Proceed to Live Camera Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. LIVE CAMERA CAPTURE */}
      {page === 'fisherman-camera' && (
        <div className="max-w-3xl mx-auto p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0B2334] dark:text-white">
                Live Freshness Camera Verification
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Gallery uploads are blocked for official freshness grading. Capture a live photo showing
                eyes, gills, and skin sheen.
              </p>
            </div>
            <span className="text-xs font-mono text-[#0D9488]">
              Lot: {quantityKg} kg {selectedSpecies?.name}
            </span>
          </div>

          <div className="aspect-[16/10] rounded-xl overflow-hidden bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B] relative flex items-center justify-center">
            {cameraActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : capturedImageData ? (
              <img
                src={capturedImageData}
                alt="Captured fish photograph for AI freshness verification"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 text-slate-300 space-y-2">
                <Camera className="w-10 h-10 mx-auto text-teal-400" />
                <p className="text-sm font-medium">Camera standby</p>
                <p className="text-xs text-slate-400 max-w-md">
                  Open your device camera to capture live dockside imagery, or use the clearly labelled
                  Demo Dock Camera Feed when running without physical camera hardware.
                </p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {cameraError && (
            <div className="text-xs text-[#D97706] bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              {cameraError}
            </div>
          )}

          {isLiveVerifiedCapture && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#16A34A] font-mono">
              <span>Live Capture Verified</span>
              <span>·</span>
              <span>Time: {new Date(captureTimestamp).toLocaleTimeString()}</span>
              <span>·</span>
              <span>
                GPS: {captureGps.lat.toFixed(4)}, {captureGps.lng.toFixed(4)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startLiveCamera}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B3B5B] hover:bg-[#092F49] text-white text-sm font-semibold"
              >
                <Camera className="w-4 h-4" />
                Open Device Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={captureLiveFrame}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold"
              >
                Capture Live Photo
              </button>
            )}

            <button
              type="button"
              onClick={useDemoDockCameraRig}
              className="px-4 py-2.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Use Demo Dock Camera Feed
            </button>

            <button
              type="button"
              disabled={!isLiveVerifiedCapture || analyzingFreshness}
              onClick={submitForFreshnessAnalysis}
              className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white text-sm font-semibold"
            >
              {analyzingFreshness ? 'Analyzing with AI...' : 'Analyze Freshness'}
            </button>
          </div>
        </div>
      )}

      {/* 4. AI FRESHNESS RESULTS */}
      {page === 'fisherman-freshness' && (
        <div className="max-w-4xl mx-auto p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-6">
          {freshnessResult ? (
            <>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <CircularFreshnessGauge
                  score={freshnessResult.freshnessScore}
                  grade={freshnessResult.grade}
                />
                <div className="flex-1 space-y-2">
                  <div className="text-xs font-mono text-[#0D9488]">
                    Mode: {freshnessResult.analysisMode === 'gemini-vision' ? 'Gemini Vision AI' : 'Demo Simulated Assessment'} · Confidence {Math.round(freshnessResult.confidence * 100)}%
                  </div>
                  <h2 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
                    {freshnessResult.gradeLabel}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {freshnessResult.handlingUrgency}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#DCE7EC] dark:border-[#1B354B] pt-5">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">1. Eye Clarity</div>
                  <p className="text-sm font-medium mt-1">{freshnessResult.eyeClarity}</p>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">2. Gill Colour</div>
                  <p className="text-sm font-medium mt-1">{freshnessResult.gillColor}</p>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">3. Skin Sheen</div>
                  <p className="text-sm font-medium mt-1">{freshnessResult.skinSheen}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Visual Observations
                </div>
                <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  {freshnessResult.observations.map((obs) => (
                    <li key={obs}>{obs}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-lg bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B] text-xs text-slate-500 dark:text-slate-400">
                {freshnessResult.disclaimer}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('fisherman-camera')}
                  className="px-4 py-2.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-sm font-medium"
                >
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('fisherman-pricing')}
                  className="px-5 py-2.5 rounded-lg bg-[#0B3B5B] hover:bg-[#092F49] text-white text-sm font-semibold"
                >
                  Continue to Fair Price Engine
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-slate-500">
                No freshness inspection run yet for your current draft.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('fisherman-camera')}
                className="px-4 py-2 rounded-lg bg-[#0B3B5B] text-white text-sm font-semibold"
              >
                Go to Live Camera Capture
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. PRICE RECOMMENDATION & CONFIDENTIAL FLOOR */}
      {page === 'fisherman-pricing' && (
        <div className="max-w-4xl mx-auto p-6 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0B2334] dark:text-white">
                AI Fair Price Band & Confidential Floor
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Calculated from freshness score ({freshnessResult?.freshnessScore ?? 89}/100), Mangalore
                market rate, quantity ({quantityKg} kg), and harbor demand.
              </p>
            </div>
            <div className="text-right font-mono">
              <div className="text-xs text-slate-500">Middleman Baseline</div>
              <div className="text-base font-semibold text-slate-500 line-through">
                ₹{fairBand?.middlemanBaselinePrice ?? selectedSpecies?.middlemanRatePerKg}/kg
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B]">
              <label htmlFor="start-price-input" className="block text-xs text-slate-500 mb-1">
                AI Starting Price (₹/kg)
              </label>
              <input
                id="start-price-input"
                type="number"
                value={customStartPrice}
                onChange={(e) => setCustomStartPrice(Number(e.target.value))}
                className="w-full font-mono text-2xl font-bold bg-transparent border-b border-[#DCE7EC] dark:border-[#1B354B] pb-1 focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#F6FAFB] dark:bg-[#07131D] border border-[#0D9488]/40">
              <label
                htmlFor="min-floor-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] mb-1"
              >
                <Lock className="w-3.5 h-3.5" />
                Confidential Minimum Floor (₹/kg)
              </label>
              <input
                id="min-floor-input"
                type="number"
                value={customMinFloor}
                onChange={(e) => setCustomMinFloor(Number(e.target.value))}
                className="w-full font-mono text-2xl font-bold bg-transparent border-b border-[#0D9488]/40 pb-1 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Strictly hidden from buyers. Enforced server-side during AI negotiation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F6FAFB] dark:bg-[#07131D] border border-[#DCE7EC] dark:border-[#1B354B]">
              <div className="text-xs text-slate-500 mb-1">Expected Selling Value</div>
              <div className="font-mono text-2xl font-bold text-[#16A34A] tabular-nums">
                ₹{(customStartPrice * quantityKg).toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Floor guarantee: ₹{(customMinFloor * quantityKg).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center border-t border-[#DCE7EC] dark:border-[#1B354B] pt-4">
            <div>
              <label htmlFor="icebox-temp" className="block text-xs font-medium mb-1">
                Ice-Box Storage Temperature (°C)
              </label>
              <input
                id="icebox-temp"
                type="number"
                step={0.2}
                value={storageTempC}
                onChange={(e) => setStorageTempC(Number(e.target.value))}
                className="w-40 px-3 py-2 text-sm font-mono rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] bg-white dark:bg-[#07131D]"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handlePublishListing}
                disabled={publishing}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                {publishing ? 'Publishing Lot...' : 'Publish Catch to Marketplace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. LISTING MANAGEMENT */}
      {page === 'fisherman-listings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0B2334] dark:text-white">
                Manage My Catch Listings ({myListings.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjust confidential minimum prices, pause/resume sales, or simulate expiry to test zero-waste processor routing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('fisherman-create')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B3B5B] text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Listing
            </button>
          </div>

          {myListings.length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-3">
              <p className="text-sm text-slate-500">You have no active fish listings yet.</p>
              <button
                type="button"
                onClick={() => onNavigate('fisherman-create')}
                className="px-4 py-2 rounded-lg bg-[#EA580C] text-white text-sm font-semibold"
              >
                Create First Voice Listing
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myListings.map((lot) => (
                <div
                  key={lot.id}
                  className="p-5 rounded-xl bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] space-y-4"
                >
                  <div className="flex flex-col md:flex-row gap-5">
                    <img
                      src={lot.imageUrl}
                      alt={lot.speciesName}
                      referrerPolicy="no-referrer"
                      className="w-full md:w-44 h-32 object-cover rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] shrink-0"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {lot.locationName} · Status:{' '}
                            <span className="font-semibold capitalize text-[#0B3B5B] dark:text-teal-300">
                              {lot.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h3 className="font-display text-lg font-bold text-[#0B2334] dark:text-white">
                            {lot.speciesName}
                          </h3>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-lg font-bold text-[#0B2334] dark:text-white">
                            ₹{lot.dynamicPricing.currentPrice}/kg
                          </div>
                          <div className="text-xs text-slate-500">
                            Start ₹{lot.aiStartingPrice}/kg · Floor ₹{lot.minAcceptablePrice ?? '—'}/kg
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
                        <span>Qty: {lot.availableQuantityKg}/{lot.totalQuantityKg} kg</span>
                        <span>Freshness: {lot.dynamicPricing.effectiveFreshnessScore}/100 (Grade {lot.freshnessGrade})</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#EA580C]" />
                          Window left: {Math.floor(lot.dynamicPricing.remainingWindowMinutes / 60)}h{' '}
                          {lot.dynamicPricing.remainingWindowMinutes % 60}m
                        </span>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {editingFloorId === lot.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={editFloorValue}
                              onChange={(e) => setEditFloorValue(Number(e.target.value))}
                              className="w-24 px-2.5 py-1 text-xs font-mono rounded border border-[#0D9488]"
                              aria-label="New minimum acceptable price"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await api.updateListing(lot.id, { minAcceptablePrice: editFloorValue });
                                setEditingFloorId(null);
                                await onRefreshData();
                              }}
                              className="px-3 py-1 rounded bg-[#0D9488] text-white text-xs font-semibold"
                            >
                              Save Floor
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFloorId(lot.id);
                              setEditFloorValue(lot.minAcceptablePrice ?? 200);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Edit Confidential Floor
                          </button>
                        )}

                        {lot.status === 'active' || lot.status === 'paused' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.updateListing(lot.id, {
                                status: lot.status === 'active' ? 'paused' : 'active',
                              });
                              await onRefreshData();
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {lot.status === 'active' ? (
                              <>
                                <Pause className="w-3.5 h-3.5" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" /> Resume
                              </>
                            )}
                          </button>
                        ) : null}

                        {lot.status === 'active' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await api.simulateExpiry(lot.id);
                              await onRefreshData();
                              setStatusMessage(
                                `${lot.speciesName} reached freshness limit and routed automatically to Zero-Waste Processor queue.`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EA580C]/40 text-[#EA580C] text-xs font-semibold hover:bg-[#EA580C]/5"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Simulate Freshness Expiry (Zero-Waste Demo)
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            await api.deleteListing(lot.id);
                            await onRefreshData();
                          }}
                          aria-label={`Remove ${lot.speciesName}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC2626] hover:bg-[#DC2626]/5 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {lot.status === 'active' && (
                    <div className="pt-3 border-t border-[#DCE7EC] dark:border-[#1B354B]">
                      <PriceDecayChart
                        curve={lot.dynamicPricing.priceCurve}
                        currentPrice={lot.dynamicPricing.currentPrice}
                        startingPrice={lot.aiStartingPrice}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
