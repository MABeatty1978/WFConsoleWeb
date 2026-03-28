/**
 * React hooks for weather data management
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Observation, CurrentConditions, StationInfo } from "../types";
import { apiClient } from "../services/api";
import { wsService } from "../services/websocket";

/**
 * Hook for managing current weather observations
 */
export function useObservation(autoRefresh = true) {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [conditions, setConditions] = useState<CurrentConditions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [obs, conds] = await Promise.all([
        apiClient.getLatestObservation(),
        apiClient.getCurrentConditions(),
      ]);
      setObservation(obs);
      setConditions(conds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch observations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      fetchLatest();
    }

    // Subscribe to WebSocket updates
    const unsubscribe = wsService.onObservation((obs) => {
      setObservation(obs);
    });

    return unsubscribe;
  }, [autoRefresh, fetchLatest]);

  return { observation, conditions, loading, error, refetch: fetchLatest };
}

/**
 * Hook for managing station configuration
 */
export function useStationInfo() {
  const [station, setStation] = useState<StationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStation = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.getStationInfo();
        setStation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch station info");
      } finally {
        setLoading(false);
      }
    };

    fetchStation();
  }, []);

  return { station, loading, error };
}

/**
 * Hook for managing historical data and charts
 */
export function useHistoricalData(metric: string, hours = 24, granularity: "1min" | "5min" | "hourly" | "daily" = "hourly") {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let result;
      switch (metric.toLowerCase()) {
        case "temperature":
          result = await apiClient.getTemperatureHistory(hours, granularity);
          break;
        case "humidity":
          result = await apiClient.getHumidityHistory(hours, granularity);
          break;
        case "pressure":
          result = await apiClient.getPressureHistory(hours, granularity);
          break;
        case "wind":
          result = await apiClient.getWindSpeedHistory(hours, granularity);
          break;
        case "rainfall":
          result = await apiClient.getRainfallHistory(hours, granularity);
          break;
        case "solar":
          result = await apiClient.getSolarRadiationHistory(hours, granularity);
          break;
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  }, [metric, hours, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for WebSocket connection management
 */
export function useWebSocket(autoConnect = true) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectingRef = useRef(false);

  useEffect(() => {
    if (!autoConnect) return;

    const connect = async () => {
      if (connectingRef.current) return;
      connectingRef.current = true;

      try {
        setError(null);
        await wsService.connect();
        setConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect to WebSocket");
      } finally {
        connectingRef.current = false;
      }
    };

    if (!wsService.isConnected()) {
      connect();
    } else {
      setConnected(true);
    }

    return () => {
      wsService.disconnect();
      setConnected(false);
    };
  }, [autoConnect]);

  return { connected, error };
}

/**
 * Hook for managing theme state
 */
export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<string>("dark-minimalist");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark-minimalist";
    setCurrentTheme(savedTheme);
    setLoading(false);
  }, []);

  const switchTheme = useCallback((themeName: string) => {
    setCurrentTheme(themeName);
    localStorage.setItem("theme", themeName);
  }, []);

  return { currentTheme, switchTheme, loading };
}

/**
 * Hook for temperature unit conversion
 */
export function useTemperatureConverter(unit: "C" | "F" = "C") {
  return useCallback((temp: number | null | undefined): number | null => {
    if (temp === null || temp === undefined) return null;
    if (unit === "F") {
      return (temp * 9) / 5 + 32;
    }
    return temp;
  }, [unit]);
}

/**
 * Hook for wind speed conversion
 */
export function useWindSpeedConverter(
  unit: "m/s" | "mph" | "kph" | "knots" = "m/s"
) {
  return useCallback((speed: number | null | undefined): number | null => {
    if (speed === null || speed === undefined) return null;

    const unitConversions: Record<string, number> = {
      "m/s": 1,
      mph: 2.23694,
      kph: 3.6,
      knots: 1.94384,
    };

    return speed * unitConversions[unit];
  }, [unit]);
}
