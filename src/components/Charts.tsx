import React, { useState } from 'react';
import type { FreshnessGrade, PriceHistoryPoint } from '../types/domain';

export function CircularFreshnessGauge({
  score,
  grade,
  size = 148,
}: {
  score: number;
  grade: FreshnessGrade;
  size?: number;
}) {
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    grade === 'A'
      ? '#16A34A'
      : grade === 'B'
        ? '#0D9488'
        : grade === 'C'
          ? '#D97706'
          : '#DC2626';

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Freshness score ${clamped} out of 100, Grade ${grade}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-3xl font-bold tabular-nums text-[#0B2334] dark:text-white">
          {clamped}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          / 100 · Grade {grade}
        </span>
      </div>
    </div>
  );
}

export function PriceDecayChart({
  curve,
  currentPrice,
  startingPrice,
}: {
  curve: PriceHistoryPoint[];
  currentPrice: number;
  startingPrice: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!curve || curve.length === 0) return null;

  const width = 520;
  const height = 190;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;

  const prices = curve.map((c) => c.pricePerKg);
  const minP = Math.min(...prices, currentPrice) - 15;
  const maxP = Math.max(...prices, startingPrice) + 15;
  const rangeP = Math.max(10, maxP - minP);

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, curve.length - 1)) * (width - padLeft - padRight);
  const getY = (price: number) =>
    padTop + ((maxP - price) / rangeP) * (height - padTop - padBottom);

  const linePoints = curve.map((pt, i) => `${getX(i)},${getY(pt.pricePerKg)}`).join(' ');
  const areaPoints = `${getX(0)},${height - padBottom} ${linePoints} ${getX(curve.length - 1)},${
    height - padBottom
  }`;

  const activePoint = hoveredIdx !== null ? curve[hoveredIdx] : null;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs text-slate-600 dark:text-slate-300">
        <span>Freshness-Linked Price Trajectory (₹/kg)</span>
        {activePoint ? (
          <span className="font-mono font-semibold text-[#0D9488]">
            {activePoint.label}: ₹{activePoint.pricePerKg}/kg · Est. Freshness {activePoint.projectedFreshness}/100
          </span>
        ) : (
          <span className="font-mono text-slate-500 dark:text-slate-400">
            Start ₹{startingPrice}/kg · Live ₹{currentPrice}/kg
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label="Dynamic freshness-linked price decay chart"
      >
        <defs>
          <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D9488" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio) => {
          const val = Math.round(minP + ratio * rangeP);
          const y = getY(val);
          return (
            <g key={ratio}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-slate-200 dark:text-slate-800"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
              >
                ₹{val}
              </text>
            </g>
          );
        })}

        {/* Area & Line */}
        <polygon points={areaPoints} fill="url(#priceAreaGrad)" />
        <polyline
          fill="none"
          stroke="#0D9488"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={linePoints}
        />

        {/* Points & X-axis labels */}
        {curve.map((pt, i) => {
          const cx = getX(i);
          const cy = getY(pt.pricePerKg);
          const isHovered = hoveredIdx === i;
          return (
            <g
              key={pt.label}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 6 : 4}
                fill={isHovered ? '#EA580C' : '#0B3B5B'}
                stroke="#ffffff"
                strokeWidth="2"
              />
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function SpeciesRevenueBars({
  items,
}: {
  items: Array<{ species: string; kgSold: number; revenueInr: number }>;
}) {
  const maxKg = Math.max(10, ...items.map((i) => i.kgSold));

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-6">
        No recorded transactions yet. Complete an order or recovery batch to populate species metrics.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.max(6, Math.round((item.kgSold / maxKg) * 100));
        return (
          <div key={item.species} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#0B2334] dark:text-slate-200">{item.species}</span>
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {item.kgSold} kg · ₹{item.revenueInr.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-[#0D9488] rounded-sm transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
