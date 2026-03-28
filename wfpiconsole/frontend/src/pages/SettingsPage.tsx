/**
 * Settings page component
 */

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useThemeContext } from "../context/ThemeContext";
import { apiClient } from "../services/api";
import "./SettingsPage.css";

export default function SettingsPage() {
  const { logout, isAdmin } = useAuth();
  const { settings, updateSettings, setTemperatureUnit, setWindSpeedUnit, setPressureUnit } = useSettings();
  const { currentTheme, themes, switchTheme } = useThemeContext();
  const [activeTabs, setActiveTabs] = useState<Set<string>>(new Set(["general"]));
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setMessage({ type: "success", text: "Settings updated successfully" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update settings" });
    }
  };

  const handleThemeSwitch = (themeName: string) => {
    switchTheme(themeName);
    setMessage({ type: "success", text: "Theme changed successfully" });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      setMessage({ type: "error", text: "Logout failed" });
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
                      title={theme.description}
                    >
                      <div
                        className="theme-preview"
                        style={{
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.accent,
                        }}
                      />
                      <span>{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="settings-section">
            <div className="section-header" onClick={() => toggleTab("admin")}>
              <h2>Administration</h2>
              <span className={`toggle ${activeTabs.has("admin") ? "open" : ""}`}>
                ▼
              </span>
            </div>

            {activeTabs.has("admin") && (
              <div className="section-content">
                <div className="admin-note">
                  <p>Admin settings and controls would appear here.</p>
                  <p>Features like user management, API key configuration, and data retention policies.</p>
                </div>
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
                  <a href="https://ko-fi.com" target="_blank" rel="noopener noreferrer">
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
