/**
 * Combined Lightning/Barometer panel with persisted toggle.
 */

import { useEffect, useRef, useState } from "react";
import { CurrentConditions, Observation } from "../types";
import { useSettings } from "../context/SettingsContext";
import "./LightningBarometerPanel.css";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

interface Props {
  conditions: CurrentConditions | null;
  observation: Observation | null;
}

export default function LightningBarometerPanel({ conditions, observation }: Props) {
  const { settings, setPreferredAtmosPanel } = useSettings();
  const mode = settings?.preferredAtmosPanel ?? "barometer";
  const [lastStrikeDetectedAtMs, setLastStrikeDetectedAtMs] = useState<number | null>(null);
  const previousStrikeCountRef = useRef<number | null>(null);

  const handleModeChange = async (nextMode: "lightning" | "barometer") => {
    if (nextMode === mode) return;
    await setPreferredAtmosPanel(nextMode);
  };

  const pressure = conditions?.pressure_mb ?? null;
  const pressureTrend = conditions?.pressure_trend ?? null;
  const strikeCount = observation?.lightning_strike_count ?? 0;
  const strikeDistanceKm =
    conditions?.lightning_distance_km ??
    observation?.lightning_strike_last_distance_km ??
    null;

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

  return (
    <div className="wx-panel atmos-panel">
      <div className="wx-panel-header atmos-header">
        <span className="wx-panel-title">
          {mode === "lightning" ? "Lightning" : "Barometer"}
        </span>
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
        <div className="atmos-content">
          <div className="atmos-item">
            <span className="label">Strikes (3h)</span>
            <span className="value">{strikeCount}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Last Distance</span>
            <span className="value">
              {strikeDistanceKm !== null ? `${strikeDistanceKm.toFixed(1)} km` : "--"}
            </span>
          </div>
          <div className="atmos-item">
            <span className="label">Status</span>
            <span className="value">
              {strikeCount > 0 ? "Recent Lightning Activity" : "No Recent Strikes (2h+)"}
            </span>
          </div>
        </div>
      ) : (
        <div className="atmos-content">
          <div className="atmos-item">
            <span className="label">Sea Level Pressure</span>
            <span className="value">{pressure !== null ? `${pressure.toFixed(1)} mb` : "--"}</span>
          </div>
          <div className="atmos-item">
            <span className="label">Trend</span>
            <span className="value trend-text">{pressureTrend ?? "--"}</span>
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
