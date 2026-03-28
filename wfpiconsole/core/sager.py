"""Sager weather forecasting system based on barometric trends"""
import logging
from datetime import datetime, timedelta
from typing import Tuple, Optional
from collections import deque

from wfpiconsole.core.types import SagerForecast


logger = logging.getLogger(__name__)


class SagerWeatherForecast:
    """
    Implement Sager weather forecasting based on barometric pressure trends.

    Based on the Sager Forecast system used in weather forecasting:
    - Steady/rising pressure: fair weather
    - Falling pressure: deteriorating conditions
    - Rate of change indicates time scale of changes
    """

    def __init__(self, latitude: float, max_history: int = 720):
        """
        Initialize Sager forecast system.

        Args:
            latitude: Station latitude (affects pressure patterns)
            max_history: Maximum number of pressure readings to keep (default 12 hours at 1-min intervals)
        """
        self.latitude = latitude
        self.max_history = max_history
        self.pressure_history: deque = deque(maxlen=max_history)
        self.timestamp_history: deque = deque(maxlen=max_history)

    def add_observation(self, pressure_mb: float, timestamp: datetime) -> Optional[SagerForecast]:
        """
        Add a pressure observation and generate forecast.

        Args:
            pressure_mb: Barometric pressure in millibars
            timestamp: Observation timestamp

        Returns:
            SagerForecast object if enough data accumulated, None otherwise
        """
        self.pressure_history.append(pressure_mb)
        self.timestamp_history.append(timestamp)

        # Need minimum 3 hours of data for meaningful forecast
        if len(self.pressure_history) < 180:
            return None

        return self.generate_forecast()

    def generate_forecast(self) -> Optional[SagerForecast]:
        """
        Generate Sager forecast from pressure history.

        Returns:
            SagerForecast object
        """
        if len(self.pressure_history) < 3:
            return None

        current_pressure = self.pressure_history[-1]
        pressure_3h_ago = self._get_pressure_ago(180)  # 3 hours at 1-minute intervals

        if pressure_3h_ago is None:
            return None

        pressure_trend = current_pressure - pressure_3h_ago
        pressure_change_rate = pressure_trend / 3.0  # Change per hour

        # Determine trend direction
        if abs(pressure_trend) < 0.3:
            trend = "steady"
        elif pressure_trend > 0:
            trend = "rising"
        else:
            trend = "falling"

        # Generate forecast text and confidence
        text, confidence = self._generate_forecast_text(pressure_change_rate, trend)

        return SagerForecast(
            timestamp=self.timestamp_history[-1],
            forecast_text=text,
            pressure_trend=trend,
            pressure_change_rate_mb_per_hour=pressure_change_rate,
            confidence=confidence,
        )

    def _get_pressure_ago(self, minutes: int) -> Optional[float]:
        """Get pressure from N minutes ago."""
        if len(self.pressure_history) <= minutes:
            return None
        return self.pressure_history[-(minutes + 1)]

    def _generate_forecast_text(self, change_rate: float, trend: str) -> Tuple[str, float]:
        """
        Generate forecast text and confidence.

        Args:
            change_rate: Pressure change in mb per hour
            trend: Pressure trend (rising/steady/falling)

        Returns:
            Tuple of (forecast text, confidence 0-1)
        """
        abs_rate = abs(change_rate)

        if trend == "steady":
            if abs_rate < 0.05:
                return "Conditions improving or steady", 0.9
            else:
                return "Conditions expected to stabilize", 0.7

        elif trend == "rising":
            if change_rate > 1.0:
                return "Conditions improving rapidly, fair weather expected", 0.95
            elif change_rate > 0.5:
                return "Conditions improving, fair weather likely within 24 hours", 0.90
            elif change_rate > 0.15:
                return "Conditions improving gradually, fair weather expected", 0.85
            else:
                return "Conditions improving slowly", 0.75

        elif trend == "falling":
            if change_rate < -1.5:
                return "Rapid deterioration, severe weather possible within 6 hours", 0.95
            elif change_rate < -1.0:
                return "Rapid pressure drop, deterioration within 12 hours", 0.90
            elif change_rate < -0.5:
                return "Conditions deteriorating, rain likely within 24 hours", 0.85
            elif change_rate < -0.15:
                return "Conditions worsening gradually, rain possible", 0.75
            else:
                return "Conditions may worsen slightly", 0.65

        return "Forecast unavailable", 0.0

    def get_weather_alert(self, pressure_mb: float) -> Optional[str]:
        """
        Generate weather alert based on extreme pressure values.

        Args:
            pressure_mb: Current barometric pressure

        Returns:
            Alert message or None
        """
        if pressure_mb < 950:
            return "Extreme low pressure - severe weather possible"
        elif pressure_mb < 970:
            return "Very low pressure - stormy conditions likely"
        elif pressure_mb > 1050:
            return "Extreme high pressure - very fair weather expected"

        return None

    def get_historical_forecast_trend(self, hours: int = 24) -> Optional[Tuple[str, float]]:
        """
        Get overall pressure trend over specified hours.

        Args:
            hours: Number of hours to analyze

        Returns:
            Tuple of (trend description, average change rate)
        """
        if len(self.pressure_history) < 10:
            return None

        target_minutes = hours * 60
        past_pressure = self._get_pressure_ago(target_minutes)

        if past_pressure is None:
            return None

        current_pressure = self.pressure_history[-1]
        change = current_pressure - past_pressure
        avg_rate = change / hours

        if abs(change) < 0.5:
            trend = "stable"
        elif change > 0:
            trend = "rising"
        else:
            trend = "falling"

        return trend, avg_rate


class SagerForecastManager:
    """Manager for multiple Sager forecast instances by station."""

    def __init__(self):
        """Initialize forecast manager."""
        self.forecasts: dict[str, SagerWeatherForecast] = {}

    def get_forecast(self, station_id: str, latitude: float) -> SagerWeatherForecast:
        """
        Get or create forecast for station.

        Args:
            station_id: Unique station identifier
            latitude: Station latitude

        Returns:
            SagerWeatherForecast instance
        """
        if station_id not in self.forecasts:
            self.forecasts[station_id] = SagerWeatherForecast(latitude)
        return self.forecasts[station_id]

    def add_observation(self, station_id: str, pressure_mb: float, timestamp: datetime, latitude: float) -> Optional[SagerForecast]:
        """
        Add observation to station forecast.

        Args:
            station_id: Station identifier
            pressure_mb: Barometric pressure in mb
            timestamp: Observation timestamp
            latitude: Station latitude

        Returns:
            SagerForecast or None
        """
        forecast = self.get_forecast(station_id, latitude)
        return forecast.add_observation(pressure_mb, timestamp)


# Global singleton
_sager_manager: Optional[SagerForecastManager] = None


def get_sager_manager() -> SagerForecastManager:
    """Get or create global Sager forecast manager."""
    global _sager_manager
    if _sager_manager is None:
        _sager_manager = SagerForecastManager()
    return _sager_manager
