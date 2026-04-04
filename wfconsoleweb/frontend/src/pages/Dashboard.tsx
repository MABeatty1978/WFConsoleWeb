/**
 * Dashboard page - main weather display
 */

import { useObservation, useWebSocket } from "../hooks/useWeather";
import { useWxSummary } from "../hooks/useAdvanced";
import WindPanel from "../components/WindPanel";
import TemperaturePanel from "../components/TemperaturePanel";
import RainfallPanel from "../components/RainfallPanel";
import SagerForecastPanel from "../components/SagerForecastPanel";
import AstronomicalPanel from "../components/AstronomicalPanel";
import LightningBarometerPanel from "../components/LightningBarometerPanel";
import AlertsPanel from "../components/AlertsPanel";
import { formatLocalDateTime } from "../utils/dateTime";
import "./Dashboard.css";

export default function Dashboard() {
  const { observation, conditions, loading: condLoading, error: condError } = useObservation(true);
  const { summary: wxSummary } = useWxSummary();
  const { error: wsError } = useWebSocket(true);

  const loading = condLoading;
  const error = condError || wsError;

  return (
    <div className="dashboard">
      {error && (
        <div className="error-banner">
          <p>⚠ {error}</p>
        </div>
      )}

      <main className="dashboard-main">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading weather data...</p>
          </div>
        ) : (
          <>
            {/* ── Primary 3×2 panel grid ── */}
            <section className="primary-panels-grid">
              <SagerForecastPanel />
              <TemperaturePanel conditions={conditions} wxSummary={wxSummary} />
              <WindPanel
                wxSummary={wxSummary}
                currentWindMps={conditions?.wind_speed_mps ?? null}
                currentGustMps={conditions?.wind_gust_mps ?? null}
                currentWindDirDeg={conditions?.wind_direction_deg ?? null}
              />
              <AstronomicalPanel />
              <RainfallPanel wxSummary={wxSummary} />
              <LightningBarometerPanel
                conditions={conditions}
                observation={observation}
                wxSummary={wxSummary}
              />
            </section>

            <section className="alerts-section">
              <AlertsPanel />
            </section>
          </>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>
          Last updated:{" "}
          {observation?.timestamp
            ? formatLocalDateTime(observation.timestamp)
            : "--"}
        </p>
      </footer>
    </div>
  );
}
