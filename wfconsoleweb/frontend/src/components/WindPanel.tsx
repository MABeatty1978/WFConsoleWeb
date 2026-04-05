/**
 * Wind panel – supports two display modes:
 * 1) Classic live compass + stats
 * 2) Compact wind rose using recent historical speed+direction bins
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useRapidWind, useWindSpeedConverter } from "../hooks/useWeather";
import { apiClient } from "../services/api";
import { WxSummary } from "../types";
import "./WindPanel.css";

interface Props {
  /** Daily summary (avg wind, max gust) */
  wxSummary: WxSummary | null;
  currentWindMps?: number | null;
  currentGustMps?: number | null;
  currentWindDirDeg?: number | null;
}

// Beaufort scale boundaries in m/s
const BEAUFORT: Array<[number, string, string]> = [
  [0.5,  "B0", "Calm"],
  [1.5,  "B1", "Light Air"],
  [3.3,  "B2", "Light Breeze"],
  [5.5,  "B3", "Gentle Breeze"],
  [8.0,  "B4", "Moderate Breeze"],
  [10.8, "B5", "Fresh Breeze"],
  [13.9, "B6", "Strong Breeze"],
  [17.2, "B7", "Near Gale"],
  [20.8, "B8", "Gale"],
  [24.5, "B9", "Severe Gale"],
  [28.5, "B10","Storm"],
  [32.7, "B11","Violent Storm"],
  [Infinity, "B12", "Hurricane"],
];

function getBeaufort(mps: number | null): { scale: string; description: string } {
  if (mps === null) return { scale: "--", description: "--" };
  for (const [limit, scale, description] of BEAUFORT) {
    if (mps < limit) return { scale, description };
  }
  return { scale: "B12", description: "Hurricane" };
}

function formatBeaufortLabel(scale: string): string {
  const match = /^B(\d{1,2})$/i.exec(scale);
  if (!match) return scale;
  return `Beaufort ${match[1]}`;
}

const CARDINAL = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function toCardinal(deg: number | null): string {
  if (deg === null) return "--";
  return CARDINAL[Math.round(deg / 22.5) % 16];
}

type WindPanelMode = "classic" | "rose";

type RoseSector = {
  index: number;
  startAngle: number;
  endAngle: number;
  label: string;
  count: number;
  maxSpeedMps: number;
  binCounts: number[];
};

const ROSE_TIME_WINDOWS: Array<{ label: string; hours: number }> = [
  { label: "3h", hours: 3 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "72h", hours: 72 },
];

const ROSE_BINS_MPS = [
  { key: "calm", label: "Calm", min: 0, max: 0.5, color: "#6dd3ff" },
  { key: "light", label: "Light", min: 0.5, max: 4, color: "#51cf66" },
  { key: "moderate", label: "Moderate", min: 4, max: 8, color: "#ffd43b" },
  { key: "strong", label: "Strong", min: 8, max: 12, color: "#ff922b" },
  { key: "severe", label: "Severe", min: 12, max: Number.POSITIVE_INFINITY, color: "#ff4d6d" },
] as const;

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function buildSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

/** Compass rose SVG.  The arrow tip points toward the wind direction (from where
 *  the wind is blowing).  The orange head is the "from" side, grey tail points
 *  away – matching the legacy panel convention. */
const CompassRose = memo(function CompassRose({ direction }: { direction: number | null }) {
  const deg = direction ?? 0;

  // Tick marks every 30°; cardinal ticks are longer
  const ticks = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = i * 30;
      const rad = ((angle - 90) * Math.PI) / 180;
      const isCardinal = angle % 90 === 0;
      const inner = isCardinal ? 68 : 75;
      return {
        key: angle,
        x1: 100 + inner * Math.cos(rad),
        y1: 100 + inner * Math.sin(rad),
        x2: 100 + 88  * Math.cos(rad),
        y2: 100 + 88  * Math.sin(rad),
        isCardinal,
      };
    });
  }, []);

  return (
    <svg
      viewBox="0 0 200 200"
      className="compass-rose-svg"
      aria-label={`Wind direction ${deg}°`}
    >
      {/* Outer ring */}
      <circle cx="100" cy="100" r="90" fill="none" stroke="var(--compass-ring)" strokeWidth="2" />

      {/* Inner ring */}
      <circle cx="100" cy="100" r="50" fill="none" stroke="var(--compass-inner)" strokeWidth="1" strokeDasharray="4 4" />

      {/* Tick marks */}
      {ticks.map(({ key, x1, y1, x2, y2, isCardinal }) => (
        <line
          key={key}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={isCardinal ? "var(--compass-cardinal-tick)" : "var(--compass-minor-tick)"}
          strokeWidth={isCardinal ? 2 : 1}
        />
      ))}

      {/* Cardinal labels */}
      <text x="100" y="12"  textAnchor="middle" className="compass-label cardinal">N</text>
      <text x="188" y="104" textAnchor="middle" className="compass-label">E</text>
      <text x="100" y="196" textAnchor="middle" className="compass-label">S</text>
      <text x="12"  y="104" textAnchor="middle" className="compass-label">W</text>

      {/* Direction arrow (rotates to wind direction) */}
      <g
        transform={`rotate(${deg}, 100, 100)`}
        style={{ transition: "transform 1s ease-out" }}
      >
        {/* Arrow head (orange) – points in wind direction */}
        <path d="M 100 100 L 93 58 L 100 28 L 107 58 Z" fill="var(--wind-arrow-head)" />
        {/* Arrow tail (grey) */}
        <path d="M 100 100 L 96 140 L 100 158 L 104 140 Z" fill="var(--wind-arrow-tail)" />
        {/* Center dot */}
        <circle cx="100" cy="100" r="5" fill="var(--wind-arrow-head)" />
      </g>
    </svg>
  );
});

function WindPanel({
  wxSummary,
  currentWindMps = null,
  currentGustMps = null,
  currentWindDirDeg = null,
}: Props) {
  const [mode, setMode] = useState<WindPanelMode>(() => {
    if (typeof window === "undefined") {
      return "classic";
    }
    const saved = window.localStorage.getItem("wf_wind_panel_mode");
    return saved === "rose" ? "rose" : "classic";
  });
  const [roseHours, setRoseHours] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 24;
    }
    const saved = window.localStorage.getItem("wf_wind_rose_hours");
    const parsed = saved ? Number(saved) : 24;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  });
  const [roseSamples, setRoseSamples] = useState<Array<{ speed: number; direction: number }>>([]);
  const [roseLoading, setRoseLoading] = useState(false);

  const setDisplayMode = (nextMode: WindPanelMode) => {
    setMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wf_wind_panel_mode", nextMode);
    }
  };

  const setRoseWindow = (hours: number) => {
    setRoseHours(hours);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wf_wind_rose_hours", String(hours));
    }
  };

  const rapidWind = useRapidWind();
  const { settings } = useSettings();
  const convertWind = useWindSpeedConverter(settings?.windSpeedUnit || "m/s");
  const unit = settings?.windSpeedUnit || "m/s";

  // Prefer rapid-wind packets when available, but fall back to current conditions
  // so the panel never appears empty after theme switches or websocket hiccups.
  const liveSpeedSource = rapidWind?.wind_speed_mps ?? currentWindMps ?? null;
  const liveGustSource =
    rapidWind?.wind_gust_mps ??
    currentGustMps ??
    rapidWind?.wind_speed_mps ??
    currentWindMps ??
    null;
  const liveDirectionSource = rapidWind?.wind_direction_deg ?? currentWindDirDeg ?? null;

  const windSpeed   = convertWind(liveSpeedSource);
  const windGust    = convertWind(liveGustSource);
  const windDir     = liveDirectionSource;
  const avgWindSource = wxSummary?.today.avg_wind_mps ?? rapidWind?.wind_speed_mps ?? currentWindMps;
  const maxGustSource = wxSummary?.today.max_gust_mps ?? rapidWind?.wind_gust_mps ?? currentGustMps ?? rapidWind?.wind_speed_mps ?? currentWindMps;
  const avgWind     = convertWind(avgWindSource ?? null);
  const maxGust     = convertWind(maxGustSource ?? null);
  const beaufort    = getBeaufort(liveSpeedSource);
  const gustFactor =
    liveSpeedSource !== null && liveSpeedSource > 0 && liveGustSource !== null
      ? liveGustSource / liveSpeedSource
      : null;
  const gustSpreadRaw =
    maxGustSource !== null && avgWindSource !== null
      ? Math.max(0, maxGustSource - avgWindSource)
      : null;
  const gustSpread = convertWind(gustSpreadRaw);

  const fetchRoseSamples = useCallback(async () => {
    if (mode !== "rose") {
      return;
    }

    try {
      setRoseLoading(true);
      const now = new Date();
      const start = new Date(now.getTime() - roseHours * 60 * 60 * 1000);
      const limit = Math.min(50000, Math.max(2500, roseHours * 720));
      const response = await apiClient.getRawObservations(start.toISOString(), now.toISOString(), limit);
      const samples = (response.observations || [])
        .map((obs) => ({
          speed: obs.wind_speed_mps,
          direction: obs.wind_direction_deg,
        }))
        .filter(
          (obs): obs is { speed: number; direction: number } =>
            typeof obs.speed === "number" &&
            Number.isFinite(obs.speed) &&
            typeof obs.direction === "number" &&
            Number.isFinite(obs.direction)
        );
      setRoseSamples(samples);
    } finally {
      setRoseLoading(false);
    }
  }, [mode, roseHours]);

  useEffect(() => {
    void fetchRoseSamples();
    if (mode !== "rose") {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchRoseSamples();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchRoseSamples, mode]);

  const roseComputation = useMemo(() => {
    const samples = roseSamples;
    const sectors: RoseSector[] = CARDINAL.map((label, index) => ({
      index,
      label,
      startAngle: index * 22.5,
      endAngle: (index + 1) * 22.5,
      count: 0,
      maxSpeedMps: 0,
      binCounts: new Array(ROSE_BINS_MPS.length).fill(0),
    }));

    let calmCount = 0;
    let matchedCount = 0;
    let sumAll = 0;
    let maxAll = 0;

    for (const sample of samples) {
      const speed = sample.speed;
      const direction = sample.direction;

      matchedCount += 1;
      sumAll += speed;
      if (speed > maxAll) {
        maxAll = speed;
      }

      if (speed < 0.5) {
        calmCount += 1;
      }

      const normalizedDir = ((direction % 360) + 360) % 360;
      const sectorIndex = Math.floor(normalizedDir / 22.5) % 16;
      const sector = sectors[sectorIndex];
      sector.count += 1;
      sector.maxSpeedMps = Math.max(sector.maxSpeedMps, speed);

      const binIndex = ROSE_BINS_MPS.findIndex((bin) => speed >= bin.min && speed < bin.max);
      const safeBinIndex = binIndex >= 0 ? binIndex : ROSE_BINS_MPS.length - 1;
      sector.binCounts[safeBinIndex] += 1;
    }

    // Fallback: if historical pairing is empty, seed with current live wind.
    if (
      matchedCount === 0 &&
      typeof liveDirectionSource === "number" &&
      typeof liveSpeedSource === "number"
    ) {
      matchedCount = 1;
      sumAll = liveSpeedSource;
      maxAll = liveSpeedSource;

      if (liveSpeedSource < 0.5) {
        calmCount = 1;
      }

      const normalizedDir = ((liveDirectionSource % 360) + 360) % 360;
      const sectorIndex = Math.floor(normalizedDir / 22.5) % 16;
      const sector = sectors[sectorIndex];
      sector.count = 1;
      sector.maxSpeedMps = liveSpeedSource;
      const fallbackBin = ROSE_BINS_MPS.findIndex((bin) => liveSpeedSource >= bin.min && liveSpeedSource < bin.max);
      sector.binCounts[fallbackBin >= 0 ? fallbackBin : ROSE_BINS_MPS.length - 1] = 1;
    }

    const prevailing = sectors.reduce((best, current) => {
      if (!best) return current;
      return current.count > best.count ? current : best;
    }, sectors[0]);

    return {
      sectors,
      matchedCount,
      calmPct: matchedCount > 0 ? (calmCount / matchedCount) * 100 : 0,
      avgMps: matchedCount > 0 ? sumAll / matchedCount : null,
      peakMps: matchedCount > 0 ? maxAll : null,
      prevailing,
      maxSectorCount: Math.max(1, ...sectors.map((s) => s.count)),
    };
  }, [roseSamples, liveDirectionSource, liveSpeedSource]);

  const roseAvg = roseComputation.avgMps !== null ? convertWind(roseComputation.avgMps) : null;
  const rosePeak = roseComputation.peakMps !== null ? convertWind(roseComputation.peakMps) : null;
  const roseLegendBands = useMemo(() => {
    return ROSE_BINS_MPS.map((band) => {
      const fromConverted = convertWind(band.min);
      const toConverted = Number.isFinite(band.max) ? convertWind(band.max) : null;
      const rangeLabel = Number.isFinite(band.max)
        ? `${fromConverted.toFixed(1)}-${toConverted?.toFixed(1)} ${unit}`
        : `>= ${fromConverted.toFixed(1)} ${unit}`;

      return {
        key: band.key,
        label: band.label,
        color: band.color,
        rangeLabel,
      };
    });
  }, [convertWind, unit]);

  const fmt = (val: number | null, decimals = 1) =>
    val !== null ? val.toFixed(decimals) : "--";

  const renderWindRose = () => {
    const cx = 100;
    const cy = 100;
    const innerRadius = 24;
    const outerBase = 38;
    const outerMax = 90;

    return (
      <div className="wind-rose-mode">
        <div className="wind-rose-wrap">
          <svg viewBox="0 0 200 200" className="wind-rose-svg" aria-label="Wind rose">
            <circle cx={cx} cy={cy} r="90" className="wind-rose-ring" />
            <circle cx={cx} cy={cy} r="66" className="wind-rose-ring inner" />
            <circle cx={cx} cy={cy} r="42" className="wind-rose-ring inner" />
            <circle cx={cx} cy={cy} r={innerRadius} className="wind-rose-core" />

            {roseComputation.sectors.map((sector) => {
              if (sector.count === 0) {
                return null;
              }
              const start = sector.startAngle + 1.1;
              const end = sector.endAngle - 1.1;

              const totalOuterRadius = outerBase + (sector.count / roseComputation.maxSectorCount) * (outerMax - outerBase);
              let currentInner = innerRadius;

              return sector.binCounts.map((binCount, binIdx) => {
                if (binCount <= 0) {
                  return null;
                }
                const thickness = ((totalOuterRadius - innerRadius) * binCount) / sector.count;
                const nextOuter = currentInner + thickness;
                const path = buildSectorPath(cx, cy, currentInner, nextOuter, start, end);
                currentInner = nextOuter;

                return (
                  <path
                    key={`rose-sector-${sector.index}-bin-${binIdx}`}
                    d={path}
                    fill={ROSE_BINS_MPS[binIdx].color}
                    fillOpacity={0.9}
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="0.45"
                  />
                );
              });
            })}

            <text x="100" y="14" textAnchor="middle" className="wind-rose-cardinal">N</text>
            <text x="188" y="104" textAnchor="middle" className="wind-rose-cardinal">E</text>
            <text x="100" y="196" textAnchor="middle" className="wind-rose-cardinal">S</text>
            <text x="12" y="104" textAnchor="middle" className="wind-rose-cardinal">W</text>
          </svg>
        </div>

        <div className="wind-rose-stats">
          <div className="wind-rose-window-toggle" role="tablist" aria-label="Wind rose time window">
            {ROSE_TIME_WINDOWS.map((window) => (
              <button
                key={window.hours}
                type="button"
                className={`wind-rose-window-pill ${roseHours === window.hours ? "active" : ""}`}
                onClick={() => setRoseWindow(window.hours)}
              >
                {window.label}
              </button>
            ))}
          </div>

          <div className="wind-rose-stat">
            <span className="wind-rose-stat-label">Prevailing</span>
            <span className="wind-rose-stat-value">{roseComputation.prevailing?.label ?? "--"}</span>
          </div>
          <div className="wind-rose-stat">
            <span className="wind-rose-stat-label">24h Avg</span>
            <span className="wind-rose-stat-value">{fmt(roseAvg)} {unit}</span>
          </div>
          <div className="wind-rose-stat">
            <span className="wind-rose-stat-label">24h Peak</span>
            <span className="wind-rose-stat-value">{fmt(rosePeak)} {unit}</span>
          </div>
          <div className="wind-rose-stat">
            <span className="wind-rose-stat-label">Calm</span>
            <span className="wind-rose-stat-value">{roseComputation.calmPct.toFixed(0)}%</span>
          </div>

          {roseComputation.matchedCount === 0 && (
            <div className="wind-rose-empty-note">Waiting for enough wind history data...</div>
          )}
          {roseLoading && (
            <div className="wind-rose-empty-note">Updating wind rose...</div>
          )}
        </div>

        <div className="wind-rose-legend-strip" aria-label="Wind rose color legend">
          {roseLegendBands.map((band) => (
            <div key={band.key} className="wind-rose-legend-chip">
              <span className="wind-rose-legend-swatch" style={{ backgroundColor: band.color }} aria-hidden="true" />
              <span className="wind-rose-legend-label">{band.label}</span>
              <span className="wind-rose-legend-range">{band.rangeLabel}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="wx-panel wind-panel">
      <div className="wx-panel-header">
        <span className="wx-panel-title">Wind</span>
        <div className="wind-mode-toggle" role="tablist" aria-label="Wind panel mode">
          <button
            className={`wind-mode-pill ${mode === "classic" ? "active" : ""}`}
            onClick={() => setDisplayMode("classic")}
            type="button"
          >
            Live
          </button>
          <button
            className={`wind-mode-pill ${mode === "rose" ? "active" : ""}`}
            onClick={() => setDisplayMode("rose")}
            type="button"
          >
            Rose
          </button>
        </div>
        <span className="live-dot" aria-hidden="true" />
      </div>

      {mode === "classic" ? (
      <>
      <div className="wind-body">
        {/* Left column – current speed & gust */}
        <div className="wind-stats-col left">
          <div className="wind-stat-block">
            <span className="wind-stat-label">Avg&nbsp;Wind</span>
            <span className="wind-stat-sub">{fmt(avgWind)} <span className="wind-unit">{unit}</span></span>
          </div>
          <div className="wind-large-block">
            <span className="wind-large-value">{fmt(windSpeed)}</span>
            <span className="wind-large-unit">{unit}</span>
          </div>
          <span className="wind-large-caption">Speed</span>
        </div>

        {/* Compass rose */}
        <div className="wind-compass-col">
          <CompassRose direction={windDir} />
          <div className="wind-dir-labels">
            <span className="wind-dir-deg">
              {windDir !== null ? `${Math.round(windDir)}°` : "--°"}
            </span>
            <span className="wind-dir-cardinal">{toCardinal(windDir)}</span>
          </div>
        </div>

        {/* Right column – gust & max gust */}
        <div className="wind-stats-col right">
          <div className="wind-stat-block">
            <span className="wind-stat-label">Max&nbsp;Gust</span>
            <span className="wind-stat-sub">{fmt(maxGust)} <span className="wind-unit">{unit}</span></span>
          </div>
          <div className="wind-large-block">
            <span className="wind-large-value">{fmt(windGust)}</span>
            <span className="wind-large-unit">{unit}</span>
          </div>
          <span className="wind-large-caption">Gust</span>
        </div>
      </div>

      {/* Beaufort scale footer */}
      <div className="wind-beaufort">
        <span className="beaufort-scale" title={`Wind force ${beaufort.scale}`}>
          {formatBeaufortLabel(beaufort.scale)}
        </span>
        <span className="beaufort-desc">{beaufort.description}</span>
        <span className="wind-direction-text">
          Direction: <strong>{toCardinal(windDir)}</strong>
        </span>
      </div>

      <div className="wind-secondary-metrics">
        <div className="wind-metric-card">
          <span className="wind-metric-label">Gust Factor</span>
          <span className="wind-metric-value">
            {gustFactor !== null ? `${gustFactor.toFixed(2)}x` : "--"}
          </span>
        </div>
        <div className="wind-metric-card">
          <span className="wind-metric-label">Gust Spread</span>
          <span className="wind-metric-value">
            {gustSpread !== null ? `${fmt(gustSpread)} ${unit}` : "--"}
          </span>
        </div>
      </div>
      </>
      ) : (
        renderWindRose()
      )}
    </div>
  );
}

export default memo(WindPanel);
