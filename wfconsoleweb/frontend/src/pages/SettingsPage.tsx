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
  const { logout, isAdmin, refreshAuth, username } = useAuth();
  const { settings, setTemperatureUnit, setWindSpeedUnit, setPressureUnit, setRainfallUnit, setDistanceUnit } = useSettings();
  const { currentTheme, themes, switchTheme } = useThemeContext();
  const [activeTabs, setActiveTabs] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [stationForm, setStationForm] = useState<StationFormState>(DEFAULT_STATION_FORM);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationSaving, setStationSaving] = useState(false);
  const [weatherFlowApiKey, setWeatherFlowApiKey] = useState("");
  const [weatherFlowConfigured, setWeatherFlowConfigured] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [alertThresholds, setAlertThresholds] = useState({
    extreme_heat_c: 40.0,
    extreme_cold_c: -20.0,
    high_wind_mps: 15.5,
    extreme_wind_mps: 25.7,
    high_uv: 10.0,
    lightning_distance_km: 5.0,
    heavy_rain_mm: 50.0,
  });
  const [alertNotifications, setAlertNotifications] = useState({
    alert_email_enabled: false,
    alert_email_address: "",
    alert_browser_push_enabled: false,
    alert_cooldown_minutes: 60,
  });
  const [alertThresholdsLoading, setAlertThresholdsLoading] = useState(false);
  const [alertThresholdsSaving, setAlertThresholdsSaving] = useState(false);
  const [alertNotificationsLoading, setAlertNotificationsLoading] = useState(false);
  const [alertNotificationsSaving, setAlertNotificationsSaving] = useState(false);
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<Record<string, unknown> | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [serverStatusLoading, setServerStatusLoading] = useState(false);
  const [serverRestarting, setServerRestarting] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartSupported, setAutostartSupported] = useState(true);
  const [autostartUpdating, setAutostartUpdating] = useState(false);
  const [autostartPlatform, setAutostartPlatform] = useState("unknown");
  const [autostartStatusMessage, setAutostartStatusMessage] = useState("");
  const [autostartStatusError, setAutostartStatusError] = useState("");

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Unit conversion helpers for alert thresholds
  const convertTempToBackend = (value: number, displayUnit: "C" | "F"): number => {
    if (displayUnit === "C") return value;
    return (value - 32) * (5 / 9);
  };

  const convertTempFromBackend = (value: number, displayUnit: "C" | "F"): number => {
    if (displayUnit === "C") return value;
    return value * (9 / 5) + 32;
  };

  const convertWindToBackend = (value: number, displayUnit: string): number => {
    if (displayUnit === "m/s") return value;
    if (displayUnit === "mph") return value / 2.237;
    if (displayUnit === "kph") return value / 3.6;
    if (displayUnit === "knots") return value / 1.944;
    return value;
  };

  const convertWindFromBackend = (value: number, displayUnit: string): number => {
    if (displayUnit === "m/s") return value;
    if (displayUnit === "mph") return value * 2.237;
    if (displayUnit === "kph") return value * 3.6;
    if (displayUnit === "knots") return value * 1.944;
    return value;
  };

  const convertDistanceToBackend = (value: number, displayUnit: string): number => {
    if (displayUnit === "km") return value;
    return value / 0.621371;
  };

  const convertDistanceFromBackend = (value: number, displayUnit: string): number => {
    if (displayUnit === "km") return value;
    return value * 0.621371;
  };

  const convertRainfallToBackend = (value: number, displayUnit: string): number => {
    if (displayUnit === "mm") return value;
    return value * 25.4;
  };

  const convertRainfallFromBackend = (value: number, displayUnit: string): number => {
    if (displayUnit === "mm") return value;
    return value / 25.4;
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

    const loadApiKeyStatus = async () => {
      try {
        setApiKeyLoading(true);
        const response = await apiClient.listApiKeys();
        const weatherFlowKey = response.api_keys.find((key) =>
          ["weatherflow", "tempest"].includes(key.service)
        );
        setWeatherFlowConfigured(Boolean(weatherFlowKey?.is_configured));
      } catch {
        showMessage("error", "Failed to load API key status");
      } finally {
        setApiKeyLoading(false);
      }
    };

    const loadServerStatus = async () => {
      try {
        setServerStatusLoading(true);
        const response = await apiClient.getServerAutostartStatus();
        if (!isMounted) {
          return;
        }

        setAutostartEnabled(Boolean(response.enabled));
        setAutostartSupported(Boolean(response.supported ?? true));
        setAutostartPlatform(String(response.platform ?? "unknown"));
        setAutostartStatusMessage(String(response.message ?? ""));
        setAutostartStatusError(String(response.error ?? ""));
      } catch {
        if (!isMounted) {
          return;
        }
        setAutostartSupported(false);
        setAutostartStatusMessage("");
        setAutostartStatusError("Failed to load server autostart status.");
        showMessage("error", "Failed to load server autostart status.");
      } finally {
        if (isMounted) {
          setServerStatusLoading(false);
        }
      }
    };

    const loadAlertThresholds = async () => {
      try {
        setAlertThresholdsLoading(true);
        const response = await apiClient.getAlertThresholds();
        if (!isMounted) {
          return;
        }
        // Convert backend units to display units
        const tempUnit = settings?.temperature_unit || "C";
        const windUnit = settings?.wind_speed_unit || "m/s";
        const distUnit = settings?.distance_unit || "km";
        const rainUnit = settings?.rainfall_unit || "mm";
        setAlertThresholds({
          extreme_heat_c: convertTempFromBackend(response.extreme_heat_c ?? 40.0, tempUnit),
          extreme_cold_c: convertTempFromBackend(response.extreme_cold_c ?? -20.0, tempUnit),
          high_wind_mps: convertWindFromBackend(response.high_wind_mps ?? 15.5, windUnit),
          extreme_wind_mps: convertWindFromBackend(response.extreme_wind_mps ?? 25.7, windUnit),
          high_uv: response.high_uv ?? 10.0,
          lightning_distance_km: convertDistanceFromBackend(response.lightning_distance_km ?? 5.0, distUnit),
          heavy_rain_mm: convertRainfallFromBackend(response.heavy_rain_mm ?? 50.0, rainUnit),
        });
      } catch {
        if (!isMounted) {
          return;
        }
        showMessage("error", "Failed to load alert thresholds");
      } finally {
        if (isMounted) {
          setAlertThresholdsLoading(false);
        }
      }
    };

    const loadAlertNotifications = async () => {
      try {
        setAlertNotificationsLoading(true);
        const response = await apiClient.getAlertNotificationSettings();
        if (!isMounted) {
          return;
        }
        setAlertNotifications({
          alert_email_enabled: response.alert_email_enabled ?? false,
          alert_email_address: response.alert_email_address ?? "",
          alert_browser_push_enabled: response.alert_browser_push_enabled ?? false,
          alert_cooldown_minutes: response.alert_cooldown_minutes ?? 60,
        });
      } catch {
        if (!isMounted) {
          return;
        }
        showMessage("error", "Failed to load notification settings");
      } finally {
        if (isMounted) {
          setAlertNotificationsLoading(false);
        }
      }
    };

    loadStationConfig();
    loadApiKeyStatus();
    loadServerStatus();
    loadAlertThresholds();
    loadAlertNotifications();

    return () => {
      isMounted = false;
    };
  }, [isAdmin]);

  // Reload alert thresholds when unit settings change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let isMounted = true;
    const tempUnit = settings?.temperature_unit || "C";
    const windUnit = settings?.wind_speed_unit || "m/s";
    const distUnit = settings?.distance_unit || "km";
    const rainUnit = settings?.rainfall_unit || "mm";

    const loadAlertThresholds = async () => {
      try {
        setAlertThresholdsLoading(true);
        const response = await apiClient.getAlertThresholds();
        if (!isMounted) {
          return;
        }
        // Convert backend units to display units
        setAlertThresholds({
          extreme_heat_c: convertTempFromBackend(response.extreme_heat_c ?? 40.0, tempUnit),
          extreme_cold_c: convertTempFromBackend(response.extreme_cold_c ?? -20.0, tempUnit),
          high_wind_mps: convertWindFromBackend(response.high_wind_mps ?? 15.5, windUnit),
          extreme_wind_mps: convertWindFromBackend(response.extreme_wind_mps ?? 25.7, windUnit),
          high_uv: response.high_uv ?? 10.0,
          lightning_distance_km: convertDistanceFromBackend(response.lightning_distance_km ?? 5.0, distUnit),
          heavy_rain_mm: convertRainfallFromBackend(response.heavy_rain_mm ?? 50.0, rainUnit),
        });
      } catch {
        if (!isMounted) {
          return;
        }
      } finally {
        if (isMounted) {
          setAlertThresholdsLoading(false);
        }
      }
    };

    loadAlertThresholds();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, settings]);

  const toggleTab = (tab: string) => {
    const newTabs = new Set(activeTabs);
    if (newTabs.has(tab)) {
      newTabs.delete(tab);
    } else {
      newTabs.add(tab);
    }
    setActiveTabs(newTabs);
  };

  const handleUnitChange = async (unitType: "temp" | "wind" | "pressure" | "rainfall" | "distance", value: string) => {
    try {
      if (unitType === "temp") {
        await setTemperatureUnit(value as "C" | "F");
      } else if (unitType === "wind") {
        await setWindSpeedUnit(value as "m/s" | "mph" | "kph" | "knots");
      } else if (unitType === "pressure") {
        await setPressureUnit(value as "mb" | "inHg" | "hPa");
      } else if (unitType === "rainfall") {
        await setRainfallUnit(value as "mm" | "in");
      } else if (unitType === "distance") {
        await setDistanceUnit(value as "km" | "mi");
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

  const handleWeatherFlowTokenSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!weatherFlowApiKey.trim()) {
      showMessage("error", "Enter a WeatherFlow API token before saving.");
      return;
    }

    try {
      setApiKeySaving(true);
      await apiClient.configureApiKey({
        service: "weatherflow",
        key: weatherFlowApiKey.trim(),
      });
      setWeatherFlowConfigured(true);
      setWeatherFlowApiKey("");
      showMessage("success", "WeatherFlow API token saved successfully");
    } catch {
      showMessage("error", "Failed to save WeatherFlow API token");
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleWeatherFlowTokenDelete = async () => {
    try {
      setApiKeySaving(true);
      await apiClient.deleteApiKey("weatherflow");
      setWeatherFlowConfigured(false);
      setWeatherFlowApiKey("");
      showMessage("success", "WeatherFlow API token removed");
    } catch {
      showMessage("error", "Failed to remove WeatherFlow API token");
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleUsernameChange = async (event: React.FormEvent) => {
    event.preventDefault();

    const targetUsername = newUsername.trim();
    if (!targetUsername) {
      showMessage("error", "Enter a new username.");
      return;
    }
    if (!usernameCurrentPassword) {
      showMessage("error", "Enter current password to confirm username change.");
      return;
    }

    try {
      setUsernameSaving(true);
      await apiClient.changeUsername(usernameCurrentPassword, targetUsername);
      await refreshAuth();
      setUsernameCurrentPassword("");
      setNewUsername("");
      showMessage("success", "Username updated successfully.");
    } catch {
      showMessage("error", "Failed to update username.");
    } finally {
      setUsernameSaving(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!passwordCurrent || !passwordNew) {
      showMessage("error", "Enter current and new password.");
      return;
    }

    if (passwordNew !== passwordConfirm) {
      showMessage("error", "New password and confirmation do not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      await apiClient.changePassword(passwordCurrent, passwordNew);
      setPasswordCurrent("");
      setPasswordNew("");
      setPasswordConfirm("");
      showMessage("success", "Password updated successfully.");
    } catch {
      showMessage("error", "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      setCheckingUpdates(true);
      const response = await apiClient.checkForUpdates();
      setUpdateInfo(response);
      const available = Boolean(response.update_available);
      showMessage(
        "success",
        available
          ? `Update available: ${String(response.latest_version || "new release")}`
          : "You are already on the latest version."
      );
    } catch {
      showMessage("error", "Failed to check for updates.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      setInstallingUpdate(true);
      const shouldForceReinstall = Boolean(updateInfo) && !Boolean(updateInfo.update_available);
      const response = await apiClient.installLatestUpdate(shouldForceReinstall);
      setUpdateInfo((current) => ({ ...current, ...response }));
      const status = String(response.status ?? "");
      if (status === "error") {
        showMessage("error", String(response.message ?? "Failed to schedule update download/install."));
        return;
      }

      if (status === "noop") {
        showMessage("success", String(response.message ?? "Already on latest version."));
        return;
      }

      showMessage(
        "success",
        shouldForceReinstall
          ? "Re-download and reinstall scheduled. The service will restart automatically after install."
          : "Update download and installation scheduled. The service will restart automatically after install."
      );
    } catch {
      showMessage("error", "Failed to schedule update download/install.");
    } finally {
      setInstallingUpdate(false);
    }
  };

  const handleAlertThresholdsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setAlertThresholdsSaving(true);
      // Convert display units back to backend units
      const backendThresholds = {
        extreme_heat_c: convertTempToBackend(alertThresholds.extreme_heat_c, settings?.temperature_unit || "C"),
        extreme_cold_c: convertTempToBackend(alertThresholds.extreme_cold_c, settings?.temperature_unit || "C"),
        high_wind_mps: convertWindToBackend(alertThresholds.high_wind_mps, settings?.wind_speed_unit || "m/s"),
        extreme_wind_mps: convertWindToBackend(alertThresholds.extreme_wind_mps, settings?.wind_speed_unit || "m/s"),
        high_uv: alertThresholds.high_uv,
        lightning_distance_km: convertDistanceToBackend(alertThresholds.lightning_distance_km, settings?.distance_unit || "km"),
        heavy_rain_mm: convertRainfallToBackend(alertThresholds.heavy_rain_mm, settings?.rainfall_unit || "mm"),
      };
      await apiClient.updateAlertThresholds(backendThresholds);
      showMessage("success", "Alert thresholds saved successfully");
    } catch {
      showMessage("error", "Failed to save alert thresholds");
    } finally {
      setAlertThresholdsSaving(false);
    }
  };

  const handleAlertThresholdChange = (field: keyof typeof alertThresholds, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAlertThresholds((prev) => ({
      ...prev,
      [field]: numValue,
    }));
  };

  const handleAlertNotificationsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (alertNotifications.alert_email_enabled && !alertNotifications.alert_email_address.trim()) {
      showMessage("error", "Email address is required when email notifications are enabled.");
      return;
    }

    try {
      setAlertNotificationsSaving(true);
      await apiClient.updateAlertNotificationSettings(alertNotifications);
      showMessage("success", "Notification settings saved successfully");
    } catch {
      showMessage("error", "Failed to save notification settings");
    } finally {
      setAlertNotificationsSaving(false);
    }
  };

  const handleAlertNotificationChange = (
    field: keyof typeof alertNotifications,
    value: string | boolean
  ) => {
    setAlertNotifications((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRestartServer = async () => {
    try {
      setServerRestarting(true);
      const response = await apiClient.restartServer();
      showMessage("success", String(response.message ?? "Server restart scheduled."));
    } catch {
      showMessage("error", "Failed to schedule server restart.");
    } finally {
      setServerRestarting(false);
    }
  };

  const refreshServerStatus = async (showToast = false) => {
    try {
      setServerStatusLoading(true);
      const response = await apiClient.getServerAutostartStatus();
      setAutostartEnabled(Boolean(response.enabled));
      setAutostartSupported(Boolean(response.supported ?? true));
      setAutostartPlatform(String(response.platform ?? "unknown"));
      setAutostartStatusMessage(String(response.message ?? ""));
      setAutostartStatusError(String(response.error ?? ""));
      if (showToast) {
        showMessage("success", "Server status refreshed.");
      }
    } catch {
      setAutostartSupported(false);
      setAutostartStatusMessage("");
      setAutostartStatusError("Failed to load server autostart status.");
      showMessage("error", "Failed to load server autostart status.");
    } finally {
      setServerStatusLoading(false);
    }
  };

  const handleAutostartToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    const previous = autostartEnabled;
    setAutostartEnabled(enabled);

    try {
      setAutostartUpdating(true);
      const response = await apiClient.setServerAutostart(enabled);
      const resolvedEnabled = Boolean(response.enabled);
      setAutostartEnabled(resolvedEnabled);
      setAutostartPlatform(String(response.platform ?? autostartPlatform));
      setAutostartSupported(Boolean(response.supported ?? true));
      setAutostartStatusMessage(String(response.message ?? ""));
      setAutostartStatusError(String(response.error ?? ""));
      showMessage(
        "success",
        String(
          response.message ??
          (resolvedEnabled ? "Server autostart enabled." : "Server autostart disabled.")
        )
      );
    } catch (error) {
      setAutostartEnabled(previous);
      const detail = error instanceof Error ? error.message : "Failed to update server autostart setting.";
      setAutostartStatusError(detail);
      showMessage("error", detail);
    } finally {
      setAutostartUpdating(false);
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

              <div className="settings-group">
                <label>Rainfall Unit</label>
                <div className="radio-group">
                  {["mm", "in"].map((unit) => (
                    <label key={unit}>
                      <input
                        type="radio"
                        name="rainfall-unit"
                        value={unit}
                        checked={settings?.rainfallUnit === unit}
                        onChange={(e) => handleUnitChange("rainfall", e.target.value)}
                      />
                      {unit === "in" ? "Inches (in)" : "Millimeters (mm)"}
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label>Distance Unit</label>
                <div className="radio-group">
                  {["km", "mi"].map((unit) => (
                    <label key={unit}>
                      <input
                        type="radio"
                        name="distance-unit"
                        value={unit}
                        checked={settings?.distanceUnit === unit}
                        onChange={(e) => handleUnitChange("distance", e.target.value)}
                      />
                      {unit === "mi" ? "Miles (mi)" : "Kilometers (km)"}
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
            <div className="section-header" onClick={() => toggleTab("api-keys")}>
              <h2>Forecast API</h2>
              <span className={`toggle ${activeTabs.has("api-keys") ? "open" : ""}`}>
                ▼
              </span>
            </div>

            {activeTabs.has("api-keys") && (
              <div className="section-content">
                <p className="section-copy">
                  Forecast sources now include Tempest, Sager, and Zambretti. Tempest Better Forecast requires a WeatherFlow API token. If Tempest is unavailable, the dashboard falls back to Sager. If Zambretti is unavailable, it falls back to Tempest.
                </p>

                {apiKeyLoading ? (
                  <div className="admin-note">
                    <p>Loading API key status...</p>
                  </div>
                ) : (
                  <form className="station-form" onSubmit={handleWeatherFlowTokenSave}>
                    <div className="form-field">
                      <label htmlFor="weatherflow_api_key">WeatherFlow API Token</label>
                      <input
                        id="weatherflow_api_key"
                        name="weatherflow_api_key"
                        type="password"
                        value={weatherFlowApiKey}
                        onChange={(event) => setWeatherFlowApiKey(event.target.value)}
                        placeholder={weatherFlowConfigured ? "Configured. Enter a new token to replace it." : "Paste WeatherFlow API token"}
                        disabled={apiKeySaving}
                      />
                    </div>

                    <div className="admin-note api-key-status-note">
                      <p>Status: {weatherFlowConfigured ? "Configured" : "Not configured"}</p>
                    </div>

                    <div className="form-actions api-key-actions">
                      {weatherFlowConfigured && (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={handleWeatherFlowTokenDelete}
                          disabled={apiKeySaving}
                        >
                          Remove Token
                        </button>
                      )}
                      <button className="save-button" type="submit" disabled={apiKeySaving}>
                        {apiKeySaving ? "Saving..." : weatherFlowConfigured ? "Replace Token" : "Save Token"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </section>
        )}

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

        {isAdmin && (
          <section className="settings-section">
            <div className="section-header" onClick={() => toggleTab("alert-thresholds")}>
              <h2>Alert Thresholds</h2>
              <span className={`toggle ${activeTabs.has("alert-thresholds") ? "open" : ""}`}>
                ▼
              </span>
            </div>

            {activeTabs.has("alert-thresholds") && (
              <div className="section-content">
                <p className="section-copy">
                  Configure the thresholds that trigger weather alerts. The app monitors observations in real-time and fires alerts when conditions exceed these values.
                </p>

                {alertThresholdsLoading || alertNotificationsLoading ? (
                  <div className="admin-note">
                    <p>Loading alert settings...</p>
                  </div>
                ) : (
                  <>
                    <form className="station-form" onSubmit={handleAlertThresholdsSubmit}>
                      <div className="form-group">
                        <h3>Temperature Thresholds</h3>
                        <div className="form-field">
                          <label htmlFor="extreme_heat_c">Extreme Heat ({settings?.temperature_unit || "C"})</label>
                          <input
                            id="extreme_heat_c"
                            type="number"
                            step="0.1"
                            value={alertThresholds.extreme_heat_c.toFixed(1)}
                            onChange={(e) => handleAlertThresholdChange("extreme_heat_c", e.target.value)}
                            disabled={alertThresholdsSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="extreme_cold_c">Extreme Cold ({settings?.temperature_unit || "C"})</label>
                          <input
                            id="extreme_cold_c"
                            type="number"
                            step="0.1"
                            value={alertThresholds.extreme_cold_c.toFixed(1)}
                            onChange={(e) => handleAlertThresholdChange("extreme_cold_c", e.target.value)}
                            disabled={alertThresholdsSaving}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <h3>Wind Thresholds</h3>
                        <div className="form-field">
                          <label htmlFor="high_wind_mps">High Wind ({settings?.wind_speed_unit || "m/s"})</label>
                          <input
                            id="high_wind_mps"
                            type="number"
                            step="0.1"
                            value={alertThresholds.high_wind_mps.toFixed(1)}
                            onChange={(e) => handleAlertThresholdChange("high_wind_mps", e.target.value)}
                            disabled={alertThresholdsSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="extreme_wind_mps">Extreme Wind ({settings?.wind_speed_unit || "m/s"})</label>
                          <input
                            id="extreme_wind_mps"
                            type="number"
                            step="0.1"
                            value={alertThresholds.extreme_wind_mps.toFixed(1)}
                            onChange={(e) => handleAlertThresholdChange("extreme_wind_mps", e.target.value)}
                            disabled={alertThresholdsSaving}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <h3>Other Thresholds</h3>
                        <div className="form-field">
                          <label htmlFor="high_uv">High UV Index</label>
                          <input
                            id="high_uv"
                            type="number"
                            step="0.1"
                            value={alertThresholds.high_uv.toFixed(1)}
                            onChange={(e) => handleAlertThresholdChange("high_uv", e.target.value)}
                            disabled={alertThresholdsSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="lightning_distance_km">Lightning Nearby ({settings?.distance_unit || "km"})</label>
                          <input
                            id="lightning_distance_km"
                            type="number"
                            step="0.1"
                            value={alertThresholds.lightning_distance_km.toFixed(1)}
                            onChange={(e) => handleAlertThresholdChange("lightning_distance_km", e.target.value)}
                            disabled={alertThresholdsSaving}
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="heavy_rain_mm">Heavy Rain ({settings?.rainfall_unit || "mm"})</label>
                          <input
                            id="heavy_rain_mm"
                            type="number"
                            step="0.1"
                            value={alertThresholds.heavy_rain_mm.toFixed(1)}
                            onChange={(e) => handleAlertThresholdChange("heavy_rain_mm", e.target.value)}
                            disabled={alertThresholdsSaving}
                          />
                        </div>
                      </div>

                      <div className="form-actions">
                        <button className="save-button" type="submit" disabled={alertThresholdsSaving}>
                          {alertThresholdsSaving ? "Saving..." : "Save Thresholds"}
                        </button>
                      </div>
                    </form>

                    <form className="station-form" onSubmit={handleAlertNotificationsSubmit}>
                      <div className="form-group">
                        <h3>Notification Settings</h3>
                        <div className="form-field checkbox-field">
                          <label htmlFor="alert_email_enabled">
                            <input
                              id="alert_email_enabled"
                              type="checkbox"
                              checked={alertNotifications.alert_email_enabled}
                              onChange={(e) => handleAlertNotificationChange("alert_email_enabled", e.target.checked)}
                              disabled={alertNotificationsSaving}
                            />
                            <span>Email me alerts</span>
                          </label>
                        </div>

                        {alertNotifications.alert_email_enabled && (
                          <div className="form-field">
                            <label htmlFor="alert_email_address">Email Address</label>
                            <input
                              id="alert_email_address"
                              type="email"
                              value={alertNotifications.alert_email_address}
                              onChange={(e) => handleAlertNotificationChange("alert_email_address", e.target.value)}
                              placeholder="your.email@example.com"
                              disabled={alertNotificationsSaving}
                            />
                          </div>
                        )}

                        <div className="form-field checkbox-field">
                          <label htmlFor="alert_browser_push_enabled">
                            <input
                              id="alert_browser_push_enabled"
                              type="checkbox"
                              checked={alertNotifications.alert_browser_push_enabled}
                              onChange={(e) => handleAlertNotificationChange("alert_browser_push_enabled", e.target.checked)}
                              disabled={alertNotificationsSaving}
                            />
                            <span>Browser push notifications</span>
                          </label>
                        </div>

                        <div className="form-field">
                          <label htmlFor="alert_cooldown_minutes">Alert Cooldown (minutes)</label>
                          <input
                            id="alert_cooldown_minutes"
                            type="number"
                            min="1"
                            step="1"
                            value={alertNotifications.alert_cooldown_minutes}
                            onChange={(e) => handleAlertNotificationChange("alert_cooldown_minutes", parseInt(e.target.value) || 60)}
                            disabled={alertNotificationsSaving}
                          />
                          <p className="helper-text">
                            Prevents the same alert from triggering repeatedly within this time period (e.g., 60 = one alert per hour max).
                          </p>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button className="save-button" type="submit" disabled={alertNotificationsSaving}>
                          {alertNotificationsSaving ? "Saving..." : "Save Notification Settings"}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {isAdmin && (
          <section className="settings-section">
            <div className="section-header" onClick={() => toggleTab("updates")}>
              <h2>Application Updates</h2>
              <span className={`toggle ${activeTabs.has("updates") ? "open" : ""}`}>
                ▼
              </span>
            </div>

            {activeTabs.has("updates") && (
              <div className="section-content">
                <p className="section-copy">
                  Check GitHub Releases for newer versions and auto-install with one click.
                  The installer re-downloads the selected release wheel and creates a database backup before installation.
                </p>

                <div className="form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={handleCheckUpdates}
                    disabled={checkingUpdates || installingUpdate}
                  >
                    {checkingUpdates ? "Checking..." : "Check for Updates"}
                  </button>
                  <button
                    className="save-button"
                    type="button"
                    onClick={handleInstallUpdate}
                    disabled={
                      installingUpdate ||
                      !updateInfo ||
                      !Boolean(updateInfo.wheel_asset_url)
                    }
                  >
                    {installingUpdate
                      ? "Scheduling..."
                      : Boolean(updateInfo?.update_available)
                        ? "Download & Install Latest"
                        : "Re-download & Reinstall"}
                  </button>
                </div>

                {updateInfo && (
                  <div className="admin-note">
                    <p>Current Version: {String(updateInfo.current_version ?? "unknown")}</p>
                    <p>Latest Version: {String(updateInfo.latest_version ?? "unknown")}</p>
                    <p>
                      Auto-Update Support: {Boolean(updateInfo.auto_update_supported ?? true) ? "Enabled" : "Unavailable"}
                    </p>
                    <p>
                      Update Available: {Boolean(updateInfo.update_available) ? "Yes" : "No"}
                    </p>
                    {Boolean(updateInfo.release_url) && (
                      <p>
                        Release: <a href={String(updateInfo.release_url)} target="_blank" rel="noopener noreferrer">View on GitHub</a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {isAdmin && (
          <section className="settings-section">
            <div className="section-header" onClick={() => toggleTab("server") }>
              <h2>Server</h2>
              <span className={`toggle ${activeTabs.has("server") ? "open" : ""}`}>
                ▼
              </span>
            </div>

            {activeTabs.has("server") && (
              <div className="section-content">
                <p className="section-copy">
                  Manage server lifecycle and startup behavior.
                </p>

                <div className="form-actions" style={{ marginBottom: "1rem" }}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={handleRestartServer}
                    disabled={serverRestarting}
                  >
                    {serverRestarting ? "Scheduling Restart..." : "Restart Server"}
                  </button>
                </div>

                <div className="settings-group">
                  <label className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={autostartEnabled}
                      onChange={handleAutostartToggle}
                      disabled={serverStatusLoading || autostartUpdating || !autostartSupported}
                    />
                    Start server automatically when this computer reboots
                  </label>
                  <p className="helper-text">
                    Status: {autostartEnabled ? "Enabled" : "Disabled"} · Platform: {autostartPlatform}
                  </p>
                  {autostartStatusMessage && (
                    <p className="helper-text">{autostartStatusMessage}</p>
                  )}
                  {autostartStatusError && (
                    <p className="helper-text server-error">{autostartStatusError}</p>
                  )}
                  {!autostartSupported && (
                    <p className="helper-text">Autostart management is not available on this system.</p>
                  )}
                  {serverStatusLoading && (
                    <p className="helper-text">Loading current autostart setting...</p>
                  )}
                  <div className="form-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => refreshServerStatus(true)}
                      disabled={serverStatusLoading || autostartUpdating}
                    >
                      {serverStatusLoading ? "Refreshing..." : "Refresh Status"}
                    </button>
                  </div>
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
                  <a href="https://github.com/michaelbeatty9142002/WFConsoleWeb" target="_blank" rel="noopener noreferrer">
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
              <p className="section-copy">
                Logged in as <strong>{username || "admin"}</strong>.
              </p>

              <form className="station-form" onSubmit={handleUsernameChange}>
                <h3>Change Username</h3>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="new_username">New Username</label>
                    <input
                      id="new_username"
                      type="text"
                      value={newUsername}
                      onChange={(event) => setNewUsername(event.target.value)}
                      disabled={usernameSaving}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="username_current_password">Current Password</label>
                    <input
                      id="username_current_password"
                      type="password"
                      value={usernameCurrentPassword}
                      onChange={(event) => setUsernameCurrentPassword(event.target.value)}
                      disabled={usernameSaving}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="save-button" type="submit" disabled={usernameSaving}>
                    {usernameSaving ? "Saving..." : "Update Username"}
                  </button>
                </div>
              </form>

              <form className="station-form" onSubmit={handlePasswordChange}>
                <h3>Change Password</h3>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="password_current">Current Password</label>
                    <input
                      id="password_current"
                      type="password"
                      value={passwordCurrent}
                      onChange={(event) => setPasswordCurrent(event.target.value)}
                      disabled={passwordSaving}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="password_new">New Password</label>
                    <input
                      id="password_new"
                      type="password"
                      value={passwordNew}
                      onChange={(event) => setPasswordNew(event.target.value)}
                      disabled={passwordSaving}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="password_confirm">Confirm New Password</label>
                    <input
                      id="password_confirm"
                      type="password"
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      disabled={passwordSaving}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="save-button" type="submit" disabled={passwordSaving}>
                    {passwordSaving ? "Saving..." : "Update Password"}
                  </button>
                </div>
              </form>

              <div className="form-actions">
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
