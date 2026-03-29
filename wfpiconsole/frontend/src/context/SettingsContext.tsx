/**
 * React Context for application settings
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiClient } from "../services/api";

export type TemperatureUnit = "C" | "F";
export type WindSpeedUnit = "m/s" | "mph" | "kph" | "knots";
export type PressureUnit = "mb" | "inHg" | "hPa";
export type RainfallUnit = "mm" | "in";
export type ForecastSource = "tempest" | "sager";
export type AtmosPanelMode = "lightning" | "barometer";

export interface AppSettings {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  pressureUnit: PressureUnit;
  rainfallUnit: RainfallUnit;
  preferredForecastSource: ForecastSource;
  preferredAtmosPanel: AtmosPanelMode;
  language: string;
  timeFormat: "12h" | "24h";
  dateFormat: string;
  panelLayout: "grid" | "list";
  refreshInterval: number;
  enableNotifications: boolean;
  compactMode: boolean;
}

export interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setTemperatureUnit: (unit: TemperatureUnit) => Promise<void>;
  setWindSpeedUnit: (unit: WindSpeedUnit) => Promise<void>;
  setPressureUnit: (unit: PressureUnit) => Promise<void>;
  setRainfallUnit: (unit: RainfallUnit) => Promise<void>;
  setPreferredForecastSource: (source: ForecastSource) => Promise<void>;
  setPreferredAtmosPanel: (mode: AtmosPanelMode) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

/**
 * Default settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  temperatureUnit: "C",
  windSpeedUnit: "m/s",
  pressureUnit: "mb",
  rainfallUnit: "mm",
  preferredForecastSource: "tempest",
  preferredAtmosPanel: "barometer",
  language: "en",
  timeFormat: "24h",
  dateFormat: "YYYY-MM-DD",
  panelLayout: "grid",
  refreshInterval: 30,
  enableNotifications: true,
  compactMode: false,
};

/**
 * Provider component for settings state
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        const displaySettings = await apiClient.getDisplaySettings();
        
        // Merge with defaults.  Prefer localStorage (client-side override) then the
        // server-persisted value, then the hard-coded default so that saved preferences
        // are respected both across browser sessions and across server restarts.
        const merged: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...displaySettings,
          temperatureUnit: (localStorage.getItem("tempUnit") || displaySettings.temperature_unit || "C") as TemperatureUnit,
          windSpeedUnit: (localStorage.getItem("windUnit") || displaySettings.wind_speed_unit || "m/s") as WindSpeedUnit,
          pressureUnit: (localStorage.getItem("pressureUnit") || displaySettings.pressure_unit || "mb") as PressureUnit,
          rainfallUnit: (displaySettings.rainfall_unit || localStorage.getItem("rainfallUnit") || "mm") as RainfallUnit,
          preferredForecastSource: (displaySettings.preferred_forecast_source || localStorage.getItem("preferredForecastSource") || "tempest") as ForecastSource,
          preferredAtmosPanel: (displaySettings.preferred_atmos_panel || localStorage.getItem("preferredAtmosPanel") || "barometer") as AtmosPanelMode,
        };

        setSettings(merged);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
        // Use defaults on error
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    if (!settings) return;

    try {
      setError(null);
      
      // Build the API payload with proper snake_case field names so that unit
      // preferences (stored in camelCase on the client) are actually persisted
      // in the database when the user changes them.
      const apiPayload = {
        ...settings,
        ...(newSettings.temperatureUnit !== undefined && { temperature_unit: newSettings.temperatureUnit }),
        ...(newSettings.windSpeedUnit !== undefined && { wind_speed_unit: newSettings.windSpeedUnit }),
        ...(newSettings.pressureUnit !== undefined && { pressure_unit: newSettings.pressureUnit }),
        ...(newSettings.rainfallUnit !== undefined && { rainfall_unit: newSettings.rainfallUnit }),
        ...(newSettings.preferredForecastSource !== undefined && { preferred_forecast_source: newSettings.preferredForecastSource }),
        ...(newSettings.preferredAtmosPanel !== undefined && { preferred_atmos_panel: newSettings.preferredAtmosPanel }),
        ...Object.fromEntries(
          Object.entries(newSettings).filter(([k]) => ![
            "temperatureUnit",
            "windSpeedUnit",
            "pressureUnit",
            "rainfallUnit",
            "preferredForecastSource",
            "preferredAtmosPanel",
          ].includes(k))
        ),
      };

      // Update on server
      const updated = await apiClient.updateDisplaySettings(apiPayload);

      // Update local state
      const merged = { ...settings, ...updated, ...newSettings };
      setSettings(merged);

      // Store local preferences
      if (newSettings.temperatureUnit) {
        localStorage.setItem("tempUnit", newSettings.temperatureUnit);
      }
      if (newSettings.windSpeedUnit) {
        localStorage.setItem("windUnit", newSettings.windSpeedUnit);
      }
      if (newSettings.pressureUnit) {
        localStorage.setItem("pressureUnit", newSettings.pressureUnit);
      }
      if (newSettings.rainfallUnit) {
        localStorage.setItem("rainfallUnit", newSettings.rainfallUnit);
      }
      if (newSettings.preferredForecastSource) {
        localStorage.setItem("preferredForecastSource", newSettings.preferredForecastSource);
      }
      if (newSettings.preferredAtmosPanel) {
        localStorage.setItem("preferredAtmosPanel", newSettings.preferredAtmosPanel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
      throw err;
    }
  }, [settings]);

  const setTemperatureUnit = useCallback(
    async (unit: TemperatureUnit) => {
      await updateSettings({ temperatureUnit: unit });
    },
    [updateSettings]
  );

  const setWindSpeedUnit = useCallback(
    async (unit: WindSpeedUnit) => {
      await updateSettings({ windSpeedUnit: unit });
    },
    [updateSettings]
  );

  const setPressureUnit = useCallback(
    async (unit: PressureUnit) => {
      await updateSettings({ pressureUnit: unit });
    },
    [updateSettings]
  );

  const setRainfallUnit = useCallback(
    async (unit: RainfallUnit) => {
      await updateSettings({ rainfallUnit: unit });
    },
    [updateSettings]
  );

  const setPreferredForecastSource = useCallback(
    async (source: ForecastSource) => {
      await updateSettings({ preferredForecastSource: source });
    },
    [updateSettings]
  );

  const setPreferredAtmosPanel = useCallback(
    async (mode: AtmosPanelMode) => {
      await updateSettings({ preferredAtmosPanel: mode });
    },
    [updateSettings]
  );

  const value: SettingsContextType = {
    settings,
    loading,
    error,
    updateSettings,
    setTemperatureUnit,
    setWindSpeedUnit,
    setPressureUnit,
    setRainfallUnit,
    setPreferredForecastSource,
    setPreferredAtmosPanel,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Hook to use settings context
 */
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
