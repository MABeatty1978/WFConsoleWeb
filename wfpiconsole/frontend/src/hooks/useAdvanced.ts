/**
 * Extension hooks for advanced features
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { apiClient } from "../services/api";
import { TempestForecastResponse, WxSummary } from "../types";
import { wsService } from "../services/websocket";

type DataPoint = {
  timestamp: string;
  value: number | null;
};

export interface SagerForecast {
  seaLevelPressureTrend: string;
  localTime: number;
  forecastText: string;
  forecastCode: number;
}

export type TempestForecast = TempestForecastResponse;

export interface AstronomicalData {
  sunriseTime: number;
  sunsetTime: number;
  solarNoon: number;
  moonPhase: number;
  moonIllumination: number;
  moonsetTime?: number;
  moonriseTime?: number;
  timezone?: string;
  dataSource?: string;
}

/**
 * Hook for Sager forecast data
 */
export function useSagerForecast() {
  const [forecast, setForecast] = useState<SagerForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Assuming endpoint exists on backend
      const data = await apiClient.getSagerForecast?.();
      setForecast(data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch forecast");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 3600000); // Refresh hourly

    return () => clearInterval(interval);
  }, [fetchForecast]);

  return { forecast, loading, error, refetch: fetchForecast };
}

/**
 * Hook for Tempest Better Forecast data
 */
export function useTempestForecast() {
  const [forecast, setForecast] = useState<TempestForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getTempestForecast?.();

      if (!data) {
        setForecast(null);
        setError("No Tempest forecast data available");
        return;
      }

      if (data.error) {
        setForecast(null);
        setError(data.error);
        return;
      }

      setForecast(data);
    } catch (err) {
      setForecast(null);
      setError(err instanceof Error ? err.message : "Failed to fetch Tempest forecast");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 3600000); // Refresh hourly

    return () => clearInterval(interval);
  }, [fetchForecast]);

  return { forecast, loading, error, refetch: fetchForecast };
}

/**
 * Hook for astronomical data
 */
export function useAstronomicalData() {
  const [data, setData] = useState<AstronomicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const astroData = await apiClient.getAstronomicalData?.();
      setData(astroData || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch astronomical data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3600000); // Refresh hourly

    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for exporting weather data
 */
export function useDataExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportToJSON = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      setExporting(true);
      setError(null);

      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      // Fetch all metrics for the date range
      const [temp, humidity, pressure, wind, rainfall, solar] = await Promise.all([
        apiClient.getTemperatureHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getHumidityHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getPressureHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getWindSpeedHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getRainfallHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getSolarRadiationHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        metrics: {
          temperature: temp,
          humidity,
          pressure,
          wind,
          rainfall,
          solar,
        },
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `weather-export-${startDate.toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  const exportToCSV = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      setExporting(true);
      setError(null);

      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      // Fetch all metrics
      const [temp, humidity, pressure, wind, rainfall, solar] = await Promise.all([
        apiClient.getTemperatureHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getHumidityHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getPressureHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getWindSpeedHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getRainfallHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
        apiClient.getSolarRadiationHistory(
          Math.ceil((endTimestamp - startTimestamp) / 3600),
          "hourly"
        ),
      ]);

      // Merge time series by timestamp from all returned metrics.
      const timestampSet = new Set<string>();
      const collectTimestamps = (points: DataPoint[]) => {
        points.forEach((point) => timestampSet.add(point.timestamp));
      };

      collectTimestamps(temp.data_points);
      collectTimestamps(humidity.data_points);
      collectTimestamps(pressure.data_points);
      collectTimestamps(wind.data_points);
      collectTimestamps(rainfall.data_points);
      collectTimestamps(solar.data_points);

      const toEpochSeconds = (ts: string): number => {
        const parsed = Date.parse(ts);
        return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
      };

      const timestamps = Array.from(timestampSet).sort(
        (a, b) => toEpochSeconds(a) - toEpochSeconds(b)
      );

      const toValueMap = (points: DataPoint[]): Map<string, number | null> => {
        const map = new Map<string, number | null>();
        points.forEach((point) => {
          map.set(point.timestamp, point.value);
        });
        return map;
      };

      const tempMap = toValueMap(temp.data_points);
      const humidityMap = toValueMap(humidity.data_points);
      const pressureMap = toValueMap(pressure.data_points);
      const windMap = toValueMap(wind.data_points);
      const rainfallMap = toValueMap(rainfall.data_points);
      const solarMap = toValueMap(solar.data_points);

      const rows: Array<Array<string | number>> = [
        ["Timestamp", "Temperature (°C)", "Humidity (%)", "Pressure (mb)", "Wind Speed (m/s)", "Rainfall (mm)", "Solar (W/m²)"],
      ];

      timestamps.forEach((ts: string) => {
        const epoch = toEpochSeconds(ts);
        rows.push([
          epoch > 0 ? new Date(epoch * 1000).toISOString() : ts,
          tempMap.get(ts) ?? "",
          humidityMap.get(ts) ?? "",
          pressureMap.get(ts) ?? "",
          windMap.get(ts) ?? "",
          rainfallMap.get(ts) ?? "",
          solarMap.get(ts) ?? "",
        ]);
      });

      // Convert to CSV
      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell)}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `weather-export-${startDate.toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV export failed");
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportToJSON, exportToCSV, exporting, error };
}

/**
 * Hook for custom panel configuration
 */
export function useCustomPanels() {
  const [panels, setPanels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPanels = async () => {
      try {
        setLoading(true);
        setError(null);
        // Load from localStorage as fallback
        const saved = localStorage.getItem("customPanels");
        if (saved) {
          setPanels(JSON.parse(saved));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load panels");
      } finally {
        setLoading(false);
      }
    };

    fetchPanels();
  }, []);

  const savePanels = useCallback((newPanels: any[]) => {
    try {
      setPanels(newPanels);
      localStorage.setItem("customPanels", JSON.stringify(newPanels));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save panels");
    }
  }, []);

  const addPanel = useCallback(
    (panel: any) => {
      const newPanels = [...panels, { ...panel, id: Date.now() }];
      savePanels(newPanels);
    },
    [panels, savePanels]
  );

  const removePanel = useCallback(
    (panelId: number) => {
      const newPanels = panels.filter((p) => p.id !== panelId);
      savePanels(newPanels);
    },
    [panels, savePanels]
  );

  const updatePanel = useCallback(
    (panelId: number, updates: any) => {
      const newPanels = panels.map((p) =>
        p.id === panelId ? { ...p, ...updates } : p
      );
      savePanels(newPanels);
    },
    [panels, savePanels]
  );

  return {
    panels,
    loading,
    error,
    addPanel,
    removePanel,
    updatePanel,
    savePanels,
  };
}

/**
 * Hook for daily/monthly/yearly weather summary data used by dashboard panels.
 * Refreshes every 5 minutes.
 */
export function useWxSummary() {
  const [summary, setSummary] = useState<WxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastRefreshMsRef = useRef(0);

  const fetchSummary = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const data = await apiClient.getWxSummary();
      setSummary(data);
      lastRefreshMsRef.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch weather summary");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    // Keep summary reasonably fresh even without websocket updates.
    const interval = setInterval(() => {
      void fetchSummary(true);
    }, 60_000);

    // Also refresh summary when non-rapid observation packets arrive.
    const unsubscribe = wsService.onObservation((obs) => {
      const packetType = typeof obs.packet_type === "string" ? obs.packet_type : null;
      if (packetType === "rapid_wind") {
        return;
      }

      const now = Date.now();
      // Throttle refreshes so bursts of packets do not spam API calls.
      if (now - lastRefreshMsRef.current < 15_000) {
        return;
      }

      void fetchSummary(true);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}
