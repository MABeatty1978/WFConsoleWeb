/**
 * Advanced analytics page
 */

import { useState, useMemo } from "react";
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
import "./AnalyticsPage.css";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<number>(24); // hours
  const { settings } = useSettings();

  // Fetch data for all metrics
  const { data: temperature } = useHistoricalData("temperature", timeRange);
  const { data: humidity } = useHistoricalData("humidity", timeRange);
  const { data: pressure } = useHistoricalData("pressure", timeRange);
  const { data: wind } = useHistoricalData("wind", timeRange);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!temperature || temperature.length === 0) {
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

    const temps = temperature.map((d: any) => d.temperature).filter((t: any) => t !== null);
    const humidities = humidity?.map((d: any) => d.humidity).filter((h: any) => h !== null) || [];
    const pressures = pressure?.map((d: any) => d.pressure).filter((p: any) => p !== null) || [];
    const winds = wind?.map((d: any) => d.windSpeed).filter((w: any) => w !== null) || [];

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
  }, [temperature, humidity, pressure, wind]);

  // Combine data for composed chart
  const combinedData = useMemo(() => {
    if (!temperature) return [];

    return temperature.map((item: any, idx: number) => ({
      timestamp: item.timestamp,
      temperature: item.temperature,
      humidity: humidity?.[idx]?.humidity,
      pressure: pressure?.[idx]?.pressure,
      wind: wind?.[idx]?.windSpeed,
    }));
  }, [temperature, humidity, pressure, wind]);

  // Calculate data ranges for fixed domains
  const dataRanges = useMemo(() => {
    const ranges: { [key: string]: [number, number] } = {};

    const calculateRange = (data: any[], key: string) => {
      if (!data || data.length === 0) return null;
      const values = data.map((d: any) => d[key]).filter((v: any) => v !== null);
      if (values.length === 0) return null;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const padding = (max - min) * 0.05;
      return [Math.max(0, min - padding), max + padding] as [number, number];
    };

    ranges.temperature = calculateRange(temperature, "temperature") || [0, 100];
    ranges.humidity = calculateRange(humidity, "humidity") || [0, 100];
    ranges.pressure = calculateRange(pressure, "pressure") || [900, 1050];
    ranges.wind = calculateRange(wind, "windSpeed") || [0, 50];

    return ranges;
  }, [temperature, humidity, pressure, wind]);

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
            <div className="stat-value">{Math.round(stats.tempAvg * 10) / 10}°</div>
            <div className="stat-range">
              Min: {Math.round(stats.tempMin * 10) / 10}° | Max: {Math.round(stats.tempMax * 10) / 10}°
            </div>
          </div>

          <div className="stat-card">
            <h3>Humidity</h3>
            <div className="stat-value">{Math.round(stats.humidityAvg)}%</div>
            <div className="stat-range">
              Min: {Math.round(stats.humidityMin)}% | Max: {Math.round(stats.humidityMax)}%
            </div>
          </div>

          <div className="stat-card">
            <h3>Pressure</h3>
            <div className="stat-value">{Math.round(stats.pressureAvg * 10) / 10}</div>
            <div className="stat-range">
              Min: {Math.round(stats.pressureMin * 10) / 10} | Max: {Math.round(stats.pressureMax * 10) / 10}
            </div>
          </div>

          <div className="stat-card">
            <h3>Wind Speed</h3>
            <div className="stat-value">{Math.round(stats.windAvg * 10) / 10}</div>
            <div className="stat-range">
              Min: {Math.round(stats.windMin * 10) / 10} | Max: {Math.round(stats.windMax * 10) / 10}
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
                    new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.temperature} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.humidity} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ff7300"
                  isAnimationActive={false}
                  name={`Temperature (°${settings?.temperatureUnit || "C"})`}
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
                    new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.temperature} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.humidity} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ff7300"
                  isAnimationActive={false}
                  name="Temperature"
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
                    new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                />
                <YAxis yAxisId="left" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.pressure} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255, 255, 255, 0.5)" domain={dataRanges.wind} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-primary)",
                    border: "1px solid var(--color-secondary)",
                    borderRadius: "var(--corner-radius)",
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pressure"
                  stroke="#81c784"
                  isAnimationActive={false}
                  name="Pressure"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="wind"
                  stroke="#ffb74d"
                  isAnimationActive={false}
                  name="Wind Speed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
