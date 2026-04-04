"""Weather forecast retrieval and processing"""
import logging
from datetime import datetime
from typing import Optional

from wfconsoleweb.core.types import WeatherForecast, ForecastPeriod
from wfconsoleweb.core.api_clients import WeatherFlowAPI


logger = logging.getLogger(__name__)


class ForecastService:
    """Retrieve and manage weather forecast data."""

    def __init__(self, weatherflow_token: str):
        """
        Initialize forecast service.

        Args:
            weatherflow_token: WeatherFlow API token
        """
        self.weatherflow_api = WeatherFlowAPI(weatherflow_token)

    async def get_forecast(self, station_id: str, latitude: float, longitude: float) -> Optional[WeatherForecast]:
        """
        Retrieve weather forecast for station.

        Args:
            station_id: WeatherFlow station ID
            latitude: Station latitude
            longitude: Station longitude

        Returns:
            WeatherForecast object or None if fetch fails
        """
        try:
            forecast_data = await self.weatherflow_api.get_forecast(station_id)
            if not forecast_data:
                return None

            # Parse forecast periods
            periods = []
            forecast_list = forecast_data.get("forecast", [])

            for period_data in forecast_list:
                try:
                    period = self._parse_forecast_period(period_data)
                    if period:
                        periods.append(period)
                except (KeyError, ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse forecast period: {e}")
                    continue

            return WeatherForecast(
                timestamp=datetime.utcnow(),
                source="weatherflow",
                periods=periods,
                latitude=latitude,
                longitude=longitude,
                station_id=station_id,
            )

        except Exception as e:
            logger.error(f"Failed to retrieve forecast: {e}")
            return None

    def _parse_forecast_period(self, period_data: dict) -> Optional[ForecastPeriod]:
        """
        Parse a single forecast period from API response.

        Args:
            period_data: Period data from API

        Returns:
            ForecastPeriod object or None
        """
        try:
            # Extract data with fallbacks
            timestamp = datetime.fromtimestamp(period_data.get("valid_time", 0))
            condition_code = period_data.get("icon", "unknown")

            # Map WeatherFlow condition codes to readable strings
            condition = self._map_condition_code(condition_code)

            return ForecastPeriod(
                valid_time=timestamp,
                condition=condition,
                condition_code=condition_code,
                temp_high_c=period_data.get("air_temp_high", None),
                temp_low_c=period_data.get("air_temp_low", None),
                wind_speed_mps=period_data.get("wind_speed", 0),
                wind_gust_mps=period_data.get("wind_gust", 0),
                wind_direction_deg=period_data.get("wind_direction", 0),
                probability_of_precipitation=period_data.get("precipitation_probability", 0),
                precipitation_mm=period_data.get("precipitation", 0),
                uv_index=period_data.get("uv", 0),
                cloud_cover_percent=period_data.get("cloud_cover", 0),
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Error parsing forecast period: {e}")
            return None

    @staticmethod
    def _map_condition_code(code: str) -> str:
        """
        Map WeatherFlow condition code to readable description.

        Args:
            code: Condition code from API

        Returns:
            Human-readable condition string
        """
        condition_map = {
            "clear-day": "Clear",
            "clear-night": "Clear Night",
            "cloudy": "Cloudy",
            "fog": "Fog",
            "hail": "Hail",
            "partly-cloudy-day": "Partly Cloudy",
            "partly-cloudy-night": "Partly Cloudy Night",
            "rain": "Rain",
            "rain-and-snow": "Rain and Snow",
            "rain-and-sleet": "Rain and Sleet",
            "snow": "Snow",
            "snow-and-sleet": "Snow and Sleet",
            "thunderstorm": "Thunderstorm",
            "wind": "Windy",
        }
        return condition_map.get(code, code)

    async def get_hourly_forecast(self, station_id: str) -> Optional[list[ForecastPeriod]]:
        """
        Get hourly forecast only (first 24 hours).

        Args:
            station_id: WeatherFlow station ID

        Returns:
            List of hourly ForecastPeriod objects
        """
        forecast = await self.get_forecast(station_id, 0, 0)
        if not forecast:
            return None

        # Return only periods within 24 hours
        now = datetime.utcnow()
        return [p for p in forecast.periods if (p.valid_time - now).total_seconds() < 86400]

    async def get_daily_forecast(self, station_id: str) -> Optional[list[ForecastPeriod]]:
        """
        Get daily forecast (noon periods only).

        Args:
            station_id: WeatherFlow station ID

        Returns:
            List of daily ForecastPeriod objects
        """
        forecast = await self.get_forecast(station_id, 0, 0)
        if not forecast:
            return None

        # Filter to noon periods (~12:00)
        return [p for p in forecast.periods if p.valid_time.hour == 12]


# Forecast cache manager
class ForecastCache:
    """
    Cache forecast data with expiration.

    Prevents excessive API calls while keeping data reasonably fresh.
    """

    def __init__(self, ttl_minutes: int = 30):
        """
        Initialize cache.

        Args:
            ttl_minutes: Cache time-to-live in minutes
        """
        self.ttl_minutes = ttl_minutes
        self.cache: dict[str, tuple[WeatherForecast, datetime]] = {}

    def get(self, station_id: str) -> Optional[WeatherForecast]:
        """
        Get cached forecast if still valid.

        Args:
            station_id: WeatherFlow station ID

        Returns:
            Cached WeatherForecast or None
        """
        if station_id not in self.cache:
            return None

        forecast, cached_at = self.cache[station_id]
        age_minutes = (datetime.utcnow() - cached_at).total_seconds() / 60

        if age_minutes > self.ttl_minutes:
            del self.cache[station_id]
            return None

        return forecast

    def set(self, station_id: str, forecast: WeatherForecast) -> None:
        """
        Store forecast in cache.

        Args:
            station_id: WeatherFlow station ID
            forecast: WeatherForecast object
        """
        self.cache[station_id] = (forecast, datetime.utcnow())

    def clear(self) -> None:
        """Clear all cached forecasts."""
        self.cache.clear()

    def clear_expired(self) -> int:
        """
        Remove expired entries.

        Returns:
            Number of entries removed
        """
        now = datetime.utcnow()
        expired = [
            station_id
            for station_id, (_, cached_at) in self.cache.items()
            if (now - cached_at).total_seconds() / 60 > self.ttl_minutes
        ]

        for station_id in expired:
            del self.cache[station_id]

        return len(expired)


# Global singleton
_forecast_cache: Optional[ForecastCache] = None


def get_forecast_cache() -> ForecastCache:
    """Get or create global forecast cache."""
    global _forecast_cache
    if _forecast_cache is None:
        _forecast_cache = ForecastCache()
    return _forecast_cache
