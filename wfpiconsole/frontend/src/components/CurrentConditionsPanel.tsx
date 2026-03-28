/**
 * Current conditions display panel
 */

import React, { useEffect, useMemo, useState } from "react";
import { Observation, CurrentConditions, StationInfo } from "../types";
import { useSettings } from "../context/SettingsContext";
import { useTemperatureConverter, useWindSpeedConverter } from "../hooks/useWeather";
import "./CurrentConditionsPanel.css";

interface Props {
  observation: Observation | null;
  conditions: CurrentConditions | null;
  rapidWind: {
    timestamp: string;
    wind_speed_mps: number | null;
    wind_gust_mps: number | null;
    wind_direction_deg: number | null;
  } | null;
  station: StationInfo | null;
}

export default function CurrentConditionsPanel({
  observation,
  conditions,
  rapidWind,
  station,
}: Props) {
  const { settings } = useSettings();
  const convertTemp = useTemperatureConverter(settings?.temperatureUnit || "C");
  const convertWind = useWindSpeedConverter(settings?.windSpeedUnit || "m/s");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const windUpdatedSeconds = useMemo(() => {
    if (!rapidWind?.timestamp) {
      return null;
    }

    const ts = Date.parse(rapidWind.timestamp);
    if (Number.isNaN(ts)) {
      return null;
    }
    return Math.max(0, Math.floor((nowMs - ts) / 1000));
  }, [rapidWind, nowMs]);

  if (!observation || !conditions) {
    return (
      <div className="current-conditions">
        <div className="loading">Waiting for live Tempest observations...</div>
      </div>
    );
  }

  const temp = convertTemp(observation.temp_c);
  const feelsLike = convertTemp(conditions.feels_like_c);
  const windSpeed = convertWind(rapidWind?.wind_speed_mps ?? null);
  const windGust = convertWind(rapidWind?.wind_gust_mps ?? null);
  const windDirection = rapidWind?.wind_direction_deg ?? null;
  const weatherDescription = conditions.uv_risk_level
    ? `UV ${conditions.uv_risk_level}`
    : "Live conditions";

  return (
    <div className="current-conditions">
      <div className="conditions-main">
        <div className="temperature-section">
          <div className="temperature-display">
            <span className="temp-value">
              {temp !== null ? Math.round(temp) : "--"}°
            </span>
            <span className="temp-unit">{settings?.temperatureUnit || "C"}</span>
          </div>
          <div className="temperature-details">
            <p className="weather-description">{weatherDescription}</p>
            <p className="feels-like">
              Feels like {feelsLike !== null ? Math.round(feelsLike) : "--"}°
            </p>
          </div>
        </div>

        <div className="weather-icon">
          <WeatherIcon condition={weatherDescription} />
        </div>
      </div>

      <div className="live-wind-card">
        <div className="live-wind-header">
          <span className="live-dot" aria-hidden="true"></span>
          <span className="live-label">Live Wind</span>
          <span className="live-updated">
            {windUpdatedSeconds !== null ? `Updated ${windUpdatedSeconds}s ago` : "Waiting for wind packets"}
          </span>
        </div>
        <div className="live-wind-values">
          <div className="live-wind-metric">
            <span className="live-wind-metric-label">Speed</span>
            <span className="live-wind-metric-value">
              {windSpeed !== null ? Math.round(windSpeed * 10) / 10 : "--"} {settings?.windSpeedUnit || "m/s"}
            </span>
          </div>
          <div className="live-wind-metric">
            <span className="live-wind-metric-label">Gust</span>
            <span className="live-wind-metric-value">
              {windGust !== null ? Math.round(windGust * 10) / 10 : "--"} {settings?.windSpeedUnit || "m/s"}
            </span>
          </div>
          <div className="live-wind-metric">
            <span className="live-wind-metric-label">Direction</span>
            <span className="live-wind-metric-value">
              {getWindDirection(windDirection)}
            </span>
          </div>
        </div>
      </div>

      <div className="conditions-grid">
        <div className="condition-item">
          <span className="condition-label">Humidity</span>
          <span className="condition-value">
            {observation.humidity !== null ? Math.round(observation.humidity) : "--"}%
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Pressure</span>
          <span className="condition-value">
            {observation.pressure_mb !== null
              ? Math.round(observation.pressure_mb * 10) / 10
              : "--"}{" "}
            {settings?.pressureUnit || "mb"}
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Wind Speed</span>
          <span className="condition-value">
            {windSpeed !== null ? Math.round(windSpeed * 10) / 10 : "--"}{" "}
            {settings?.windSpeedUnit || "m/s"}
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Wind Gust</span>
          <span className="condition-value">
            {windGust !== null ? Math.round(windGust * 10) / 10 : "--"}{" "}
            {settings?.windSpeedUnit || "m/s"}
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Wind Direction</span>
          <span className="condition-value">
            {getWindDirection(windDirection)}
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Rainfall</span>
          <span className="condition-value">
            {observation.rainfall_mm !== null ? Math.round(observation.rainfall_mm * 10) / 10 : "--"} mm
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">UV Index</span>
          <span className={`condition-value uvi-${getUvCategory(conditions.uv_index ?? 0)}`}>
            {conditions.uv_index ?? "--"}
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Solar Radiation</span>
          <span className="condition-value">
            {observation.solar_radiation_wm2 !== null
              ? Math.round(observation.solar_radiation_wm2)
              : "--"}{" "}
            W/m²
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Lightning</span>
          <span className="condition-value">
            {conditions.lightning_distance_km !== null ? Math.round(conditions.lightning_distance_km) : "--"} km
          </span>
        </div>
      </div>

      {station && (
        <div className="station-info">
          <p>
            <strong>Station:</strong> {station.name}
          </p>
          <p>
            <strong>Location:</strong> {station.latitude?.toFixed(4)}, {station.longitude?.toFixed(4)}
          </p>
          <p>
            <strong>Elevation:</strong> {station.elevation} m
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Convert wind direction from degrees to compass direction
 */
function getWindDirection(degrees: number | null): string {
  if (degrees === null) return "--";
  
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Get UV index category
 */
function getUvCategory(uvIndex: number): string {
  if (uvIndex < 3) return "low";
  if (uvIndex < 6) return "moderate";
  if (uvIndex < 8) return "high";
  if (uvIndex < 11) return "very-high";
  return "extreme";
}

/**
 * Simple weather icon component
 */
function WeatherIcon({ condition }: { condition: string }): JSX.Element {
  const lowerCondition = condition.toLowerCase();

  if (lowerCondition.includes("clear") || lowerCondition.includes("sunny")) {
    return <div className="icon icon-sun">☀️</div>;
  }
  if (lowerCondition.includes("cloud")) {
    return <div className="icon icon-cloud">☁️</div>;
  }
  if (lowerCondition.includes("rain")) {
    return <div className="icon icon-rain">🌧️</div>;
  }
  if (lowerCondition.includes("snow")) {
    return <div className="icon icon-snow">❄️</div>;
  }
  if (lowerCondition.includes("storm") || lowerCondition.includes("thunder")) {
    return <div className="icon icon-storm">⛈️</div>;
  }
  if (lowerCondition.includes("fog") || lowerCondition.includes("mist")) {
    return <div className="icon icon-fog">🌫️</div>;
  }

  return <div className="icon icon-default">🌤️</div>;
}
