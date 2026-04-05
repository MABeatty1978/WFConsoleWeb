/**
 * React hooks for weather data management
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { Observation, CurrentConditions, StationInfo, TimeSeriesData } from "../types";
import { apiClient } from "../services/api";
import { wsService } from "../services/websocket";

type HistoricalChartPoint = {
  timestamp: number;
  [key: string]: number | null;
};

const computeFeelsLikeC = (tempC: number, humidityPct: number): number => {
  // NOAA heat index approximation in Fahrenheit, converted back to Celsius.
  const tempF = (tempC * 9) / 5 + 32;
  if (tempF < 80 || humidityPct < 40) {
    return tempC;
  }

  const hiF =
    -42.379 +
    2.04901523 * tempF +
    10.14333127 * humidityPct -
    0.22475541 * tempF * humidityPct -
    0.00683783 * tempF * tempF -
    0.05481717 * humidityPct * humidityPct +
    0.00122874 * tempF * tempF * humidityPct +
    0.00085282 * tempF * humidityPct * humidityPct -
    0.00000199 * tempF * tempF * humidityPct * humidityPct;

  return (hiF - 32) * (5 / 9);
};

type RapidWindObservation = {
  timestamp: string;
  wind_speed_mps: number | null;
  wind_gust_mps: number | null;
  wind_direction_deg: number | null;
};

const normalizeRealtimeObservation = (payload: Record<string, unknown>): Partial<Observation> => ({
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
});

const isRapidWindLikePacket = (normalized: Partial<Observation>): boolean => {
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
};

/**
 * Hook for managing current weather observations
 */
export function useObservation(autoRefresh = true) {
  const [observation, setObservation] = useState<Observation | null>(null);
  const [conditions, setConditions] = useState<CurrentConditions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastObservationTsMsRef = useRef<number>(0);
  const hasLoadedOnceRef = useRef(false);

  const fetchLatest = useCallback(async (silent = false) => {
    try {
      if (!silent && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
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
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      fetchLatest(false);
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

      if (isRapidWindPacket) {
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

      if (packetType !== "rapid_wind") {
        void fetchLatest(true);
      }
    });

    return unsubscribe;
  }, [autoRefresh, fetchLatest]);

  return { observation, conditions, loading, error, refetch: fetchLatest };
}

export function useRapidWind() {
  const [rapidWind, setRapidWind] = useState<RapidWindObservation | null>(null);
  const lastRapidWindTsMsRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = wsService.onObservation((obs) => {
      const normalized = normalizeRealtimeObservation(obs as unknown as Record<string, unknown>);

      if (!isRapidWindLikePacket(normalized)) {
        return;
      }

      const obsTsMs = typeof normalized.timestamp === "string"
        ? Date.parse(normalized.timestamp)
        : Number.NaN;

      if (Number.isFinite(obsTsMs) && obsTsMs < lastRapidWindTsMsRef.current) {
        return;
      }

      if (Number.isFinite(obsTsMs)) {
        lastRapidWindTsMsRef.current = obsTsMs;
      }

      flushSync(() => {
        setRapidWind((current) => {
          const speed = typeof normalized.wind_speed_mps === "number"
            ? normalized.wind_speed_mps
            : current?.wind_speed_mps ?? null;
          const gust = typeof normalized.wind_gust_mps === "number"
            ? normalized.wind_gust_mps
            : current?.wind_gust_mps ?? null;
          const direction = typeof normalized.wind_direction_deg === "number"
            ? normalized.wind_direction_deg
            : current?.wind_direction_deg ?? null;

          return {
            timestamp: typeof normalized.timestamp === "string" ? normalized.timestamp : new Date().toISOString(),
            wind_speed_mps: speed,
            wind_gust_mps: gust,
            wind_direction_deg: direction,
          };
        });
      });
    });

    return unsubscribe;
  }, []);

  return rapidWind;
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
  const [data, setData] = useState<HistoricalChartPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizeTimeSeries = useCallback((series: TimeSeriesData, metricName: string) => {
    const dataKeyByMetric: Record<string, string> = {
      temperature: "temperature",
      humidity: "humidity",
      pressure: "pressure",
      wind: "windSpeed",
      "wind-gust": "windGust",
      "wind-direction": "windDirection",
      rainfall: "rainfall",
      "rainfall-rate": "rainfallRate",
      solar: "solarRadiation",
      "uv-index": "uvIndex",
      "lightning-strikes": "lightningStrikes",
    };

    const dataKey = dataKeyByMetric[metricName.toLowerCase()] ?? metricName;

    return series.data_points.reduce<HistoricalChartPoint[]>((points, point) => {
        const timestampMs = Date.parse(point.timestamp);

        if (Number.isNaN(timestampMs)) {
          return points;
        }

        points.push({
          timestamp: Math.floor(timestampMs / 1000),
          [dataKey]: point.value,
        });

        return points;
      }, []);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let result;
      let humidityData: TimeSeriesData | null = null;
      
      switch (metric.toLowerCase()) {
        case "temperature":
          result = await apiClient.getTemperatureHistory(hours, granularity);
          // Also fetch humidity to calculate dew point
          try {
            humidityData = await apiClient.getHumidityHistory(hours, granularity);
          } catch {
            // Dew point is optional, continue without it
          }
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
        case "wind-gust":
          result = await apiClient.getWindGustHistory(hours, granularity);
          break;
        case "wind-direction":
          result = await apiClient.getWindDirectionHistory(hours, granularity);
          break;
        case "rainfall":
          result = await apiClient.getRainfallHistory(hours, granularity);
          break;
        case "rainfall-rate":
          result = await apiClient.getRainfallRateHistory(hours, granularity);
          break;
        case "solar":
          result = await apiClient.getSolarRadiationHistory(hours, granularity);
          break;
        case "uv-index":
          result = await apiClient.getUvIndexHistory(hours, granularity);
          break;
        case "lightning-strikes":
          result = await apiClient.getLightningStrikesHistory(hours, granularity);
          break;
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }

      let normalizedData = normalizeTimeSeries(result, metric);
      
      // Add dew point calculation for temperature
      if (metric.toLowerCase() === "temperature" && humidityData) {
        normalizedData = normalizedData.map((point) => {
          const humidityPoint = humidityData!.data_points.find((hp) => {
            const hDate = new Date(hp.timestamp);
            const pDate = new Date(point.timestamp * 1000);
            return Math.abs(hDate.getTime() - pDate.getTime()) < 60000; // Within 1 minute
          });
          
          if (humidityPoint && point.temperature !== null) {
            const tempC = point.temperature;
            const humidity = humidityPoint.value;
            const a = 17.27;
            const b = 237.7;
            const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
            const dewPoint = (b * alpha) / (a - alpha);
            const feelsLike = computeFeelsLikeC(tempC, humidity);
            return {
              ...point,
              dewPoint: Math.round(dewPoint * 10) / 10,
              feelsLike: Math.round(feelsLike * 10) / 10,
            };
          }
          return point;
        });
      }
      
      setData(normalizedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  }, [metric, hours, granularity, normalizeTimeSeries]);

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
