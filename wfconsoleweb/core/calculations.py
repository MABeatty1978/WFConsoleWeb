"""Weather calculation utilities for derived values"""
import math
from typing import Optional


class WeatherCalculations:
    """Calculations for derived weather values"""

    @staticmethod
    def calculate_dew_point(temperature: float, humidity: float) -> float:
        """
        Calculate dew point using Magnus formula.

        Args:
            temperature: Temperature in Celsius
            humidity: Relative humidity (0-100)

        Returns:
            Dew point in Celsius
        """
        a = 17.27
        b = 237.7
        alpha = ((a * temperature) / (b + temperature)) + math.log(humidity / 100.0)
        dew_point = (b * alpha) / (a - alpha)
        return round(dew_point, 2)

    @staticmethod
    def calculate_feels_like_temperature(
        temperature: float,
        humidity: float,
        wind_speed: float,
    ) -> float:
        """
        Calculate 'feels like' temperature.
        Uses Wind Chill at low temps and Heat Index at high temps.

        Args:
            temperature: Temperature in Celsius
            humidity: Relative humidity (0-100)
            wind_speed: Wind speed in m/s

        Returns:
            Feels-like temperature in Celsius
        """
        temp_f = temperature * 9 / 5 + 32
        wind_kmh = wind_speed * 3.6
        wind_mph = wind_kmh * 0.621371

        if temperature < 10:
            # Wind chill
            feels_like = 13.12 + 0.6215 * temp_f - 11.37 * (wind_mph ** 0.16) + 0.3965 * (wind_mph ** 0.16) * temp_f
        elif temperature > 26:
            # Heat index
            rh = humidity
            c1 = -42.379
            c2 = 2.04901523
            c3 = 10.14333127
            c4 = -0.22475541
            c5 = -0.00683783
            c6 = -0.05481717
            c7 = 0.00122874
            c8 = 0.00085282
            c9 = -0.00000199

            t = temp_f
            rh_squared = rh * rh

            feels_like = (
                c1
                + c2 * t
                + c3 * rh
                + c4 * t * rh
                + c5 * t * t
                + c6 * rh_squared
                + c7 * t * t * rh
                + c8 * t * rh_squared
                + c9 * t * t * rh_squared
            )
        else:
            feels_like = temp_f

        # Convert back to Celsius
        return round((feels_like - 32) * 5 / 9, 2)

    @staticmethod
    def calculate_wind_chill(temperature: float, wind_speed: float) -> float:
        """
        Calculate wind chill factor.

        Args:
            temperature: Temperature in Celsius
            wind_speed: Wind speed in m/s

        Returns:
            Wind chill in Celsius (or same as temperature if above 10°C)
        """
        if temperature >= 10:
            return temperature

        temp_f = temperature * 9 / 5 + 32
        wind_mph = wind_speed * 2.237

        wind_chill_f = 35.74 + 0.6215 * temp_f - 35.75 * (wind_mph ** 0.16) + 0.4275 * temp_f * (wind_mph ** 0.16)

        return round((wind_chill_f - 32) * 5 / 9, 2)

    @staticmethod
    def calculate_heat_index(temperature: float, humidity: float) -> float:
        """
        Calculate heat index (how hot it feels).

        Args:
            temperature: Temperature in Celsius
            humidity: Relative humidity (0-100)

        Returns:
            Heat index in Celsius (or same as temperature if below 26°C)
        """
        if temperature < 26:
            return temperature

        temp_f = temperature * 9 / 5 + 32
        rh = humidity

        c1 = -42.379
        c2 = 2.04901523
        c3 = 10.14333127
        c4 = -0.22475541
        c5 = -0.00683783
        c6 = -0.05481717
        c7 = 0.00122874
        c8 = 0.00085282
        c9 = -0.00000199

        rh_squared = rh * rh
        t = temp_f

        heat_index_f = (
            c1
            + c2 * t
            + c3 * rh
            + c4 * t * rh
            + c5 * t * t
            + c6 * rh_squared
            + c7 * t * t * rh
            + c8 * t * rh_squared
            + c9 * t * t * rh_squared
        )

        return round((heat_index_f - 32) * 5 / 9, 2)

    @staticmethod
    def calculate_absolute_humidity(temperature: float, humidity: float) -> float:
        """
        Calculate absolute humidity (grams/m³).

        Args:
            temperature: Temperature in Celsius
            humidity: Relative humidity (0-100)

        Returns:
            Absolute humidity in g/m³
        """
        # Magnus formula coefficients
        a = 17.27
        b = 237.7

        alpha = ((a * temperature) / (b + temperature)) + math.log(humidity / 100.0)
        saturation_vapor_pressure = 6.112 * math.exp((a * temperature) / (b + temperature))
        vapor_pressure = (humidity / 100.0) * saturation_vapor_pressure

        # Using approximation: AH = 216.7 * (VP / (T + 273.15))
        abs_humidity = 216.7 * vapor_pressure / (temperature + 273.15)
        return round(abs_humidity, 2)

    @staticmethod
    def convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
        """
        Convert temperature between units.

        Args:
            value: Temperature value
            from_unit: Source unit ('C' or 'F')
            to_unit: Target unit ('C' or 'F')

        Returns:
            Converted temperature
        """
        if from_unit == to_unit:
            return value

        if from_unit == "C" and to_unit == "F":
            return round(value * 9 / 5 + 32, 2)
        elif from_unit == "F" and to_unit == "C":
            return round((value - 32) * 5 / 9, 2)

        return value

    @staticmethod
    def calculate_uv_risk_level(uv_index: Optional[float]) -> str:
        """
        Determine UV risk level from UV index.

        Args:
            uv_index: UV index value (0-16+)

        Returns:
            Risk level string (Low, Moderate, High, Very High, Extreme)
        """
        if uv_index is None:
            return "Unknown"

        if uv_index < 3:
            return "Low"
        elif uv_index < 6:
            return "Moderate"
        elif uv_index < 8:
            return "High"
        elif uv_index < 11:
            return "Very High"
        else:
            return "Extreme"

    @staticmethod
    def get_beaufort_scale(wind_speed_ms: float) -> tuple[int, str]:
        """
        Convert wind speed to Beaufort scale.

        Args:
            wind_speed_ms: Wind speed in m/s

        Returns:
            Tuple of (Beaufort number, Description)
        """
        # Beaufort scale thresholds (m/s)
        beaufort_scale = [
            (0, "Calm"),
            (0.3, "Light Air"),
            (1.5, "Light Breeze"),
            (3.3, "Gentle Breeze"),
            (5.5, "Moderate Breeze"),
            (8.0, "Fresh Breeze"),
            (10.8, "Strong Breeze"),
            (13.9, "Moderate Gale"),
            (17.2, "Fresh Gale"),
            (20.8, "Strong Gale"),
            (24.4, "Whole Gale"),
            (28.1, "Storm"),
            (32.6, "Hurricane"),
        ]

        for i, (threshold, description) in enumerate(beaufort_scale):
            if wind_speed_ms < threshold:
                return i, description

        return len(beaufort_scale) - 1, beaufort_scale[-1][1]


# Module-level function wrappers for backward compatibility
def calculate_dew_point(temperature: float, humidity: float) -> float:
    """Calculate dew point. See WeatherCalculations.calculate_dew_point for details."""
    return WeatherCalculations.calculate_dew_point(temperature, humidity)


def calculate_feels_like_temperature(
    temperature: float,
    humidity: float,
    wind_speed: float,
) -> float:
    """Calculate feels-like temperature. See WeatherCalculations for details."""
    return WeatherCalculations.calculate_feels_like_temperature(temperature, humidity, wind_speed)


def calculate_wind_chill(temperature: float, wind_speed: float) -> float:
    """Calculate wind chill. See WeatherCalculations.calculate_wind_chill for details."""
    return WeatherCalculations.calculate_wind_chill(temperature, wind_speed)


def calculate_heat_index(temperature: float, humidity: float) -> float:
    """Calculate heat index. See WeatherCalculations.calculate_heat_index for details."""
    return WeatherCalculations.calculate_heat_index(temperature, humidity)


def calculate_absolute_humidity(temperature: float, humidity: float) -> float:
    """Calculate absolute humidity. See WeatherCalculations for details."""
    return WeatherCalculations.calculate_absolute_humidity(temperature, humidity)


def convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    """Convert temperature between units. See WeatherCalculations for details."""
    return WeatherCalculations.convert_temperature(value, from_unit, to_unit)


def calculate_uv_risk_level(uv_index: Optional[float]) -> str:
    """Get UV risk level. See WeatherCalculations for details."""
    return WeatherCalculations.calculate_uv_risk_level(uv_index)


def get_beaufort_scale(wind_speed_ms: float) -> tuple[int, str]:
    """Get Beaufort scale. See WeatherCalculations for details."""
    return WeatherCalculations.get_beaufort_scale(wind_speed_ms)

