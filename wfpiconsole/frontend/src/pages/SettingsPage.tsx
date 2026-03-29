/**
 * Settings page component
 */

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useThemeContext } from "../context/ThemeContext";
import { apiClient } from "../services/api";
import { StationInfo } from "../types";
import "./SettingsPage.css";

type StationFormState = {
  station_id: string;
  name: string;
  latitude: string;
  longitude: string;
  elevation_m: string;
  device_id: string;
  hub_sn: string;
  connection_type: string;
};

const DEFAULT_STATION_FORM: StationFormState = {
  station_id: "",
  name: "",
  latitude: "",
  longitude: "",
  elevation_m: "",
  device_id: "",
  hub_sn: "",
  connection_type: "local_broadcast",
};

export default function SettingsPage() {
  const { logout, isAdmin } = useAuth();
  const { settings, setTemperatureUnit, setWindSpeedUnit, setPressureUnit } = useSettings();
  const { currentTheme, themes, switchTheme } = useThemeContext();
  const [activeTabs, setActiveTabs] = useState<Set<string>>(new Set(["general"]));
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [stationForm, setStationForm] = useState<StationFormState>(DEFAULT_STATION_FORM);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationSaving, setStationSaving] = useState(false);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let isMounted = true;

    const loadStationConfig = async () => {
      try {
        setStationLoading(true);
        const station = await apiClient.getStationConfig();
        if (!isMounted) {
          return;
        }

        setStationForm({
          station_id: station.station_id || "",
          name: station.name || "",
          latitude: station.latitude?.toString() || "",
          longitude: station.longitude?.toString() || "",
          elevation_m: station.elevation_m?.toString() || "",
          device_id: station.device_id || "",
          hub_sn: station.hub_sn || "",
          connection_type: station.connection_type || "local_broadcast",
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof Error && error.message.includes("404")) {
          setStationForm(DEFAULT_STATION_FORM);
        } else {
          showMessage("error", "Failed to load station settings");
        }
      } finally {
        if (isMounted) {
          setStationLoading(false);
        }
      }
    };

    loadStationConfig();

    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  const toggleTab = (tab: string) => {
    const newTabs = new Set(activeTabs);
    if (newTabs.has(tab)) {
      newTabs.delete(tab);
    } else {
      newTabs.add(tab);
    }
    setActiveTabs(newTabs);
  };

  const handleUnitChange = async (unitType: "temp" | "wind" | "pressure", value: string) => {
    try {
      if (unitType === "temp") {
        await setTemperatureUnit(value as "C" | "F");
      } else if (unitType === "wind") {
        await setWindSpeedUnit(value as "m/s" | "mph" | "kph" | "knots");
      } else if (unitType === "pressure") {
        await setPressureUnit(value as "mb" | "inHg" | "hPa");
      }
      showMessage("success", "Settings updated successfully");
    } catch {
      showMessage("error", "Failed to update settings");
    }
  };

  const handleThemeSwitch = (themeName: string) => {
    switchTheme(themeName);
    showMessage("success", "Theme changed successfully");
  };

  const handleStationFieldChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setStationForm((current) => ({ ...current, [name]: value }));
  };

  const handleStationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const requiredFields: Array<keyof StationFormState> = [
      "station_id",
      "name",
      "latitude",
      "longitude",
      "elevation_m",
    ];

    const hasMissingRequiredField = requiredFields.some(
      (field) => !stationForm[field].trim()
    );

    if (hasMissingRequiredField) {
      showMessage("error", "Fill in station ID, name, latitude, longitude, and elevation.");
      return;
    }

    const latitude = Number(stationForm.latitude);
    const longitude = Number(stationForm.longitude);
    const elevation = Number(stationForm.elevation_m);

    if ([latitude, longitude, elevation].some((value) => Number.isNaN(value))) {
      showMessage("error", "Latitude, longitude, and elevation must be valid numbers.");
      return;
    }

    try {
      setStationSaving(true);

      const payload: Partial<StationInfo> = {
        station_id: stationForm.station_id.trim(),
        name: stationForm.name.trim(),
        latitude,
        longitude,
        elevation_m: elevation,
        device_id: stationForm.device_id.trim() || null,
        hub_sn: stationForm.hub_sn.trim() || null,
        connection_type: stationForm.connection_type,
      };

      await apiClient.updateStationConfig(payload);
      showMessage("success", "Station settings saved successfully");
    } catch {
      showMessage("error", "Failed to save station settings");
    } finally {
      setStationSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      showMessage("error", "Logout failed");
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Configure your weather dashboard</p>
      </header>

      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.type === "success" ? "✓" : "⚠"} {message.text}
        </div>
      )}

      <main className="settings-main">
        <section className="settings-section">
          <div className="section-header" onClick={() => toggleTab("general")}>
            <h2>Display Settings</h2>
            <span className={`toggle ${activeTabs.has("general") ? "open" : ""}`}>
              ▼
            </span>
          </div>

          {activeTabs.has("general") && (
            <div className="section-content">
              <div className="settings-group">
                <label>Temperature Unit</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="temp-unit"
                      value="C"
                      checked={settings?.temperatureUnit === "C"}
                      onChange={(e) => handleUnitChange("temp", e.target.value)}
                    />
                    Celsius (°C)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="temp-unit"
                      value="F"
                      checked={settings?.temperatureUnit === "F"}
                      onChange={(e) => handleUnitChange("temp", e.target.value)}
                    />
                    Fahrenheit (°F)
                  </label>
                </div>
              </div>

              <div className="settings-group">
                <label>Wind Speed Unit</label>
                <div className="radio-group">
                  {["m/s", "mph", "kph", "knots"].map((unit) => (
                    <label key={unit}>
                      <input
                        type="radio"
                        name="wind-unit"
                        value={unit}
                        checked={settings?.windSpeedUnit === unit}
                        onChange={(e) => handleUnitChange("wind", e.target.value)}
                      />
                      {unit}
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label>Pressure Unit</label>
                <div className="radio-group">
                  {["mb", "inHg", "hPa"].map((unit) => (
                    <label key={unit}>
                      <input
                        type="radio"
                        name="pressure-unit"
                        value={unit}
                        checked={settings?.pressureUnit === unit}
                        onChange={(e) => handleUnitChange("pressure", e.target.value)}
                      />
                      {unit}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="settings-section">
          <div className="section-header" onClick={() => toggleTab("theme")}>
            <h2>Theme</h2>
            <span className={`toggle ${activeTabs.has("theme") ? "open" : ""}`}>
              ▼
            </span>
          </div>

          {activeTabs.has("theme") && (
            <div className="section-content">
              <div className="settings-group">
                <label>Current Theme: {currentTheme?.name}</label>
                <div className="theme-grid">
                  {themes.map((theme) => (
                    <button
                      key={theme.name}
                      className={`theme-preset ${currentTheme?.name === theme.name ? "active" : ""}`}
                      onClick={() => handleThemeSwitch(theme.name)}
                      title={theme.config?.name || theme.name}
                    >
                      <div
                        className="theme-preview"
                        style={{
                          backgroundColor: theme.config?.colors?.primary,
                          borderColor: theme.config?.colors?.accent,
                        }}
                      />
                      <span>{theme.config?.name || theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="settings-section">
              <div className="section-header" onClick={() => toggleTab("station")}>
                <h2>Station Settings</h2>
                <span className={`toggle ${activeTabs.has("station") ? "open" : ""}`}>
                ▼
              </span>
            </div>

              {activeTabs.has("station") && (
              <div className="section-content">
                  <p className="section-copy">
                    Enter the WeatherFlow station metadata used by the dashboard and local broadcast ingestion.
                  </p>

                  {stationLoading ? (
                    <div className="admin-note">
                      <p>Loading station settings...</p>
                    </div>
                  ) : (
                    <form className="station-form" onSubmit={handleStationSubmit}>
                      <div className="form-grid">
                        <div className="form-field">
                          <label htmlFor="station_id">Station ID</label>
                          <input
                            id="station_id"
                            name="station_id"
                            type="text"
                            value={stationForm.station_id}
                            onChange={handleStationFieldChange}
                            placeholder="WeatherFlow station ID"
                            disabled={stationSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="name">Display Name</label>
                          <input
                            id="name"
                            name="name"
                            type="text"
                            value={stationForm.name}
                            onChange={handleStationFieldChange}
                            placeholder="Backyard Tempest"
                            disabled={stationSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="device_id">Tempest Device ID</label>
                          <input
                            id="device_id"
                            name="device_id"
                            type="text"
                            value={stationForm.device_id}
                            onChange={handleStationFieldChange}
                            placeholder="Tempest device ID"
                            disabled={stationSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="connection_type">Connection Type</label>
                          <select
                            id="connection_type"
                            name="connection_type"
                            value={stationForm.connection_type}
                            onChange={handleStationFieldChange}
                            disabled={stationSaving}
                          >
                            <option value="local_broadcast">Local Broadcast</option>
                            <option value="rest_api">REST API</option>
                            <option value="websocket">WebSocket</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label htmlFor="latitude">Latitude</label>
                          <input
                            id="latitude"
                            name="latitude"
                            type="number"
                            step="any"
                            value={stationForm.latitude}
                            onChange={handleStationFieldChange}
                            placeholder="40.7128"
                            disabled={stationSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="longitude">Longitude</label>
                          <input
                            id="longitude"
                            name="longitude"
                            type="number"
                            step="any"
                            value={stationForm.longitude}
                            onChange={handleStationFieldChange}
                            placeholder="-74.0060"
                            disabled={stationSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="elevation_m">Elevation (m)</label>
                          <input
                            id="elevation_m"
                            name="elevation_m"
                            type="number"
                            step="any"
                            value={stationForm.elevation_m}
                            onChange={handleStationFieldChange}
                            placeholder="10"
                            disabled={stationSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="hub_sn">Hub Serial Number</label>
                          <input
                            id="hub_sn"
                            name="hub_sn"
                            type="text"
                            value={stationForm.hub_sn}
                            onChange={handleStationFieldChange}
                            placeholder="Optional"
                            disabled={stationSaving}
                          />
                        </div>
                      </div>

                      <p className="helper-text">
                        Use your WeatherFlow station ID and Tempest device ID. Hub serial is optional.
                      </p>

                      <div className="form-actions">
                        <button className="save-button" type="submit" disabled={stationSaving}>
                          {stationSaving ? "Saving..." : "Save Station Settings"}
                        </button>
                      </div>
                    </form>
                  )}
              </div>
            )}
          </section>
        )}

        <section className="settings-section">
          <div className="section-header" onClick={() => toggleTab("about")}>
            <h2>About & Support</h2>
            <span className={`toggle ${activeTabs.has("about") ? "open" : ""}`}>
              ▼
            </span>
          </div>

          {activeTabs.has("about") && (
            <div className="section-content">
              <div className="about-content">
                <h3>WFConsoleWeb</h3>
                <p>A modern web-based weather dashboard for Tempest weather stations.</p>
                
                <div className="about-links">
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                    GitHub Repository
                  </a>
                  <a href="https://ko-fi.com/michaelbeatty9142002" target="_blank" rel="noopener noreferrer">
                    Support on Ko-fi ☕
                  </a>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="settings-section danger">
          <div className="section-header" onClick={() => toggleTab("logout")}>
            <h2>Account</h2>
            <span className={`toggle ${activeTabs.has("logout") ? "open" : ""}`}>
              ▼
            </span>
          </div>

          {activeTabs.has("logout") && (
            <div className="section-content">
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
