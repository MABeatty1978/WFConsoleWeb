/**
 * Current conditions display panel
 */

import React from "react";
import { Observation, CurrentConditions, StationInfo } from "../types";
import { useSettings } from "../context/SettingsContext";
import { useTemperatureConverter, useWindSpeedConverter } from "../hooks/useWeather";
import "./CurrentConditionsPanel.css";

interface Props {
  observation: Observation | null;
  conditions: CurrentConditions | null;
  station: StationInfo | null;
}

export default function CurrentConditionsPanel({
  observation,
  conditions,
  station,
}: Props) {
  const { settings } = useSettings();
  const convertTemp = useTemperatureConverter(settings?.temperatureUnit || "C");
  const convertWind = useWindSpeedConverter(settings?.windSpeedUnit || "m/s");

  if (!observation || !conditions) {
    return (
      <div className="current-conditions">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const temp = convertTemp(observation.temperature);
  const feelsLike = convertTemp(conditions.feelsLike);
  const windSpeed = convertWind(observation.windSpeed);

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
            <p className="weather-description">{conditions.description}</p>
            <p className="feels-like">
              Feels like {feelsLike !== null ? Math.round(feelsLike) : "--"}°
            </p>
          </div>
        </div>

        <div className="weather-icon">
          <WeatherIcon condition={conditions.description} />
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
            {observation.pressure !== null
              ? Math.round(observation.pressure * 10) / 10
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
          <span className="condition-label">Wind Direction</span>
          <span className="condition-value">
            {getWindDirection(observation.windDirection)}
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Rainfall</span>
          <span className="condition-value">
            {observation.rainfall !== null ? Math.round(observation.rainfall * 10) / 10 : "--"} mm
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">UV Index</span>
          <span className={`condition-value uvi-${getUvCategory(conditions.uvIndex)}`}>
            {conditions.uvIndex}
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Solar Radiation</span>
          <span className="condition-value">
            {observation.solarRadiation !== null
              ? Math.round(observation.solarRadiation)
              : "--"}{" "}
            W/m²
          </span>
        </div>

        <div className="condition-item">
          <span className="condition-label">Visibility</span>
          <span className="condition-value">
            {conditions.visibility !== null ? Math.round(conditions.visibility) : "--"} km
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
