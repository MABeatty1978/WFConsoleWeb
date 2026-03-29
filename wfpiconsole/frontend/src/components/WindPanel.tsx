/**
 * Wind panel – shows live rapid-wind data on an animated SVG compass rose,
 * plus today's average wind and max gust pulled from the wx-summary endpoint.
 */

import { memo, useMemo } from "react";
import { useSettings } from "../context/SettingsContext";
import { useRapidWind, useWindSpeedConverter } from "../hooks/useWeather";
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

  const fmt = (val: number | null, decimals = 1) =>
    val !== null ? val.toFixed(decimals) : "--";

  return (
    <div className="wx-panel wind-panel">
      <div className="wx-panel-header">
        <span className="wx-panel-title">Wind</span>
        <span className="live-dot" aria-hidden="true" />
      </div>

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
    </div>
  );
}

export default memo(WindPanel);
