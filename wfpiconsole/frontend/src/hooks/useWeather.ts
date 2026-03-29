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
  const [rapidWind, setRapidWind] = useState<{
    timestamp: string;
    wind_speed_mps: number | null;
    wind_gust_mps: number | null;
    wind_direction_deg: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastObservationTsMsRef = useRef<number>(0);
  const lastRapidWindTsMsRef = useRef<number>(0);

  const getWindCardinal = useCallback((degrees: number | null | undefined): string => {
    if (degrees === null || degrees === undefined) {
      return "--";
    }

    const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }, []);

  const normalizeRealtimeObservation = useCallback((payload: Record<string, unknown>): Partial<Observation> => ({
    timestamp: typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString(),
    packet_type: typeof payload.packet_type === "string" ? payload.packet_type : null,
    device_id: typeof payload.device_id === "string" ? payload.device_id : null,
    temp_c: typeof payload.air_temperature === "number" ? payload.air_temperature : null,
    humidity: typeof payload.relative_humidity === "number" ? payload.relative_humidity : null,
    pressure_mb: typeof payload.sea_level_pressure === "number" ? payload.sea_level_pressure : null,
    wind_speed_mps: typeof payload.wind_speed === "number" ? payload.wind_speed : null,
    wind_gust_mps: typeof payload.wind_gust === "number" ? payload.wind_gust : null,
    wind_direction_deg: typeof payload.wind_direction === "number" ? payload.wind_direction : null,
    rainfall_mm: typeof payload.rainfall_rate === "number" ? payload.rainfall_rate : null,
    solar_radiation_wm2: typeof payload.solar_radiation === "number" ? payload.solar_radiation : null,
    uv_index: typeof payload.uv_index === "number" ? payload.uv_index : null,
    lightning_strike_count: typeof payload.lightning_strike_count_3h === "number" ? payload.lightning_strike_count_3h : null,
    lightning_strike_last_distance_km: typeof payload.lightning_strike_last_distance === "number" ? payload.lightning_strike_last_distance : null,
    battery_voltage: typeof payload.battery_voltage === "number" ? payload.battery_voltage : null,
    signal_strength: typeof payload.rssi === "number" ? payload.rssi : null,
  }), []);

  const isRapidWindLikePacket = useCallback((normalized: Partial<Observation>): boolean => {
    if ((normalized.packet_type ?? null) === "rapid_wind") {
      return true;
    }

    const hasWind = (
      normalized.wind_speed_mps !== null ||
      normalized.wind_gust_mps !== null ||
      normalized.wind_direction_deg !== null
    );

    const hasNonWindObservationFields = (
      normalized.temp_c !== null ||
      normalized.humidity !== null ||
      normalized.pressure_mb !== null ||
      normalized.rainfall_mm !== null ||
      normalized.solar_radiation_wm2 !== null ||
      normalized.uv_index !== null
    );

    return hasWind && !hasNonWindObservationFields;
  }, []);

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
      const normalized = normalizeRealtimeObservation(obs as unknown as Record<string, unknown>);
      const packetType = normalized.packet_type ?? null;
      const isRapidWindPacket = isRapidWindLikePacket(normalized);
      const obsTsMs = typeof normalized.timestamp === "string"
        ? Date.parse(normalized.timestamp)
        : Number.NaN;

      // On reconnect, backend may replay buffered packets; drop stale/out-of-order
      // messages so live panels stay current and advance at the true packet cadence.
      if (Number.isFinite(obsTsMs) && obsTsMs < lastObservationTsMsRef.current) {
        return;
      }

      if (Number.isFinite(obsTsMs)) {
        lastObservationTsMsRef.current = obsTsMs;
      }

      setObservation((current) => {
        if (!current) {
          return normalized as Observation;
        }

        return {
          ...current,
          ...Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== null)),
        };
      });

      if (isRapidWindPacket) {
        if (Number.isFinite(obsTsMs) && obsTsMs < lastRapidWindTsMsRef.current) {
          return;
        }

        if (Number.isFinite(obsTsMs)) {
          lastRapidWindTsMsRef.current = obsTsMs;
        }

        setRapidWind((current) => {
          const speed = normalized.wind_speed_mps ?? current?.wind_speed_mps ?? null;
          const gustCandidate = normalized.wind_gust_mps ?? current?.wind_gust_mps ?? speed;
          const gust = Math.max(
            speed ?? Number.NEGATIVE_INFINITY,
            gustCandidate ?? Number.NEGATIVE_INFINITY,
          );

          return {
            timestamp: typeof normalized.timestamp === "string" ? normalized.timestamp : new Date().toISOString(),
            wind_speed_mps: speed,
            wind_gust_mps: Number.isFinite(gust) ? gust : null,
            wind_direction_deg: normalized.wind_direction_deg ?? current?.wind_direction_deg ?? null,
          };
        });

        setConditions((current) => {
          if (!current) {
            return current;
          }

          const windSpeed = normalized.wind_speed_mps ?? current.wind_speed_mps;
          const windDirection = normalized.wind_direction_deg ?? current.wind_direction_deg;
          const windGust = Math.max(
            windSpeed ?? Number.NEGATIVE_INFINITY,
            normalized.wind_gust_mps ?? current.wind_gust_mps ?? Number.NEGATIVE_INFINITY,
          );

          return {
            ...current,
            wind_speed_mps: windSpeed,
            wind_speed_mph: windSpeed !== null && windSpeed !== undefined ? windSpeed * 2.23694 : current.wind_speed_mph,
            wind_gust_mps: Number.isFinite(windGust) ? windGust : null,
            wind_gust_mph: Number.isFinite(windGust) ? windGust * 2.23694 : current.wind_gust_mph,
            wind_direction_deg: windDirection,
            wind_direction_cardinal: getWindCardinal(windDirection),
            observation_timestamp: typeof normalized.timestamp === "string" ? normalized.timestamp : current.observation_timestamp,
          };
        });
        return;
      }

      if (packetType !== "rapid_wind") {
        void fetchLatest();
      }
    });

    return unsubscribe;
  }, [autoRefresh, fetchLatest, getWindCardinal, isRapidWindLikePacket, normalizeRealtimeObservation]);

  return { observation, conditions, rapidWind, loading, error, refetch: fetchLatest };
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
