/**
 * Combined Lightning/Barometer panel with persisted toggle.
 */

import { useEffect, useRef, useState } from "react";
import { CurrentConditions, Observation, WxSummary } from "../types";
import { useSettings } from "../context/SettingsContext";
import "./LightningBarometerPanel.css";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

interface Props {
  conditions: CurrentConditions | null;
  observation: Observation | null;
  wxSummary: WxSummary | null;
}

export default function LightningBarometerPanel({ conditions, observation, wxSummary }: Props) {
  const { settings, setPreferredAtmosPanel } = useSettings();
  const mode = settings?.preferredAtmosPanel ?? "barometer";
  const distanceUnit = settings?.distanceUnit ?? "km";
  const [lastStrikeDetectedAtMs, setLastStrikeDetectedAtMs] = useState<number | null>(null);
  const [boltFlash, setBoltFlash] = useState(false);
  const previousStrikeCountRef = useRef<number | null>(null);
  const lastEvtStrikeTsRef = useRef<string | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  const handleModeChange = async (nextMode: "lightning" | "barometer") => {
    if (nextMode === mode) return;
    await setPreferredAtmosPanel(nextMode);
  };

  const pressure = conditions?.pressure_mb ?? null;
  const pressureInHg = pressure !== null ? pressure * 0.0295299830714 : null;
  const pressureBand =
    pressure === null
      ? "Unknown"
      : pressure < 1009
        ? "Low"
        : pressure > 1022
          ? "High"
          : "Normal";
  const pressureTrend = conditions?.pressure_trend ?? null;
  const strikeCount = wxSummary?.current.lightning_strikes_3h ?? observation?.lightning_strike_count ?? 0;
  const strikesToday = wxSummary?.current.lightning_strikes_today ?? null;
  const strikesMonth = wxSummary?.current.lightning_strikes_month ?? null;
  const strikesYear = wxSummary?.current.lightning_strikes_year ?? null;
  const strikeFreq10m = wxSummary?.current.lightning_frequency_10min ?? null;
  const hasActiveNearbyLightning = (strikeFreq10m ?? 0) > 0;
  const strikeDistanceKm =
    wxSummary?.current.lightning_last_distance_km ??
    observation?.lightning_strike_last_distance_km ??
    conditions?.lightning_distance_km ??
    null;
  const strikeDistanceDisplay =
    strikeDistanceKm === null
      ? "--"
      : distanceUnit === "mi"
      ? `${(strikeDistanceKm * 0.621371).toFixed(1)} mi`
      : `${strikeDistanceKm.toFixed(1)} km`;
  const lightningStatus =
    strikeCount > 100
      ? "Active Lightning Nearby"
      : strikeCount > 0
        ? "Recent Lightning in Last 3 Hours"
        : "No Nearby Lightning in Last 3 Hours";

  const triggerBoltFlash = () => {
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    setBoltFlash(true);
    flashTimeoutRef.current = window.setTimeout(() => {
      setBoltFlash(false);
    }, 1200);
  };

  useEffect(() => {
    // Drive visual strike indication from real event packets (UDP/WebSocket evt_strike).
    if (observation?.packet_type !== "evt_strike") {
      return;
    }

    const eventTs = observation.timestamp ?? null;
    if (eventTs && eventTs === lastEvtStrikeTsRef.current) {
      return;
    }

    lastEvtStrikeTsRef.current = eventTs;
    const eventMs = observation.timestamp ? Date.parse(observation.timestamp) : Date.now();
    const effectiveMs = Number.isNaN(eventMs) ? Date.now() : eventMs;

    setLastStrikeDetectedAtMs(effectiveMs);
    triggerBoltFlash();

    if (mode !== "lightning") {
      void setPreferredAtmosPanel("lightning");
    }
  }, [observation?.packet_type, observation?.timestamp, mode, setPreferredAtmosPanel]);

  useEffect(() => {
    const strikeCountNow = strikeCount ?? 0;
    const previousStrikeCount = previousStrikeCountRef.current;
    const observationTimeMs = observation?.timestamp ? Date.parse(observation.timestamp) : Date.now();
    const effectiveObservationTimeMs = Number.isNaN(observationTimeMs) ? Date.now() : observationTimeMs;

    const hadNewStrike =
      strikeCountNow > 0 &&
      (
        previousStrikeCount === null ||
        strikeCountNow > previousStrikeCount
      );

    if (hadNewStrike) {
      setLastStrikeDetectedAtMs(effectiveObservationTimeMs);
      triggerBoltFlash();
      if (mode !== "lightning") {
        void setPreferredAtmosPanel("lightning");
      }
    }

    if (strikeCountNow > 0 && previousStrikeCount === null && lastStrikeDetectedAtMs === null) {
      // On first load with active strikes, consider this recent activity and surface Lightning.
      setLastStrikeDetectedAtMs(effectiveObservationTimeMs);
      if (mode !== "lightning") {
        void setPreferredAtmosPanel("lightning");
      }
    }

    const referenceStrikeTime = lastStrikeDetectedAtMs ?? (strikeCountNow > 0 ? effectiveObservationTimeMs : null);
    const staleWindowElapsed = referenceStrikeTime !== null && (Date.now() - referenceStrikeTime) >= TWO_HOURS_MS;

    if (staleWindowElapsed && mode !== "barometer") {
      void setPreferredAtmosPanel("barometer");
    }

    previousStrikeCountRef.current = strikeCountNow;
  }, [
    strikeCount,
    observation?.timestamp,
    mode,
    setPreferredAtmosPanel,
    lastStrikeDetectedAtMs,
  ]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="wx-panel atmos-panel">
      <div className="wx-panel-header atmos-header">
        <span className="wx-panel-title">
          {mode === "lightning" ? "Lightning" : "Barometer"}
        </span>
        {mode === "lightning" && (
          <span
            className={`lightning-bolt-indicator ${hasActiveNearbyLightning ? "active" : ""} ${boltFlash ? "flash" : ""}`}
            aria-label="Lightning activity indicator"
            role="img"
          >
            ⚡
          </span>
        )}
        <div className="atmos-toggle-group">
          <button
            className={`atmos-toggle-btn ${mode === "lightning" ? "active" : ""}`}
            onClick={() => void handleModeChange("lightning")}
          >
            Lightning
          </button>
          <button
            className={`atmos-toggle-btn ${mode === "barometer" ? "active" : ""}`}
            onClick={() => void handleModeChange("barometer")}
          >
            Barometer
          </button>
        </div>
      </div>

      {mode === "lightning" ? (
        <div className="atmos-content lightning-content">
          <div className="atmos-item">
            <span className="label">Strikes (3h)</span>
            <span className="value">{strikeCount}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Strikes Today</span>
            <span className="value">{strikesToday ?? "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Strike Freq (10 min)</span>
            <span className="value">{strikeFreq10m !== null ? `${strikeFreq10m.toFixed(2)}/min` : "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Strikes This Month</span>
            <span className="value">{strikesMonth ?? "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Strikes This Year</span>
            <span className="value">{strikesYear ?? "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Last Distance</span>
            <span className="value">
              {strikeDistanceDisplay}
            </span>
          </div>
          <div className="atmos-item">
            <span className="label">Status</span>
            <span className="value">
              {lightningStatus}
            </span>
          </div>
        </div>
      ) : (
        <div className="atmos-content barometer-content">
          <div className="atmos-item">
            <span className="label">Sea Level Pressure</span>
            <span className="value">{pressure !== null ? `${pressure.toFixed(1)} mb` : "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Pressure (inHg)</span>
            <span className="value">{pressureInHg !== null ? `${pressureInHg.toFixed(2)} inHg` : "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Trend</span>
            <span className="value trend-text">{pressureTrend ?? "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Pressure Band</span>
            <span className="value">{pressureBand}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Interpretation</span>
            <span className="value">
              {pressureTrend === "rising"
                ? "Improving conditions"
                : pressureTrend === "falling"
                  ? "Possible unsettled weather"
                  : pressureTrend === "steady"
                    ? "Stable conditions"
                    : "Not enough data"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
