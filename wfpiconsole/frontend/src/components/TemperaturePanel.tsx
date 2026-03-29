/**
 * Temperature panel – mirrors the PiConsole temperature panel layout.
 * Shows current outdoor temperature (large), feels-like, daily min/max,
 * humidity, dew point, 24-hr difference, and 3-hr trend.
 */

import React from "react";
import { CurrentConditions, WxSummary } from "../types";
import { useSettings } from "../context/SettingsContext";
import { useTemperatureConverter } from "../hooks/useWeather";
import "./TemperaturePanel.css";

interface Props {
  conditions: CurrentConditions | null;
  wxSummary:  WxSummary | null;
}

function FeelsLikeLabel(feelsLike: number | null, current: number | null): string {
  if (feelsLike === null || current === null) return "";
  const diff = feelsLike - current;
  if (Math.abs(diff) < 1) return "About the same as the air temperature";
  if (diff > 3) return "Feels warmer than the actual temperature";
  if (diff < -3) return "Feels colder than the actual temperature";
  return diff > 0 ? "Slightly warmer than the air temperature" : "Slightly cooler than the air temperature";
}

function TrendArrow({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="trend-value">--</span>;
  const sign   = delta > 0 ? "+" : "";
  const arrow  = delta > 0 ? "▲" : delta < 0 ? "▼" : "►";
  const color  = delta > 0 ? "var(--temp-warm)" : delta < 0 ? "var(--temp-cool)" : "inherit";
  return (
    <span className="trend-value" style={{ color }}>
      {arrow} {sign}{delta.toFixed(1)}°
    </span>
  );
}

export default function TemperaturePanel({ conditions, wxSummary }: Props) {
  const { settings } = useSettings();
  const convertTemp = useTemperatureConverter(settings?.temperatureUnit || "C");
  const unit = settings?.temperatureUnit || "C";

  const temp      = convertTemp(conditions?.temperature_c ?? null);
  const feelsLike = convertTemp(conditions?.feels_like_c  ?? null);
  const dewPoint  = convertTemp(wxSummary?.current.dew_point_c ?? null);
  const tempMin   = convertTemp(wxSummary?.today.temp_min_c ?? null);
  const tempMax   = convertTemp(wxSummary?.today.temp_max_c ?? null);
  const trend3h   = wxSummary?.current.temp_trend_c ?? null;

  // 24-hr difference: current vs today min (rough approximation)
  const diff24h = (temp !== null && tempMin !== null)
    ? parseFloat((temp - tempMin).toFixed(1))
    : null;

  const humidity = conditions?.humidity ?? null;

  const fmt = (val: number | null, dec = 0) =>
    val !== null ? val.toFixed(dec) : "--";

  const feelsLikeMsg = FeelsLikeLabel(feelsLike, temp);

  return (
    <div className="wx-panel temperature-panel">
      <div className="wx-panel-header">
        <span className="wx-panel-title">Temperature</span>
      </div>

      {/* Main temperature display */}
      <div className="temp-main-row">
        <div className="temp-current-block">
          <span className="temp-current-value">{fmt(temp)}</span>
          <span className="temp-current-unit">°{unit}</span>
        </div>

        {/* Daily min / max */}
        <div className="temp-minmax-block">
          <div className="temp-minmax-item">
            <span className="temp-minmax-label">High</span>
            <span className="temp-minmax-value warm">{fmt(tempMax)}°</span>
          </div>
          <div className="temp-minmax-item">
            <span className="temp-minmax-label">Low</span>
            <span className="temp-minmax-value cool">{fmt(tempMin)}°</span>
          </div>
        </div>
      </div>

      {/* Three secondary metrics */}
      <div className="temp-secondary-row">
        <div className="temp-metric">
          <span className="temp-metric-label">Feels Like</span>
          <span className="temp-metric-value">{fmt(feelsLike)}°{unit}</span>
        </div>
        <div className="temp-metric">
          <span className="temp-metric-label">Humidity</span>
          <span className="temp-metric-value">{fmt(humidity)}%</span>
        </div>
        <div className="temp-metric">
          <span className="temp-metric-label">Dew Point</span>
          <span className="temp-metric-value">{fmt(dewPoint)}°{unit}</span>
        </div>
      </div>

      {/* Trend rows */}
      <div className="temp-trend-row">
        <div className="temp-trend-block">
          <span className="temp-trend-label">24 hr Difference</span>
          <TrendArrow delta={diff24h} />
        </div>
        <div className="temp-trend-block">
          <span className="temp-trend-label">3 hr Trend</span>
          <TrendArrow delta={trend3h} />
        </div>
      </div>

      {/* Feels-like description */}
      {feelsLikeMsg && (
        <div className="temp-feels-msg">{feelsLikeMsg}</div>
      )}
    </div>
  );
}
