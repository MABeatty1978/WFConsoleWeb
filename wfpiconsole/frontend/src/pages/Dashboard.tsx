/**
 * Dashboard page - main weather display
 */

import React, { useState } from "react";
import { useObservation, useStationInfo, useWebSocket } from "../hooks/useWeather";
import { useWxSummary } from "../hooks/useAdvanced";
import { useAuth } from "../context/AuthContext";
import WindPanel from "../components/WindPanel";
import TemperaturePanel from "../components/TemperaturePanel";
import RainfallPanel from "../components/RainfallPanel";
import SagerForecastPanel from "../components/SagerForecastPanel";
import AstronomicalPanel from "../components/AstronomicalPanel";
import HistoryChartsPanel from "../components/HistoryChartsPanel";
import AlertsPanel from "../components/AlertsPanel";
import DataExportModal from "../components/DataExportModal";
import "./Dashboard.css";

export default function Dashboard() {
  const { observation, conditions, rapidWind, loading: condLoading, error: condError } = useObservation(true);
  const { station, loading: stationLoading, error: stationError } = useStationInfo();
  const { summary: wxSummary } = useWxSummary();
  const { connected, error: wsError } = useWebSocket(true);
  const { username } = useAuth();
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const loading = condLoading || stationLoading;
  const error = condError || stationError || wsError;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Weather Dashboard {station?.name ? `- ${station.name}` : ""}</h1>
          <div className="header-status">
            <span className={`connection-status ${connected ? "connected" : "disconnected"}`}>
              {connected ? "● Connected" : "○ Disconnected"}
            </span>
            <button
              className="export-btn"
              onClick={() => setExportModalOpen(true)}
              title="Export weather data"
            >
              ⬇ Export
            </button>
            {username && <span className="username">Welcome, {username}</span>}
          </div>
        </div>
      </header>

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
            {/* ── Primary 2×2 panel grid ── */}
            <section className="primary-panels-grid">
              <TemperaturePanel conditions={conditions} wxSummary={wxSummary} />
              <WindPanel        rapidWind={rapidWind}   wxSummary={wxSummary} />
              <RainfallPanel    wxSummary={wxSummary} />
              <SagerForecastPanel />
            </section>

            {/* ── Astronomy & secondary info ── */}
            <section className="secondary-panels-grid">
              <AstronomicalPanel />
            </section>

            {/* ── History charts ── */}
            <section className="charts-section">
              <div className="charts-grid">
                <HistoryChartsPanel metric="temperature" title="Temperature Trend" />
                <HistoryChartsPanel metric="humidity"    title="Humidity Trend" />
              </div>
              <div className="charts-grid">
                <HistoryChartsPanel metric="pressure" title="Pressure Trend" />
                <HistoryChartsPanel metric="wind"     title="Wind Speed Trend" />
              </div>
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
            ? new Date(observation.timestamp).toLocaleString()
            : "--"}
        </p>
      </footer>

      <DataExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
    </div>
  );
}
