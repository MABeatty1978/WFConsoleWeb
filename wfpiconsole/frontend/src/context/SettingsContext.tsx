/**
 * React Context for application settings
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { DisplaySettings } from "../types";
import { apiClient } from "../services/api";

export type TemperatureUnit = "C" | "F";
export type WindSpeedUnit = "m/s" | "mph" | "kph" | "knots";
export type PressureUnit = "mb" | "inHg" | "hPa";

export interface AppSettings extends DisplaySettings {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  pressureUnit: PressureUnit;
  language: string;
  timeFormat: "12h" | "24h";
  dateFormat: string;
}

export interface SettingsContextType {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setTemperatureUnit: (unit: TemperatureUnit) => Promise<void>;
  setWindSpeedUnit: (unit: WindSpeedUnit) => Promise<void>;
  setPressureUnit: (unit: PressureUnit) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

/**
 * Default settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  temperatureUnit: "C",
  windSpeedUnit: "m/s",
  pressureUnit: "mb",
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
        
        // Merge with defaults
        const merged: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...displaySettings,
          temperatureUnit: (localStorage.getItem("tempUnit") || "C") as TemperatureUnit,
          windSpeedUnit: (localStorage.getItem("windUnit") || "m/s") as WindSpeedUnit,
          pressureUnit: (localStorage.getItem("pressureUnit") || "mb") as PressureUnit,
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
      
      // Update on server
      const updated = await apiClient.updateDisplaySettings({
        ...settings,
        ...newSettings,
      });

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

  const value: SettingsContextType = {
    settings,
    loading,
    error,
    updateSettings,
    setTemperatureUnit,
    setWindSpeedUnit,
    setPressureUnit,
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
