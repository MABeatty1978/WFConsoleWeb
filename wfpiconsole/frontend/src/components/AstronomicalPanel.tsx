/**
 * Astronomical data panel component
 */

import React, { useMemo } from "react";
import { useAstronomicalData } from "../hooks/useAdvanced";
import "./AstronomicalPanel.css";

export default function AstronomicalPanel() {
  const { data, loading, error, refetch } = useAstronomicalData();

  const sunProgress = useMemo(() => {
    if (!data) return 0;

    const now = Date.now() / 1000;
    const sunrise = data.sunriseTime;
    const sunset = data.sunsetTime;

    if (now < sunrise || now > sunset) return -1; // Night time
    return ((now - sunrise) / (sunset - sunrise)) * 100;
  }, [data]);

  const moonPhaseEmoji = useMemo(() => {
    if (!data) return "🌙";

    const phase = data.moonPhase;
    if (phase < 0.125 || phase >= 0.875) return "🌑"; // New
    if (phase < 0.25) return "🌒"; // Waxing Crescent
    if (phase < 0.375) return "🌓"; // First Quarter
    if (phase < 0.5) return "🌔"; // Waxing Gibbous
    if (phase < 0.625) return "🌕"; // Full
    if (phase < 0.75) return "🌖"; // Waning Gibbous
    if (phase < 0.875) return "🌗"; // Last Quarter
    return "🌘"; // Waning Crescent
  }, [data]);

  if (loading) {
    return (
      <div className="astro-panel">
        <h3>Astronomical Data</h3>
        <div className="loading">Loading astronomical data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="astro-panel">
        <h3>Astronomical Data</h3>
        <div className="error">{error || "No astronomical data available"}</div>
        <button className="retry-btn" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  const sunrise = new Date(data.sunriseTime * 1000);
  const sunset = new Date(data.sunsetTime * 1000);
  const solarNoon = new Date(data.solarNoon * 1000);
  const daylight = (data.sunsetTime - data.sunriseTime) / 3600;

  return (
    <div className="astro-panel">
      <h3>Astronomical Data</h3>

      <div className="astro-grid">
        <div className="astro-section">
          <h4>☀️ Solar Data</h4>
          
          <div className="sun-progress">
            <div className="sun-bar">
              <div className="sun-position" style={{ left: `${Math.max(0, Math.min(100, sunProgress))}%` }}>
                ☀️
              </div>
              <div className="sun-marker sunrise">Sunrise</div>
              <div className="sun-marker sunset">Sunset</div>
            </div>
          </div>

          <div className="data-item">
            <span className="label">Sunrise</span>
            <span className="value">{sunrise.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          <div className="data-item">
            <span className="label">Solar Noon</span>
            <span className="value">{solarNoon.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          <div className="data-item">
            <span className="label">Sunset</span>
            <span className="value">{sunset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          <div className="data-item">
            <span className="label">Daylight Duration</span>
            <span className="value">{Math.floor(daylight)}h {Math.round((daylight % 1) * 60)}m</span>
          </div>
        </div>

        <div className="astro-section">
          <h4>🌙 Lunar Data</h4>

          <div className="moon-display">
            <div className="moon-icon">{moonPhaseEmoji}</div>
            <div className="moon-illumination">
              <div className="illumination-ring">
                <div
                  className="illumination-fill"
                  style={{ width: `${(data.moonIllumination || 0) * 100}%` }}
                />
              </div>
              <span className="illumination-text">
                {Math.round((data.moonIllumination || 0) * 100)}%
              </span>
            </div>
          </div>

          <div className="data-item">
            <span className="label">Moon Phase</span>
            <span className="value">{getMoonPhaseLabel(data.moonPhase)}</span>
          </div>

          <div className="data-item">
            <span className="label">Illumination</span>
            <span className="value">{Math.round((data.moonIllumination || 0) * 100)}%</span>
          </div>

          {data.moonriseTime && (
            <div className="data-item">
              <span className="label">Moonrise</span>
              <span className="value">
                {new Date(data.moonriseTime * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {data.moonsetTime && (
            <div className="data-item">
              <span className="label">Moonset</span>
              <span className="value">
                {new Date(data.moonsetTime * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="astro-info">
        <p>
          Sunrise and sunset times are computed for the station's location
          and are adjusted for atmospheric refraction.
        </p>
      </div>
    </div>
  );
}

/**
 * Get readable moon phase label
 */
function getMoonPhaseLabel(phase: number): string {
  if (phase < 0.125 || phase >= 0.875) return "New Moon";
  if (phase < 0.25) return "Waxing Crescent";
  if (phase < 0.375) return "First Quarter";
  if (phase < 0.5) return "Waxing Gibbous";
  if (phase < 0.625) return "Full Moon";
  if (phase < 0.75) return "Waning Gibbous";
  if (phase < 0.875) return "Last Quarter";
  return "Waning Crescent";
}
