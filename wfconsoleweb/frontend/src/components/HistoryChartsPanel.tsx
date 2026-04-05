/**
 * Historical data charts panel
 */

import { useCallback, useMemo } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useHistoricalData } from "../hooks/useWeather";
import { useSettings } from "../context/SettingsContext";
import { formatLocalDateTime, formatLocalTime } from "../utils/dateTime";
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

  const temperatureUnit = settings?.temperatureUnit || "C";
  const pressureUnit = settings?.pressureUnit || "mb";
  const windSpeedUnit = settings?.windSpeedUnit || "m/s";

  const convertMetricValue = useCallback((value: number): number => {
    if (metric === "temperature") {
      return temperatureUnit === "F" ? (value * 9) / 5 + 32 : value;
    }

    if (metric === "pressure") {
      if (pressureUnit === "inHg") return value * 0.0295299830714;
      return value; // mb and hPa share the same numeric scale
    }

    if (metric === "wind") {
      const factorByUnit: Record<string, number> = {
        "m/s": 1,
        mph: 2.23694,
        kph: 3.6,
        knots: 1.94384,
      };
      return value * (factorByUnit[windSpeedUnit] ?? 1);
    }

    return value;
  }, [metric, temperatureUnit, pressureUnit, windSpeedUnit]);

  const formatAxisValue = (value: number): string => {
    if (metric === "humidity") return `${Math.round(value)}`;
    if (metric === "pressure" || metric === "wind") return value.toFixed(1);
    if (metric === "temperature") return value.toFixed(1);
    return `${Math.round(value * 100) / 100}`;
  };

  const convertedData = useMemo(() => {
    if (!data) return null;

    return data.map((point) => {
      const rawValue = point[
        metric === "temperature"
          ? "temperature"
          : metric === "humidity"
            ? "humidity"
            : metric === "pressure"
              ? "pressure"
              : metric === "wind"
                ? "windSpeed"
                : metric === "rainfall"
                  ? "rainfall"
                  : "solarRadiation"
      ];

      if (typeof rawValue !== "number") {
        return point;
      }

      return {
        ...point,
        [
          metric === "temperature"
            ? "temperature"
            : metric === "humidity"
              ? "humidity"
              : metric === "pressure"
                ? "pressure"
                : metric === "wind"
                  ? "windSpeed"
                  : metric === "rainfall"
                    ? "rainfall"
                    : "solarRadiation"
        ]: convertMetricValue(rawValue),
      };
    });
  }, [data, metric, convertMetricValue]);

  // Calculate data range for fixed domain
  const dataRange = useMemo(() => {
    if (!convertedData || convertedData.length === 0) return null;

    let values: number[] = [];
    if (metric === "temperature" && convertedData[0]?.temperature !== undefined) {
      values = convertedData.map((d: any) => d.temperature).filter((v: any) => v !== null);
    } else if (metric === "humidity" && convertedData[0]?.humidity !== undefined) {
      values = convertedData.map((d: any) => d.humidity).filter((v: any) => v !== null);
    } else if (metric === "pressure" && convertedData[0]?.pressure !== undefined) {
      values = convertedData.map((d: any) => d.pressure).filter((v: any) => v !== null);
    } else if (metric === "wind" && convertedData[0]?.windSpeed !== undefined) {
      values = convertedData.map((d: any) => d.windSpeed).filter((v: any) => v !== null);
    } else if (metric === "rainfall" && convertedData[0]?.rainfall !== undefined) {
      values = convertedData.map((d: any) => d.rainfall).filter((v: any) => v !== null);
    } else if (metric === "solar" && convertedData[0]?.solarRadiation !== undefined) {
      values = convertedData.map((d: any) => d.solarRadiation).filter((v: any) => v !== null);
    }

    if (values.length === 0) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.05; // 5% padding

    return [Math.max(0, min - padding), max + padding];
  }, [convertedData, metric]);

  const chartConfig = useMemo(() => {
    switch (metric) {
      case "temperature":
        return {
          dataKey: "temperature",
          name: `Temperature (°${temperatureUnit})`,
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
          name: `Pressure (${pressureUnit})`,
          stroke: "#81c784",
          fill: "rgba(129, 199, 132, 0.2)",
        };
      case "wind":
        return {
          dataKey: "windSpeed",
          name: `Wind Speed (${windSpeedUnit})`,
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
  }, [metric, temperatureUnit, pressureUnit, windSpeedUnit]);

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
          <AreaChart data={convertedData || data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                formatLocalTime(timestamp * 1000)
              }
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.5)"
              style={{ fontSize: "0.75rem" }}
              domain={dataRange || undefined}
              tickFormatter={(value) => formatAxisValue(Number(value))}
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
                  return [formatAxisValue(value), chartConfig.name];
                }
                return [value, chartConfig.name];
              }}
              labelFormatter={(label) =>
                formatLocalDateTime(label * 1000)
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
            {metric === "temperature" && (
              <Line
                type="monotone"
                dataKey="dewPoint"
                stroke="#00a4b4"
                name="Dew Point (°C)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
