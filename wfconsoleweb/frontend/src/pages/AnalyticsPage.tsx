/**
 * Advanced analytics page
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  LineChart,
  Line,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useHistoricalData } from "../hooks/useWeather";
import { useSettings } from "../context/SettingsContext";
import { formatLocalTime } from "../utils/dateTime";
import "./AnalyticsPage.css";

type MetricPoint = {
  timestamp: number;
  [key: string]: number | null;
};

const mergeSeriesByTimestamp = (
  seriesDefinitions: Array<{ data: MetricPoint[]; keys: string[] }>
): MetricPoint[] => {
  const byTimestamp = new Map<number, MetricPoint>();

  for (const seriesDef of seriesDefinitions) {
    for (const point of seriesDef.data) {
      const timestamp = point.timestamp;
      const existing = byTimestamp.get(timestamp) ?? { timestamp };

      for (const key of seriesDef.keys) {
        if (point[key] !== undefined) {
          existing[key] = point[key];
        }
      }

      byTimestamp.set(timestamp, existing);
    }
  }

  return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
};

const getNumericValues = (data: MetricPoint[], keys: string[]): number[] => {
  const values: number[] = [];

  for (const point of data) {
    for (const key of keys) {
      const value = point[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        values.push(value);
      }
    }
  }

  return values;
};

const createDomain = (
  values: number[],
  options?: { floor?: number; ceil?: number; minSpan?: number; paddingRatio?: number }
): [number, number] => {
  if (values.length === 0) {
    const floor = options?.floor ?? 0;
    const ceil = options?.ceil ?? floor + 1;
    return [floor, ceil];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, options?.minSpan ?? 1);
  const padding = span * (options?.paddingRatio ?? 0.08);

  let domainMin = min - padding;
  let domainMax = max + padding;

  if (options?.floor !== undefined) {
    domainMin = Math.max(options.floor, domainMin);
  }
  if (options?.ceil !== undefined) {
    domainMax = Math.min(options.ceil, domainMax);
  }

  if (domainMax <= domainMin) {
    domainMax = domainMin + Math.max(options?.minSpan ?? 1, 1);
  }

  return [domainMin, domainMax];
};

const toWindCardinal = (degrees: number): string => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return dirs[index];
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<number>(24); // hours
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.innerWidth <= 768;
  });
  const { settings } = useSettings();
  const temperatureUnit = settings?.temperatureUnit || "C";
  const pressureUnit = settings?.pressureUnit || "mb";
  const windSpeedUnit = settings?.windSpeedUnit || "m/s";
  const rainfallUnit = settings?.rainfallUnit || "mm";

  const convertTemperature = useCallback(
    (value: number) => (temperatureUnit === "F" ? (value * 9) / 5 + 32 : value),
    [temperatureUnit]
  );

  const convertPressure = useCallback(
    (value: number) => {
      if (pressureUnit === "inHg") return value * 0.0295299830714;
      return value;
    },
    [pressureUnit]
  );

  const convertWind = useCallback(
    (value: number) => {
      const factorByUnit: Record<string, number> = {
        "m/s": 1,
        mph: 2.23694,
        kph: 3.6,
        knots: 1.94384,
      };

      return value * (factorByUnit[windSpeedUnit] ?? 1);
    },
    [windSpeedUnit]
  );

  const convertRainfall = useCallback(
    (value: number) => {
      if (rainfallUnit === "in") return value / 25.4;
      return value;
    },
    [rainfallUnit]
  );

  const formatAxisValue = (value: number) => value.toFixed(1);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const { data: temperature } = useHistoricalData("temperature", timeRange);
  const { data: humidity } = useHistoricalData("humidity", timeRange);
  const { data: pressure } = useHistoricalData("pressure", timeRange);
  const { data: windSpeed } = useHistoricalData("wind", timeRange);
  const { data: windGust } = useHistoricalData("wind-gust", timeRange);
  const { data: windDirection } = useHistoricalData("wind-direction", timeRange);
  const { data: rainfallTotal } = useHistoricalData("rainfall", timeRange);
  const { data: rainfallRate } = useHistoricalData("rainfall-rate", timeRange);
  const { data: uvIndex } = useHistoricalData("uv-index", timeRange);
  const { data: solar } = useHistoricalData("solar", timeRange);
  const { data: lightning } = useHistoricalData("lightning-strikes", timeRange);

  const convertedTemperature = useMemo(
    () =>
      (temperature || []).map((item: MetricPoint) => ({
        ...item,
        temperature: item.temperature == null ? null : convertTemperature(item.temperature),
        feelsLike: item.feelsLike == null ? null : convertTemperature(item.feelsLike),
      })),
    [temperature, convertTemperature]
  );

  const convertedHumidity = useMemo(() => humidity || [], [humidity]);

  const convertedPressure = useMemo(
    () =>
      (pressure || []).map((item: MetricPoint) => ({
        ...item,
        pressure: item.pressure == null ? null : convertPressure(item.pressure),
      })),
    [pressure, convertPressure]
  );

  const convertedWindSpeed = useMemo(
    () =>
      (windSpeed || []).map((item: MetricPoint) => ({
        ...item,
        windSpeed: item.windSpeed == null ? null : convertWind(item.windSpeed),
      })),
    [windSpeed, convertWind]
  );

  const convertedWindGust = useMemo(
    () =>
      (windGust || []).map((item: MetricPoint) => ({
        ...item,
        windGust: item.windGust == null ? null : convertWind(item.windGust),
      })),
    [windGust, convertWind]
  );

  const convertedWindDirection = useMemo(() => windDirection || [], [windDirection]);

  const convertedRainfallTotal = useMemo(
    () =>
      (rainfallTotal || []).map((item: MetricPoint) => ({
        ...item,
        rainfall: item.rainfall == null ? null : convertRainfall(item.rainfall),
      })),
    [rainfallTotal, convertRainfall]
  );

  const convertedRainfallRate = useMemo(
    () =>
      (rainfallRate || []).map((item: MetricPoint) => ({
        ...item,
        rainfallRate: item.rainfallRate == null ? null : convertRainfall(item.rainfallRate),
      })),
    [rainfallRate, convertRainfall]
  );

  const convertedUv = useMemo(() => uvIndex || [], [uvIndex]);

  const illuminance = useMemo(
    () =>
      (solar || []).map((item: MetricPoint) => ({
        timestamp: item.timestamp,
        illuminanceLux: item.solarRadiation == null ? null : item.solarRadiation * 93,
      })),
    [solar]
  );

  const convertedLightning = useMemo(() => lightning || [], [lightning]);

  const tempHumidityFeelsLikeData = useMemo(
    () =>
      mergeSeriesByTimestamp([
        { data: convertedTemperature, keys: ["temperature", "feelsLike"] },
        { data: convertedHumidity, keys: ["humidity"] },
      ]),
    [convertedTemperature, convertedHumidity]
  );

  const windData = useMemo(
    () =>
      mergeSeriesByTimestamp([
        { data: convertedWindSpeed, keys: ["windSpeed"] },
        { data: convertedWindGust, keys: ["windGust"] },
        { data: convertedWindDirection, keys: ["windDirection"] },
      ]),
    [convertedWindSpeed, convertedWindGust, convertedWindDirection]
  );

  const rainfallData = useMemo(
    () =>
      mergeSeriesByTimestamp([
        { data: convertedRainfallTotal, keys: ["rainfall"] },
        { data: convertedRainfallRate, keys: ["rainfallRate"] },
      ]),
    [convertedRainfallTotal, convertedRainfallRate]
  );

  const uvIlluminanceData = useMemo(
    () =>
      mergeSeriesByTimestamp([
        { data: convertedUv, keys: ["uvIndex"] },
        { data: illuminance, keys: ["illuminanceLux"] },
      ]),
    [convertedUv, illuminance]
  );

  const tempDomain = useMemo(
    () => createDomain(getNumericValues(tempHumidityFeelsLikeData, ["temperature", "feelsLike"]), { minSpan: 2, paddingRatio: 0.1 }),
    [tempHumidityFeelsLikeData]
  );

  const pressureDomain = useMemo(
    () => createDomain(getNumericValues(convertedPressure, ["pressure"]), { minSpan: 0.8, paddingRatio: 0.12 }),
    [convertedPressure]
  );

  const windSpeedDomain = useMemo(
    () => createDomain(getNumericValues(windData, ["windSpeed", "windGust"]), { floor: 0, minSpan: 2, paddingRatio: 0.12 }),
    [windData]
  );

  const rainfallTotalDomain = useMemo(
    () => createDomain(getNumericValues(rainfallData, ["rainfall"]), { floor: 0, minSpan: 0.2, paddingRatio: 0.2 }),
    [rainfallData]
  );

  const rainfallRateDomain = useMemo(
    () => createDomain(getNumericValues(rainfallData, ["rainfallRate"]), { floor: 0, minSpan: 0.2, paddingRatio: 0.2 }),
    [rainfallData]
  );

  const lightningDomain = useMemo(() => {
    const values = getNumericValues(convertedLightning, ["lightningStrikes"]);
    const max = values.length ? Math.max(...values) : 1;
    return [0, Math.max(1, Math.ceil(max * 1.15))] as [number, number];
  }, [convertedLightning]);

  const uvDomain = useMemo(() => {
    const values = getNumericValues(uvIlluminanceData, ["uvIndex"]);
    const max = values.length ? Math.max(...values) : 11;
    return [0, Math.max(11, Math.ceil(max + 1))] as [number, number];
  }, [uvIlluminanceData]);

  const illuminanceDomain = useMemo(
    () => createDomain(getNumericValues(uvIlluminanceData, ["illuminanceLux"]), { floor: 0, minSpan: 500, paddingRatio: 0.15 }),
    [uvIlluminanceData]
  );

  const formatTimeTick = useCallback(
    (ts: number) => {
      const formatted = formatLocalTime(ts * 1000);
      if (!isMobile) {
        return formatted;
      }

      const parts = formatted.split(" ");
      return parts.length > 0 ? parts[0] : formatted;
    },
    [isMobile]
  );

  const xAxisProps = useMemo(
    () => ({
      stroke: "rgba(255, 255, 255, 0.5)",
      tickFormatter: formatTimeTick,
      minTickGap: isMobile ? 24 : 10,
      interval: isMobile ? "preserveStartEnd" as const : 0,
      tick: { fontSize: isMobile ? 10 : 12 },
    }),
    [formatTimeTick, isMobile]
  );

  const legendProps = useMemo(
    () => ({
      iconSize: isMobile ? 10 : 12,
      wrapperStyle: {
        fontSize: isMobile ? "11px" : "12px",
        lineHeight: isMobile ? "1.2" : "1.3",
        whiteSpace: "normal" as const,
      },
    }),
    [isMobile]
  );

  const chartHeights = useMemo(
    () => ({
      standard: isMobile ? 250 : 320,
      compact: isMobile ? 230 : 280,
    }),
    [isMobile]
  );

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <h1>Analytics Dashboard</h1>
        <div className="time-range-selector">
          {[12, 24, 48, 168].map((hours) => (
            <button
              key={hours}
              className={`time-btn ${timeRange === hours ? "active" : ""}`}
              onClick={() => setTimeRange(hours)}
            >
              {hours === 12 ? "12h" : hours === 24 ? "24h" : hours === 48 ? "48h" : "1w"}
            </button>
          ))}
        </div>
      </header>

      <div className="analytics-content">
        <section className="chart-section">
          <h2>Temperature, Humidity, and Feels Like</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={chartHeights.standard}>
              <LineChart data={tempHumidityFeelsLikeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="timestamp" {...xAxisProps} />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={tempDomain} tickFormatter={(value) => formatAxisValue(Number(value))} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (typeof value !== "number") return [value, name];
                    if (name.includes("Humidity")) return [`${value.toFixed(0)}%`, name];
                    return [`${value.toFixed(1)}°${temperatureUnit}`, name];
                  }}
                />
                <Legend {...legendProps} />
                <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#ff7a18" strokeWidth={2.4} dot={false} isAnimationActive={false} name={`Temperature (°${temperatureUnit})`} />
                <Line yAxisId="left" type="monotone" dataKey="feelsLike" stroke="#ffd166" strokeWidth={2.2} strokeDasharray="6 4" dot={false} isAnimationActive={false} name={`Feels Like (°${temperatureUnit})`} />
                <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#5bc0eb" strokeWidth={2.2} dot={false} isAnimationActive={false} name="Humidity (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <h2>Pressure</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={chartHeights.compact}>
              <LineChart data={convertedPressure}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="timestamp" {...xAxisProps} />
                <YAxis stroke="rgba(255, 255, 255, 0.5)" domain={pressureDomain} tickFormatter={(value) => formatAxisValue(Number(value))} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)} ${pressureUnit}`, "Pressure"]}
                />
                <Legend {...legendProps} />
                <Line type="monotone" dataKey="pressure" stroke="#88d498" strokeWidth={2.4} dot={false} isAnimationActive={false} name={`Pressure (${pressureUnit})`} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <h2>Wind Speed, Gust, and Direction</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={chartHeights.standard}>
              <LineChart data={windData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="timestamp" {...xAxisProps} />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={windSpeedDomain} tickFormatter={(value) => formatAxisValue(Number(value))} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="rgba(255, 255, 255, 0.5)"
                  domain={[0, 360]}
                  ticks={[0, 45, 90, 135, 180, 225, 270, 315, 360]}
                  tickFormatter={(value) => toWindCardinal(Number(value))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name.includes("Direction")) return [`${value.toFixed(0)}°`, name];
                    return [`${value.toFixed(1)} ${windSpeedUnit}`, name];
                  }}
                />
                <Legend {...legendProps} />
                <Line yAxisId="left" type="monotone" dataKey="windSpeed" stroke="#59a5d8" strokeWidth={2.3} dot={false} isAnimationActive={false} name={`Wind Speed (${windSpeedUnit})`} />
                <Line yAxisId="left" type="monotone" dataKey="windGust" stroke="#f28f3b" strokeWidth={2.3} dot={false} isAnimationActive={false} name={`Wind Gust (${windSpeedUnit})`} />
                <Line yAxisId="right" type="monotone" dataKey="windDirection" stroke="#c77dff" strokeWidth={2} dot={false} isAnimationActive={false} name="Wind Direction (°)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <h2>Rainfall Totals and Rainfall Rate</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={chartHeights.standard}>
              <ComposedChart data={rainfallData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="timestamp" {...xAxisProps} />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={rainfallTotalDomain} tickFormatter={(value) => formatAxisValue(Number(value))} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={rainfallRateDomain} tickFormatter={(value) => formatAxisValue(Number(value))} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name.includes("Rate")) return [`${value.toFixed(2)} ${rainfallUnit}/h`, name];
                    return [`${value.toFixed(2)} ${rainfallUnit}`, name];
                  }}
                />
                <Legend {...legendProps} />
                <Bar yAxisId="left" dataKey="rainfall" fill="#2ec4b6" name={`Rainfall Total (${rainfallUnit})`} opacity={0.78} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="rainfallRate" stroke="#ffbf69" strokeWidth={2.4} dot={false} isAnimationActive={false} name={`Rainfall Rate (${rainfallUnit}/h)`} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <h2>Lightning Strikes</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={chartHeights.compact}>
              <LineChart data={convertedLightning}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="timestamp" {...xAxisProps} />
                <YAxis stroke="rgba(255, 255, 255, 0.5)" domain={lightningDomain} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number) => [Math.round(value), "Strikes (3h count)"]}
                />
                <Legend {...legendProps} />
                <Line type="monotone" dataKey="lightningStrikes" stroke="#ef476f" strokeWidth={2.4} dot={false} isAnimationActive={false} name="Lightning Strikes (3h Count)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <h2>UV Index and Illuminance</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={chartHeights.standard}>
              <LineChart data={uvIlluminanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="timestamp" {...xAxisProps} />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={uvDomain} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={illuminanceDomain} tickFormatter={(value) => `${Math.round(Number(value))}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name.includes("Illuminance")) return [`${Math.round(value)} lux`, name];
                    return [value.toFixed(1), name];
                  }}
                />
                <Legend {...legendProps} />
                <Line yAxisId="left" type="monotone" dataKey="uvIndex" stroke="#9d4edd" strokeWidth={2.4} dot={false} isAnimationActive={false} name="UV Index" />
                <Line yAxisId="right" type="monotone" dataKey="illuminanceLux" stroke="#ffd166" strokeWidth={2.2} dot={false} isAnimationActive={false} name="Illuminance (lux)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
