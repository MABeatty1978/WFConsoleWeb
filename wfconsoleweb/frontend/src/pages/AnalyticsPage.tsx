/**
 * Advanced analytics page
 */

import { useState, useMemo, useCallback } from "react";
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

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<number>(24); // hours
  const { settings } = useSettings();
  const temperatureUnit = settings?.temperatureUnit || "C";
  const pressureUnit = settings?.pressureUnit || "mb";
  const windSpeedUnit = settings?.windSpeedUnit || "m/s";

  const convertTemperature = useCallback(
    (value: number) => (temperatureUnit === "F" ? (value * 9) / 5 + 32 : value),
    [temperatureUnit]
  );

  const convertPressure = useCallback((value: number) => {
    if (pressureUnit === "inHg") return value * 0.0295299830714;
    return value;
  }, [pressureUnit]);

  const convertWind = useCallback((value: number) => {
    const factorByUnit: Record<string, number> = {
      "m/s": 1,
      mph: 2.23694,
      kph: 3.6,
      knots: 1.94384,
    };

    return value * (factorByUnit[windSpeedUnit] ?? 1);
  }, [windSpeedUnit]);

  const formatMetricValue = (metric: "temperature" | "humidity" | "pressure" | "wind", value: number) => {
    if (metric === "humidity") return `${Math.round(value)}%`;
    if (metric === "temperature") return `${value.toFixed(1)}°${temperatureUnit}`;
    if (metric === "pressure") return `${value.toFixed(1)} ${pressureUnit}`;
    return `${value.toFixed(1)} ${windSpeedUnit}`;
  };

  const formatAxisValue = (metric: "temperature" | "humidity" | "pressure" | "wind", value: number) => {
    if (metric === "humidity") return `${Math.round(value)}`;
    return value.toFixed(1);
  };

  // Fetch data for all metrics
  const { data: temperature } = useHistoricalData("temperature", timeRange);
  const { data: humidity } = useHistoricalData("humidity", timeRange);
  const { data: pressure } = useHistoricalData("pressure", timeRange);
  const { data: wind } = useHistoricalData("wind", timeRange);

  const convertedTemperature = useMemo(
    () => temperature?.map((item: any) => ({ ...item, temperature: item.temperature == null ? null : convertTemperature(item.temperature) })) || [],
    [temperature, convertTemperature]
  );

  const convertedHumidity = useMemo(
    () => humidity || [],
    [humidity]
  );

  const convertedPressure = useMemo(
    () => pressure?.map((item: any) => ({ ...item, pressure: item.pressure == null ? null : convertPressure(item.pressure) })) || [],
    [pressure, convertPressure]
  );

  const convertedWind = useMemo(
    () => wind?.map((item: any) => ({ ...item, windSpeed: item.windSpeed == null ? null : convertWind(item.windSpeed) })) || [],
    [wind, convertWind]
  );

  // Calculate statistics
  const stats = useMemo(() => {
    if (!convertedTemperature || convertedTemperature.length === 0) {
      return {
        tempMin: 0,
        tempMax: 0,
        tempAvg: 0,
        humidityMin: 0,
        humidityMax: 0,
        humidityAvg: 0,
        pressureMin: 0,
        pressureMax: 0,
        pressureAvg: 0,
        windMin: 0,
        windMax: 0,
        windAvg: 0,
      };
    }

    const temps = convertedTemperature.map((d: any) => d.temperature).filter((t: any) => t !== null);
    const humidities = convertedHumidity.map((d: any) => d.humidity).filter((h: any) => h !== null) || [];
    const pressures = convertedPressure.map((d: any) => d.pressure).filter((p: any) => p !== null) || [];
    const winds = convertedWind.map((d: any) => d.windSpeed).filter((w: any) => w !== null) || [];

    return {
      tempMin: Math.min(...temps),
      tempMax: Math.max(...temps),
      tempAvg: temps.reduce((a: number, b: number) => a + b, 0) / temps.length,
      humidityMin: humidities.length ? Math.min(...humidities) : 0,
      humidityMax: humidities.length ? Math.max(...humidities) : 0,
      humidityAvg: humidities.length ? humidities.reduce((a: number, b: number) => a + b, 0) / humidities.length : 0,
      pressureMin: pressures.length ? Math.min(...pressures) : 0,
      pressureMax: pressures.length ? Math.max(...pressures) : 0,
      pressureAvg: pressures.length ? pressures.reduce((a: number, b: number) => a + b, 0) / pressures.length : 0,
      windMin: winds.length ? Math.min(...winds) : 0,
      windMax: winds.length ? Math.max(...winds) : 0,
      windAvg: winds.length ? winds.reduce((a: number, b: number) => a + b, 0) / winds.length : 0,
    };
  }, [convertedTemperature, convertedHumidity, convertedPressure, convertedWind]);

  // Combine data for composed chart
  const combinedData = useMemo(() => {
    if (!convertedTemperature) return [];

    return convertedTemperature.map((item: any, idx: number) => ({
      timestamp: item.timestamp,
      temperature: item.temperature,
      humidity: convertedHumidity?.[idx]?.humidity,
      pressure: convertedPressure?.[idx]?.pressure,
      wind: convertedWind?.[idx]?.windSpeed,
    }));
  }, [convertedTemperature, convertedHumidity, convertedPressure, convertedWind]);

  // Calculate data ranges for fixed domains
  const dataRanges = useMemo(() => {
    const ranges: { [key: string]: [number, number] } = {};

    const calculateRange = (data: any[] | null | undefined, key: string) => {
      if (!data || data.length === 0) return null;
      const values = data.map((d: any) => d[key]).filter((v: any) => v !== null);
      if (values.length === 0) return null;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const padding = (max - min) * 0.05;
      return [Math.max(0, min - padding), max + padding] as [number, number];
    };

    ranges.temperature = calculateRange(convertedTemperature, "temperature") || [0, 100];
    ranges.humidity = calculateRange(convertedHumidity, "humidity") || [0, 100];
    ranges.pressure = calculateRange(convertedPressure, "pressure") || [900, 1050];
    ranges.wind = calculateRange(convertedWind, "windSpeed") || [0, 50];

    return ranges;
  }, [convertedTemperature, convertedHumidity, convertedPressure, convertedWind]);

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
        <section className="stats-grid">
          <div className="stat-card">
            <h3>Temperature</h3>
            <div className="stat-value">{formatMetricValue("temperature", stats.tempAvg)}</div>
            <div className="stat-range">
              Min: {formatMetricValue("temperature", stats.tempMin)} | Max: {formatMetricValue("temperature", stats.tempMax)}
            </div>
          </div>

          <div className="stat-card">
            <h3>Humidity</h3>
            <div className="stat-value">{formatMetricValue("humidity", stats.humidityAvg)}</div>
            <div className="stat-range">
              Min: {formatMetricValue("humidity", stats.humidityMin)} | Max: {formatMetricValue("humidity", stats.humidityMax)}
            </div>
          </div>

          <div className="stat-card">
            <h3>Pressure</h3>
            <div className="stat-value">{formatMetricValue("pressure", stats.pressureAvg)}</div>
            <div className="stat-range">
              Min: {formatMetricValue("pressure", stats.pressureMin)} | Max: {formatMetricValue("pressure", stats.pressureMax)}
            </div>
          </div>

          <div className="stat-card">
            <h3>Wind Speed</h3>
            <div className="stat-value">{formatMetricValue("wind", stats.windAvg)}</div>
            <div className="stat-range">
              Min: {formatMetricValue("wind", stats.windMin)} | Max: {formatMetricValue("wind", stats.windMax)}
            </div>
          </div>
        </section>

        <section className="chart-section">
          <h2>Combined Metrics</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                  dataKey="timestamp"
                  stroke="rgba(255, 255, 255, 0.5)"
                  tickFormatter={(ts) =>
                    formatLocalTime(ts * 1000)
                  }
                />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.temperature} tickFormatter={(value) => formatAxisValue("temperature", Number(value))} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.humidity} tickFormatter={(value) => formatAxisValue("humidity", Number(value))} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (typeof value !== "number") return [value, name];
                    if (name.includes("Temperature")) return [formatMetricValue("temperature", value), name];
                    if (name.includes("Humidity")) return [formatMetricValue("humidity", value), name];
                    return [value, name];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ff7300"
                  isAnimationActive={false}
                  name={`Temperature (°${temperatureUnit})`}
                />
                <Bar yAxisId="right" dataKey="humidity" fill="#64b5f6" name="Humidity (%)" opacity={0.6} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <h2>Temperature & Humidity</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                  dataKey="timestamp"
                  stroke="rgba(255, 255, 255, 0.5)"
                  tickFormatter={(ts) =>
                    formatLocalTime(ts * 1000)
                  }
                />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.temperature} tickFormatter={(value) => formatAxisValue("temperature", Number(value))} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.humidity} tickFormatter={(value) => formatAxisValue("humidity", Number(value))} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (typeof value !== "number") return [value, name];
                    if (name.includes("Temperature")) return [formatMetricValue("temperature", value), name];
                    if (name.includes("Humidity")) return [formatMetricValue("humidity", value), name];
                    return [value, name];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ff7300"
                  isAnimationActive={false}
                  name={`Temperature (°${temperatureUnit})`}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  stroke="#64b5f6"
                  isAnimationActive={false}
                  name="Humidity"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="chart-section">
          <h2>Pressure & Wind</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                  dataKey="timestamp"
                  stroke="rgba(255, 255, 255, 0.5)"
                  tickFormatter={(ts) =>
                    formatLocalTime(ts * 1000)
                  }
                />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.pressure} tickFormatter={(value) => formatAxisValue("pressure", Number(value))} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.wind} tickFormatter={(value) => formatAxisValue("wind", Number(value))} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (typeof value !== "number") return [value, name];
                    if (name.includes("Pressure")) return [formatMetricValue("pressure", value), name];
                    if (name.includes("Wind")) return [formatMetricValue("wind", value), name];
                    return [value, name];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pressure"
                  stroke="#81c784"
                  isAnimationActive={false}
                  name={`Pressure (${pressureUnit})`}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="wind"
                  stroke="#ffb74d"
                  isAnimationActive={false}
                  name={`Wind Speed (${windSpeedUnit})`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
