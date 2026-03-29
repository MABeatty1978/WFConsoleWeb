/**
 * Historical data charts panel
 */

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useHistoricalData } from "../hooks/useWeather";
import { useSettings } from "../context/SettingsContext";
import "./HistoryChartsPanel.css";

interface Props {
  metric: "temperature" | "humidity" | "pressure" | "wind" | "rainfall" | "solar";
  title: string;
  hours?: number;
}

export default function HistoryChartsPanel({
  metric,
  title,
  hours = 24,
}: Props) {
  const { data, loading, error } = useHistoricalData(metric, hours);
  const { settings } = useSettings();

  // Calculate data range for fixed domain
  const dataRange = useMemo(() => {
    if (!data || data.length === 0) return null;

    let values: number[] = [];
    if (metric === "temperature" && data[0]?.temperature !== undefined) {
      values = data.map((d: any) => d.temperature).filter((v: any) => v !== null);
    } else if (metric === "humidity" && data[0]?.humidity !== undefined) {
      values = data.map((d: any) => d.humidity).filter((v: any) => v !== null);
    } else if (metric === "pressure" && data[0]?.pressure !== undefined) {
      values = data.map((d: any) => d.pressure).filter((v: any) => v !== null);
    } else if (metric === "wind" && data[0]?.windSpeed !== undefined) {
      values = data.map((d: any) => d.windSpeed).filter((v: any) => v !== null);
    } else if (metric === "rainfall" && data[0]?.rainfall !== undefined) {
      values = data.map((d: any) => d.rainfall).filter((v: any) => v !== null);
    } else if (metric === "solar" && data[0]?.solarRadiation !== undefined) {
      values = data.map((d: any) => d.solarRadiation).filter((v: any) => v !== null);
    }

    if (values.length === 0) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.05; // 5% padding

    return [Math.max(0, min - padding), max + padding];
  }, [data, metric]);

  const chartConfig = useMemo(() => {
    switch (metric) {
      case "temperature":
        return {
          dataKey: "temperature",
          name: `Temperature (°${settings?.temperatureUnit || "C"})`,
          stroke: "var(--color-chart-line)",
          fill: "var(--color-chart-area)",
        };
      case "humidity":
        return {
          dataKey: "humidity",
          name: "Humidity (%)",
          stroke: "#64b5f6",
          fill: "rgba(100, 181, 246, 0.2)",
        };
      case "pressure":
        return {
          dataKey: "pressure",
          name: `Pressure (${settings?.pressureUnit || "mb"})`,
          stroke: "#81c784",
          fill: "rgba(129, 199, 132, 0.2)",
        };
      case "wind":
        return {
          dataKey: "windSpeed",
          name: `Wind Speed (${settings?.windSpeedUnit || "m/s"})`,
          stroke: "#ffb74d",
          fill: "rgba(255, 183, 77, 0.2)",
        };
      case "rainfall":
        return {
          dataKey: "rainfall",
          name: "Rainfall (mm)",
          stroke: "#64b5f6",
          fill: "rgba(100, 181, 246, 0.3)",
        };
      case "solar":
        return {
          dataKey: "solarRadiation",
          name: "Solar Radiation (W/m²)",
          stroke: "#fdd835",
          fill: "rgba(253, 216, 53, 0.2)",
        };
      default:
        return {
          dataKey: metric,
          name: metric,
          stroke: "var(--color-accent)",
          fill: "var(--color-chart-area)",
        };
    }
  }, [metric, settings]);

  if (loading) {
    return (
      <div className="history-chart-panel">
        <h3>{title}</h3>
        <div className="chart-loading">Loading chart...</div>
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="history-chart-panel">
        <h3>{title}</h3>
        <div className="chart-error">
          {error || "No data available"}
        </div>
      </div>
    );
  }

  return (
    <div className="history-chart-panel">
      <h3>{title}</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartConfig.stroke} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartConfig.stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.1)"
            />
            <XAxis
              dataKey="timestamp"
              stroke="rgba(255, 255, 255, 0.5)"
              style={{ fontSize: "0.75rem" }}
              tickFormatter={(timestamp) =>
                new Date(timestamp * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.5)"
              style={{ fontSize: "0.75rem" }}
              domain={dataRange || undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-primary)",
                border: `1px solid var(--color-secondary)`,
                borderRadius: "var(--corner-radius)",
                color: "var(--color-text)",
              }}
              formatter={(value: number) => {
                if (typeof value === "number") {
                  return [Math.round(value * 100) / 100, chartConfig.name];
                }
                return [value, chartConfig.name];
              }}
              labelFormatter={(label) =>
                new Date(label * 1000).toLocaleString()
              }
            />
            <Legend
              wrapperStyle={{ fontSize: "0.85rem" }}
              iconType="line"
            />
            <Area
              type="monotone"
              dataKey={chartConfig.dataKey}
              stroke={chartConfig.stroke}
              fill={`url(#gradient-${metric})`}
              name={chartConfig.name}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
