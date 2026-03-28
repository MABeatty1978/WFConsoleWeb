/**
 * Sager forecast panel component
 */

import React from "react";
import { useSagerForecast } from "../hooks/useAdvanced";
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

export default function SagerForecastPanel() {
  const { forecast, loading, error, refetch } = useSagerForecast();

  if (loading) {
    return (
      <div className="sager-panel">
        <h3>Sager Forecast</h3>
        <div className="loading">Loading forecast...</div>
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <div className="sager-panel">
        <h3>Sager Forecast</h3>
        <div className="error">{error || "No forecast data available"}</div>
        <button className="retry-btn" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  const forecastInfo = FORECAST_CODES[forecast.forecastCode] || {
    text: "Unknown",
    emoji: "❓",
    color: "#666",
  };
  const pressureTrend = SAGER_DESCRIPTIONS[forecast.forecastCode] || "Unknown";

  return (
    <div className="sager-panel">
      <h3>Sager Forecast</h3>
      
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
            {new Date(forecast.localTime * 1000).toLocaleString()}
          </span>
        </div>

        <div className="detail-item">
          <span className="label">Forecast Text</span>
          <span className="value forecast-description">{forecast.forecastText}</span>
        </div>
      </div>

      <div className="forecast-info-box">
        <p>
          The Sager Forecast uses barometric pressure trends to predict weather conditions.
          Based on the observed pressure pattern, the forecast above provides insight into
          likely weather changes in the next 12-24 hours.
        </p>
      </div>
    </div>
  );
}
