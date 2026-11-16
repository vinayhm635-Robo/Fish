import React, { useState } from 'react';
import { Anchor, Compass, Factory, MapPin, Navigation, Store } from 'lucide-react';
import type { PublicFishListing, User } from '../types/domain';
import { haversineDistanceKm } from '../engine/fishEconomics';

interface MangaloreMapProps {
  listings: PublicFishListing[];
  users: User[];
  userLocation?: { lat: number; lng: number; label: string };
  onRequestGps?: () => void;
  onSelectListing?: (listing: PublicFishListing) => void;
}

// Bounding box around Coastal Dakshina Kannada & Udupi (Malpe to Ullal)
const LAT_MIN = 12.78;
const LAT_MAX = 13.38;
const LNG_MIN = 74.66;
const LNG_MAX = 74.92;

function projectToSvg(lat: number, lng: number): { x: number; y: number } {
  const xNorm = (lng - LNG_MIN) / (LNG_MAX - LNG_MIN);
  const yNorm = 1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN);
  return {
    x: Math.max(40, Math.min(560, 40 + xNorm * 520)),
    y: Math.max(30, Math.min(350, 30 + yNorm * 320)),
  };
}

export function MangaloreMap({
  listings,
  users,
  userLocation,
  onRequestGps,
  onSelectListing,
}: MangaloreMapProps) {
  const [filterType, setFilterType] = useState<'all' | 'fishermen' | 'buyers' | 'processors'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(listings[0]?.id ?? null);

  const buyers = users.filter((u) => u.role === 'buyer');
  const processors = users.filter((u) => u.role === 'processor');
  const activeListings = listings.filter((l) => l.status === 'active');

  const selectedListing = activeListings.find((l) => l.id === selectedId) ?? activeListings[0];
  const refLat = userLocation?.lat ?? 12.8698;
  const refLng = userLocation?.lng ?? 74.8431;

  return (
    <div className="bg-white dark:bg-[#0D1F2E] border border-[#DCE7EC] dark:border-[#1B354B] rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#DCE7EC] dark:border-[#1B354B]">
        <div>
          <h3 className="text-base font-semibold text-[#0B2334] dark:text-white">
            Mangalore Coastal Supply & Pickup Intelligence
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active landings from Bunder Harbor, Panambur, Ullal & Malpe · Reference: {userLocation?.label || 'Hampankatta, Mangalore'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
            {(['all', 'fishermen', 'buyers', 'processors'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize whitespace-nowrap transition-colors ${
                  filterType === t
                    ? 'bg-white dark:bg-[#0B3B5B] text-[#0B2334] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0B2334] dark:hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {onRequestGps && (
            <button
              type="button"
              onClick={onRequestGps}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DCE7EC] dark:border-[#1B354B] text-[#0B3B5B] dark:text-teal-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5" />
              Use My GPS
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 relative bg-[#E7F4F8] dark:bg-[#081A27] p-3">
          <svg
            viewBox="0 0 600 380"
            className="w-full h-auto rounded-lg"
            role="img"
            aria-label="Interactive Mangalore coastline map showing fishermen landings, buyers, and processors"
          >
            {/* Arabian Sea */}
            <rect x="0" y="0" width="600" height="380" fill="currentColor" className="text-[#CDE7F0] dark:text-[#092234]" />

            {/* Karnataka Coastal Landmass */}
            <path
              d="M 210 0 L 600 0 L 600 380 L 340 380 C 330 310, 315 260, 295 215 C 275 170, 240 110, 210 0 Z"
              fill="currentColor"
              className="text-[#EEF3ED] dark:text-[#112A39]"
            />

            {/* Netravati & Gurupura River Estuaries at Mangalore */}
            <path
              d="M 310 265 Q 370 250 450 245"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              className="text-[#CDE7F0] dark:text-[#092234]"
            />
            <path
              d="M 318 282 Q 395 292 480 310"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-[#CDE7F0] dark:text-[#092234]"
            />

            {/* Coastal Highway NH-66 */}
            <path
              d="M 255 15 C 280 95, 315 185, 345 268 C 355 300, 370 340, 388 375"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              className="text-slate-400/70 dark:text-slate-500/60"
            />

            {/* Sea label */}
            <text x="90" y="190" className="fill-[#0B3B5B]/45 dark:fill-teal-300/35 text-xs font-semibold tracking-widest uppercase">
              Arabian Sea
            </text>

            {/* Harbor Labels */}
            {[
              { name: 'Malpe Harbor', lat: 13.3477, lng: 74.7029 },
              { name: 'Panambur Port', lat: 12.948, lng: 74.801 },
              { name: 'Bunder Harbor', lat: 12.8582, lng: 74.8321 },
              { name: 'Ullal Coast', lat: 12.8065, lng: 74.8559 },
            ].map((hub) => {
              const p = projectToSvg(hub.lat, hub.lng);
              return (
                <text
                  key={hub.name}
                  x={p.x + 12}
                  y={p.y + 4}
                  className="fill-slate-600 dark:fill-slate-400 text-[10px] font-medium"
                >
                  {hub.name}
                </text>
              );
            })}

            {/* Fisherman / Catch Pins */}
            {(filterType === 'all' || filterType === 'fishermen') &&
              activeListings.map((l) => {
                const pt = projectToSvg(l.lat, l.lng);
                const isSelected = selectedListing?.id === l.id;
                return (
                  <g
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 12 : 9}
                      fill={isSelected ? '#EA580C' : '#0B3B5B'}
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y + 3.5}
                      textAnchor="middle"
                      className="fill-white text-[9px] font-bold pointer-events-none"
                    >
                      {l.freshnessGrade}
                    </text>
                  </g>
                );
              })}

            {/* Buyer Pins */}
            {(filterType === 'all' || filterType === 'buyers') &&
              buyers.map((b) => {
                const pt = projectToSvg(b.lat, b.lng);
                return (
                  <g key={b.id}>
                    <rect
                      x={pt.x - 7}
                      y={pt.y - 7}
                      width="14"
                      height="14"
                      rx="3"
                      fill="#0D9488"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}

            {/* Processor Pins */}
            {(filterType === 'all' || filterType === 'processors') &&
              processors.map((pr) => {
                const pt = projectToSvg(pr.lat, pr.lng);
                return (
                  <g key={pr.id}>
                    <polygon
                      points={`${pt.x},${pt.y - 9} ${pt.x + 9},${pt.y + 7} ${pt.x - 9},${pt.y + 7}`}
                      fill="#16A34A"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}

            {/* User GPS Marker */}
            {userLocation && (
              <g>
                <circle
                  cx={projectToSvg(userLocation.lat, userLocation.lng).x}
                  cy={projectToSvg(userLocation.lat, userLocation.lng).y}
                  r="6"
                  fill="#EA580C"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 px-1">
            <span className="inline-flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-[#0B3B5B] dark:text-sky-300" />
              Landing / Catch Lot
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#0D9488]" />
              Verified Buyer / Hotel
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-[#16A34A]" />
              Zero-Waste Processor
            </span>
          </div>
        </div>

        {/* Selected Dock Pin Details */}
        <div className="p-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[#DCE7EC] dark:border-[#1B354B]">
          {selectedListing ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Selected Dock Catch · {selectedListing.locationName}
                </div>
                <h4 className="text-lg font-semibold text-[#0B2334] dark:text-white mt-0.5">
                  {selectedListing.speciesName}
                </h4>
              </div>

              <img
                src={selectedListing.imageUrl}
                alt={selectedListing.speciesName}
                referrerPolicy="no-referrer"
                className="w-full h-32 object-cover rounded-lg border border-[#DCE7EC] dark:border-[#1B354B]"
              />

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Live Price</div>
                  <div className="font-mono text-base font-bold text-[#0B2334] dark:text-white">
                    ₹{selectedListing.dynamicPricing.currentPrice}/kg
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Distance</div>
                  <div className="font-mono text-base font-bold text-[#0D9488]">
                    {haversineDistanceKm(refLat, refLng, selectedListing.lat, selectedListing.lng)} km
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Freshness</div>
                  <div className="font-mono font-semibold text-[#16A34A]">
                    {selectedListing.dynamicPricing.effectiveFreshnessScore}/100 · Grade {selectedListing.freshnessGrade}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Available</div>
                  <div className="font-mono font-semibold text-[#0B2334] dark:text-white">
                    {selectedListing.availableQuantityKg} kg
                  </div>
                </div>
              </div>

              {onSelectListing && (
                <button
                  type="button"
                  onClick={() => onSelectListing(selectedListing)}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0B3B5B] hover:bg-[#092F49] text-white text-sm font-semibold transition-colors"
                >
                  Inspect & Negotiate Lot
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center h-full text-center py-8">
              <Compass className="w-8 h-8 mb-2 text-slate-400" />
              Select a harbor pin on the Mangalore map to inspect live catch details.
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[#DCE7EC] dark:border-[#1B354B] text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#EA580C]" />
            <span>Direct boat-to-kitchen routing saves ~68 min coastal transit.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
