/**
 * Rainfall panel – shows an animated SVG rain-gauge alongside today,
 * yesterday, monthly, and yearly totals, plus current rain rate.
 * Mirrors the PiConsole Rainfall panel layout.
 */

import { useMemo } from "react";
import { WxSummary } from "../types";
import { useSettings } from "../context/SettingsContext";
import "./RainfallPanel.css";

interface Props {
  wxSummary: WxSummary | null;
}

/**
 * SVG rain gauge whose fill level rises with the current rain rate.
 * The gauge is a vertical cylinder; the water height is proportional to
 * sqrt(rate) so that low rates are still visible.
 */
function RainGauge({
  rateMMph,
  rainfallUnit,
}: {
  rateMMph: number | null;
  rainfallUnit: "mm" | "in";
}) {
  const rate = rateMMph ?? 0;

  // Map rate (0 → 50+ mm/h) to fill fraction (0 → 1) via sqrt curve
  const fillFraction = useMemo(() => {
    if (rate <= 0) return 0;
    if (rate >= 50) return 1;
    return Math.sqrt(rate / 50);
  }, [rate]);

  // Gauge dimensions (SVG user units)
  const GAUGE_X = 20;
  const GAUGE_W = 40;
  const GAUGE_TOP = 8;
  const GAUGE_BOT = 108;
  const GAUGE_H = GAUGE_BOT - GAUGE_TOP;

  // Water block (fills from bottom up)
  const waterH = GAUGE_H * fillFraction;
  const waterY = GAUGE_BOT - waterH;

  // Tick marks every 10%
  const ticks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((f) => ({
    y: GAUGE_BOT - GAUGE_H * f,
    long: Math.round(f * 10) % 5 === 0,
  }));

  const displayRate = rainfallUnit === "in" ? rate / 25.4 : rate;
  const displayRateText =
    rate > 0
      ? `${displayRate.toFixed(rainfallUnit === "in" ? 2 : 1)} ${rainfallUnit}/h`
      : "No rain";

  return (
    <svg viewBox="0 0 80 120" className="rain-gauge-svg" aria-label="Rain gauge">
      {/* Outer gauge outline */}
      <rect
        x={GAUGE_X} y={GAUGE_TOP}
        width={GAUGE_W} height={GAUGE_H}
        rx="4"
        fill="rgba(0,0,0,0.3)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
      />

      {/* Water fill */}
      {waterH > 0 && (
        <rect
          x={GAUGE_X + 1.5} y={waterY}
          width={GAUGE_W - 3} height={waterH}
          rx="2"
          fill="url(#rainGrad)"
          className={rate > 0 ? "rain-fill-animate" : ""}
        />
      )}

      {/* Tick marks */}
      {ticks.map(({ y, long }) => (
        <line
          key={y}
          x1={GAUGE_X + (long ? 4 : 7)} y1={y}
          x2={GAUGE_X + GAUGE_W - (long ? 4 : 7)} y2={y}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
        />
      ))}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#64b5f6" />
          <stop offset="100%" stopColor="#0277bd" />
        </linearGradient>
      </defs>

      {/* Rain drops (animated, only visible when raining) */}
      {rate > 0 && (
        <>
          <circle cx="35" cy="4" r="2" fill="#64b5f6" className="raindrop d1" />
          <circle cx="45" cy="2" r="1.5" fill="#64b5f6" className="raindrop d2" />
          <circle cx="40" cy="5" r="1" fill="#64b5f6" className="raindrop d3" />
        </>
      )}

      {/* Rate label below gauge */}
      <text x="40" y="118" textAnchor="middle" className="gauge-rate-text">
        {displayRateText}
      </text>
    </svg>
  );
}

export default function RainfallPanel({ wxSummary }: Props) {
  const { settings } = useSettings();
  const rainfallUnit = settings?.rainfallUnit ?? "mm";

  const today     = wxSummary?.today.rain_mm     ?? 0;
  const yesterday = wxSummary?.yesterday.rain_mm ?? 0;
  const month     = wxSummary?.month.rain_mm     ?? 0;
  const year      = wxSummary?.year.rain_mm      ?? 0;
  const rateMMph  = wxSummary?.current.rain_rate_mm_per_hour ?? null;

  const toSelectedUnit = (valMM: number) =>
    rainfallUnit === "in" ? valMM / 25.4 : valMM;

  const fmtRain = (valMM: number) => {
    const value = toSelectedUnit(valMM);
    return rainfallUnit === "in" ? value.toFixed(2) : value.toFixed(1);
  };

  const unitLabel = rainfallUnit === "in" ? "in" : "mm";
  const rateDisplay =
    rateMMph !== null
      ? `${fmtRain(rateMMph)} ${unitLabel}/h`
      : "--";

  return (
    <div className="wx-panel rainfall-panel">
      <div className="wx-panel-header">
        <span className="wx-panel-title">Rainfall</span>
      </div>

      <div className="rainfall-body">
        {/* Period totals – 2×2 grid on left side */}
        <div className="rainfall-totals">
          <div className="rainfall-period">
            <span className="rainfall-period-label">Today</span>
            <span className="rainfall-period-value">{fmtRain(today)} <span className="rainfall-unit">{unitLabel}</span></span>
          </div>
          <div className="rainfall-period">
            <span className="rainfall-period-label">Yesterday</span>
            <span className="rainfall-period-value">{fmtRain(yesterday)} <span className="rainfall-unit">{unitLabel}</span></span>
          </div>
          <div className="rainfall-period">
            <span className="rainfall-period-label">This Month</span>
            <span className="rainfall-period-value">{fmtRain(month)} <span className="rainfall-unit">{unitLabel}</span></span>
          </div>
          <div className="rainfall-period">
            <span className="rainfall-period-label">This Year</span>
            <span className="rainfall-period-value">{fmtRain(year)} <span className="rainfall-unit">{unitLabel}</span></span>
          </div>
        </div>

        {/* Gauge on right side */}
        <div className="rainfall-gauge-col">
          <RainGauge rateMMph={rateMMph} rainfallUnit={rainfallUnit} />
        </div>
      </div>

      {/* Rate footer */}
      <div className="rainfall-rate-footer">
        <span className="rainfall-rate-label">Current Rain Rate</span>
        <span className="rainfall-rate-value">{rateDisplay}</span>
      </div>
    </div>
  );
}
