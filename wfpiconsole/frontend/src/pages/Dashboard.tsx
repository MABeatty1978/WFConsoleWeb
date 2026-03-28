/**
 * Dashboard page - main weather display
 */

import React, { useEffect, useState } from "react";
import { useObservation, useStationInfo, useWebSocket } from "../hooks/useWeather";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import CurrentConditionsPanel from "../components/CurrentConditionsPanel";
import HistoryChartsPanel from "../components/HistoryChartsPanel";
import AlertsPanel from "../components/AlertsPanel";
import SagerForecastPanel from "../components/SagerForecastPanel";
import AstronomicalPanel from "../components/AstronomicalPanel";
import DataExportModal from "../components/DataExportModal";
import "./Dashboard.css";

export default function Dashboard() {
  const { observation, conditions, rapidWind, loading: condLoading, error: condError } = useObservation(true);
  const { station, loading: stationLoading, error: stationError } = useStationInfo();
  const { connected, error: wsError } = useWebSocket(true);
  const { username } = useAuth();
  const { settings } = useSettings();
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
            <section className="dashboard-row primary">
              <CurrentConditionsPanel
                observation={observation}
                conditions={conditions}
                rapidWind={rapidWind}
                station={station}
              />
            </section>

            <section className="dashboard-row">
              <div className="panels-grid">
                <SagerForecastPanel />
                <AstronomicalPanel />
              </div>
            </section>

            <section className="dashboard-row">
              <div className="charts-grid">
                <HistoryChartsPanel metric="temperature" title="Temperature Trend" />
                <HistoryChartsPanel metric="humidity" title="Humidity Trend" />
              </div>
            </section>

            <section className="dashboard-row">
              <div className="charts-grid">
                <HistoryChartsPanel metric="pressure" title="Pressure Trend" />
                <HistoryChartsPanel metric="wind" title="Wind Speed Trend" />
              </div>
            </section>

            <section className="dashboard-row">
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
