/**
 * Forecast panel component with Tempest/Sager/Zambretti toggle
 */

import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useSagerForecast, useTempestForecast, useZambrettiForecast } from "../hooks/useAdvanced";
import { formatLocalDateTime } from "../utils/dateTime";
import "./SagerForecastPanel.css";

const SAGER_DESCRIPTIONS: Record<number, string> = {
  0: "INCREASING THEN DECREASING",
  1: "INCREASING THEN STEADY",
  2: "INCREASING STEADILY",
  3: "INCREASING RAPIDLY",
  4: "STEADY PRESSURE",
  5: "DECREASING THEN INCREASING",
  6: "DECREASING THEN STEADY",
  7: "DECREASING STEADILY",
  8: "DECREASING RAPIDLY",
  9: "RISING RAPIDLY THEN FALLING",
  10: "INSUFFICIENT DATA",
};

const FORECAST_CODES: Record<number, { text: string; emoji: string; color: string }> = {
  0: { text: "Sunny", emoji: "☀️", color: "#ffd54f" },
  1: { text: "Partly Cloudy", emoji: "⛅", color: "#90caf9" },
  2: { text: "Mostly Cloudy", emoji: "☁️", color: "#78909c" },
  3: { text: "Overcast", emoji: "🌫️", color: "#607d8b" },
  4: { text: "Drizzle", emoji: "🌧️", color: "#4fc3f7" },
  5: { text: "Rain", emoji: "🌧️", color: "#0288d1" },
  6: { text: "Heavy Rain", emoji: "⛈️", color: "#01579b" },
  7: { text: "Snowflakes", emoji: "❄️", color: "#b3e5fc" },
  8: { text: "Snow Shower", emoji: "🌨️", color: "#81d4fa" },
  9: { text: "Thunderstorm", emoji: "⛈️", color: "#9c27b0" },
  10: { text: "Hail", emoji: "🧊", color: "#64b5f6" },
};

const TEMPEST_ICON_TO_EMOJI: Record<string, string> = {
  clear_day: "☀️",
  clear_night: "🌙",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  rain: "🌧️",
  thunderstorm: "⛈️",
  snow: "❄️",
  fog: "🌫️",
};

export default function SagerForecastPanel() {
  const { settings, setPreferredForecastSource } = useSettings();
  const selectedSource = settings?.preferredForecastSource ?? "tempest";
  const tempUnit = settings?.temperatureUnit ?? "C";
  const windUnit = settings?.windSpeedUnit ?? "m/s";
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const formatTemp = (valueC: number | null, digits = 1): string => {
    if (valueC === null) return "--";
    const displayValue = tempUnit === "F" ? (valueC * 9) / 5 + 32 : valueC;
    return `${displayValue.toFixed(digits)} ${tempUnit}`;
  };

  const formatWind = (valueMps: number | null): string => {
    if (valueMps === null) return "--";

    const conversions = {
      "m/s": { factor: 1, label: "m/s" },
      mph: { factor: 2.236936, label: "mph" },
      kph: { factor: 3.6, label: "kph" },
      knots: { factor: 1.943844, label: "knots" },
    } as const;

    const selected = conversions[windUnit];
    return `${(valueMps * selected.factor).toFixed(1)} ${selected.label}`;
  };

  const {
    forecast: sagerForecast,
    loading: sagerLoading,
    error: sagerError,
    refetch: refetchSager,
  } = useSagerForecast();

  const {
    forecast: tempestForecast,
    loading: tempestLoading,
    error: tempestError,
    refetch: refetchTempest,
  } = useTempestForecast();

  const {
    forecast: zambrettiForecast,
    loading: zambrettiLoading,
    error: zambrettiError,
    refetch: refetchZambretti,
  } = useZambrettiForecast();

  const tempestFailure =
    !tempestLoading &&
    (tempestError || tempestForecast?.error || (!tempestForecast ? "No Tempest forecast data available" : null));
  const zambrettiFailure =
    !zambrettiLoading &&
    (zambrettiError || zambrettiForecast?.error || (!zambrettiForecast ? "No Zambretti forecast data available" : null));

  const activeSource = useMemo(() => {
    if (selectedSource === "zambretti" && zambrettiFailure) {
      return "tempest";
    }

    if (selectedSource === "tempest" && tempestFailure) {
      return "sager";
    }

    return selectedSource;
  }, [selectedSource, tempestFailure, zambrettiFailure]);

  const loading =
    activeSource === "tempest"
      ? tempestLoading
      : activeSource === "zambretti"
      ? zambrettiLoading
      : sagerLoading;

  const error =
    activeSource === "tempest"
      ? tempestError
      : activeSource === "zambretti"
      ? zambrettiError
      : sagerError;

  useEffect(() => {
    if (selectedSource !== "tempest" || !tempestFailure) {
      return;
    }

    const failureText = String(tempestFailure);
    const message = failureText.includes("rejected") || failureText.includes("401")
      ? "WeatherFlow rejected the Tempest API token. Update it in Settings. Showing Sager instead."
      : failureText.includes("API token")
      ? "Tempest forecast needs a WeatherFlow API token. Configure it in Settings. Showing Sager instead."
      : `Tempest forecast unavailable: ${failureText}. Showing Sager instead.`;

    setFallbackNotice(message);
  }, [selectedSource, tempestFailure]);

  useEffect(() => {
    if (selectedSource !== "zambretti" || !zambrettiFailure) {
      return;
    }

    const failureText = String(zambrettiFailure);
    setFallbackNotice(`Zambretti forecast unavailable: ${failureText}. Showing Tempest instead.`);
    void setPreferredForecastSource("tempest");
  }, [selectedSource, zambrettiFailure, setPreferredForecastSource]);

  const handleSourceChange = async (source: "tempest" | "sager" | "zambretti") => {
    setFallbackNotice(null);
    if (source === selectedSource) return;
    await setPreferredForecastSource(source);
  };

  const renderSourceButtons = () => (
    <div className="forecast-toggle-group">
      <button className={`forecast-toggle-btn ${selectedSource === "tempest" ? "active" : ""}`} onClick={() => void handleSourceChange("tempest")}>Tempest</button>
      <button className={`forecast-toggle-btn ${selectedSource === "sager" ? "active" : ""}`} onClick={() => void handleSourceChange("sager")}>Sager</button>
      <button className={`forecast-toggle-btn ${selectedSource === "zambretti" ? "active" : ""}`} onClick={() => void handleSourceChange("zambretti")}>Zambretti</button>
    </div>
  );

  if (loading) {
    return (
      <div className="sager-panel">
        <div className="panel-header-row">
          <h3>Forecast</h3>
          {renderSourceButtons()}
        </div>
        <div className="loading">Loading forecast...</div>
      </div>
    );
  }

  if (error || (activeSource === "tempest" ? !tempestForecast : activeSource === "zambretti" ? !zambrettiForecast : !sagerForecast)) {
    return (
      <div className="sager-panel">
        <div className="panel-header-row">
          <h3>Forecast</h3>
          {renderSourceButtons()}
        </div>
        <div className="error">{error || "No forecast data available"}</div>
        <button
          className="retry-btn"
          onClick={
            activeSource === "tempest"
              ? refetchTempest
              : activeSource === "zambretti"
              ? refetchZambretti
              : refetchSager
          }
        >
          Retry
        </button>
      </div>
    );
  }

  if (activeSource === "zambretti") {
    const forecast = zambrettiForecast!;
    const issuedAt = forecast.localTime > 0 ? formatLocalDateTime(forecast.localTime * 1000) : "--";

    return (
      <div className="sager-panel zambretti-mode">
        <div className="panel-header-row">
          <h3>Forecast</h3>
          {renderSourceButtons()}
        </div>

        {fallbackNotice && (
          <div className="forecast-inline-notice">{fallbackNotice}</div>
        )}

        <div className="forecast-main zambretti-main">
          <div className="forecast-info zambretti-info">
            <p className="zambretti-kicker">Traditional pressure forecast</p>
            <h2 className="forecast-text">{forecast.forecastText || "Forecast unavailable"}</h2>
            <p className="pressure-trend">{forecast.pressureTrend.toUpperCase()} PRESSURE TREND</p>
          </div>
        </div>

        <div className="forecast-details forecast-details-grid">
          <div className="forecast-details-col">
            <div className="detail-item">
              <span className="label">Pressure</span>
              <span className="value">{forecast.pressureMb !== null ? `${forecast.pressureMb.toFixed(1)} mb` : "--"}</span>
            </div>
            <div className="detail-item">
              <span className="label">3h Delta</span>
              <span className="value">{forecast.pressureDelta3hMb !== null ? `${forecast.pressureDelta3hMb > 0 ? "+" : ""}${forecast.pressureDelta3hMb.toFixed(2)} mb` : "--"}</span>
            </div>
          </div>
          <div className="forecast-details-col">
            <div className="detail-item">
              <span className="label">Wind Direction</span>
              <span className="value">{forecast.windDirectionDeg !== null ? `${Math.round(forecast.windDirectionDeg)}°` : "--"}</span>
            </div>
            <div className="detail-item">
              <span className="label">Issued</span>
              <span className="value">{issuedAt}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSource === "tempest") {
    const current = tempestForecast?.current ?? {};
    const daily = tempestForecast?.daily ?? [];
    const today = (daily[0] as Record<string, unknown> | undefined) ?? {};

    const condition = (current.conditions as string) || (today.conditions as string) || "Forecast available";
    const iconName = ((current.icon as string) || (today.icon as string) || "").toLowerCase();
    const icon = TEMPEST_ICON_TO_EMOJI[iconName] || "🌤️";
    const tempNow = (current.air_temperature as number | undefined) ?? null;
    const hi = (today.air_temp_high as number | undefined) ?? null;
    const lo = (today.air_temp_low as number | undefined) ?? null;
    const precip = (today.precip_probability as number | undefined) ?? null;
    const wind = (today.wind_avg as number | undefined) ?? (current.wind_avg as number | undefined) ?? null;

    return (
      <div className="sager-panel tempest-mode">
        <div className="panel-header-row">
          <h3>Forecast</h3>
          {renderSourceButtons()}
        </div>

        <div className="forecast-main">
          <div className="forecast-icon">{icon}</div>
          <div className="forecast-info">
            <h2 className="forecast-text">{condition}</h2>
            <p className="pressure-trend">Tempest Better Forecast</p>
          </div>
        </div>

        <div className="forecast-details forecast-details-grid">
          <div className="forecast-details-col">
            <div className="detail-item">
              <span className="label">Current Temp</span>
              <span className="value">{formatTemp(tempNow, 1)}</span>
            </div>
            <div className="detail-item">
              <span className="label">High / Low</span>
              <span className="value">{hi !== null && lo !== null ? `${formatTemp(hi, 0)} / ${formatTemp(lo, 0)}` : "--"}</span>
            </div>
          </div>
          <div className="forecast-details-col">
            <div className="detail-item">
              <span className="label">Precip Chance</span>
              <span className="value">{precip !== null ? `${Math.round(precip)}%` : "--"}</span>
            </div>
            <div className="detail-item">
              <span className="label">Wind</span>
              <span className="value">{formatWind(wind)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const forecast = sagerForecast!;
  const forecastInfo = FORECAST_CODES[forecast.forecastCode] || {
    text: "Unknown",
    emoji: "❓",
    color: "#666",
  };
  const pressureTrend = SAGER_DESCRIPTIONS[forecast.forecastCode] || "Unknown";

  return (
    <div className="sager-panel">
      <div className="panel-header-row">
        <h3>Forecast</h3>
        {renderSourceButtons()}
      </div>

      {fallbackNotice && (
        <div className="forecast-inline-notice">{fallbackNotice}</div>
      )}
      
      <div className="forecast-main">
        <div className="forecast-icon" style={{ color: forecastInfo.color }}>
          {forecastInfo.emoji}
        </div>
        
        <div className="forecast-info">
          <h2 className="forecast-text">{forecastInfo.text}</h2>
          <p className="pressure-trend">{pressureTrend}</p>
        </div>
      </div>

      <div className="forecast-details">
        <div className="detail-item">
          <span className="label">Sea Level Pressure Trend</span>
          <span className="value">{forecast.seaLevelPressureTrend}</span>
        </div>

        <div className="detail-item">
          <span className="label">Last Updated</span>
          <span className="value">
            {formatLocalDateTime(forecast.localTime * 1000)}
          </span>
        </div>

        <div className="detail-item">
          <span className="label">Forecast Text</span>
          <span className="value forecast-description">{forecast.forecastText}</span>
        </div>
      </div>

      <div className="forecast-info-box">
        <p>
          Sager mode predicts weather from pressure trends over recent observations.
        </p>
      </div>
    </div>
  );
}
