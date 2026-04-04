"""Zambretti forecasting implementation for station pressure observations."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Optional


@dataclass
class ZambrettiObservation:
    """Observation values required to compute Zambretti output."""

    timestamp: datetime
    sea_level_pressure_mb: Optional[float]
    station_pressure_mb: Optional[float] = None
    air_temperature_c: Optional[float] = None
    wind_direction_deg: Optional[float] = None


@dataclass
class ZambrettiForecast:
    """Calculated Zambretti forecast payload."""

    zambretti_number: int
    forecast_text: str
    pressure_trend: str
    pressure_mb: float
    pressure_delta_3h_mb: float
    wind_direction_deg: Optional[float]
    dial_angle_deg: float


class ZambrettiForecaster:
    """Compute Zambretti forecast from station observations.

    Method follows the equations and lookup table style documented by the
    SAS community project:
    https://github.com/sascommunities/iot-zambretti-weather-forcasting
    """

    FALLING_FORECASTS = {
        1: "Settled Fine",
        2: "Fine Weather",
        3: "Fine, Becoming Less Settled",
        4: "Fairly Fine, Showery Later",
        5: "Showery, Becoming More Unsettled",
        6: "Unsettled, Rain Later",
        7: "Rain at Times, Worse Later",
        8: "Rain at Times, Becoming Very Unsettled",
        9: "Very Unsettled, Rain",
    }

    STEADY_FORECASTS = {
        10: "Settled Fine",
        11: "Fine Weather",
        12: "Fine, Possibly Showers",
        13: "Fairly Fine, Showers Likely",
        14: "Showery, Bright Intervals",
        15: "Changeable, Some Rain",
        16: "Unsettled, Rain at Times",
        17: "Rain at Frequent Intervals",
        18: "Very Unsettled, Rain",
        19: "Stormy, Much Rain",
    }

    RISING_FORECASTS = {
        20: "Settled Fine",
        21: "Fine Weather",
        22: "Becoming Fine",
        23: "Fairly Fine, Improving",
        24: "Fairly Fine, Possibly Showers Early",
        25: "Showery Early, Improving",
        26: "Changeable, Mending",
        27: "Rather Unsettled, Clearing Later",
        28: "Unsettled, Probably Improving",
        29: "Unsettled, Short Fine Intervals",
        30: "Very Unsettled, Finer at Times",
        31: "Stormy, Possibly Improving",
        32: "Stormy, Much Rain",
    }

    SUMMER_MONTHS_NORTH = {4, 5, 6, 7, 8, 9}
    SEASONAL_PRESSURE_BIAS_MB = 1.6

    def __init__(self, hemisphere: str = "north"):
        self.hemisphere = hemisphere.lower()

    @staticmethod
    def _compute_slp_from_station_pressure(
        pressure_mb: float,
        elevation_m: float,
        temp_c: float,
    ) -> float:
        return pressure_mb * pow(
            1 - (0.0065 * elevation_m) / (temp_c + (0.0065 * elevation_m) + 273.15),
            -5.257,
        )

    @staticmethod
    def _wind_adjustment(wind_direction_deg: Optional[float]) -> int:
        if wind_direction_deg is None:
            return 0

        direction = wind_direction_deg % 360
        if 135 <= direction <= 225:
            return 2
        if direction >= 315 or direction <= 45:
            return 0
        return 1

    @staticmethod
    def _dial_angle(z_value: int) -> float:
        # Map 1..32 onto -120..120 deg for a vintage-style dial needle.
        normalized = (max(1, min(32, z_value)) - 1) / 31
        return -120.0 + (normalized * 240.0)

    def _trend_from_pressure_delta(self, pressure_delta_3h_mb: float) -> str:
        if pressure_delta_3h_mb >= 1.6:
            return "rising"
        if pressure_delta_3h_mb <= -1.6:
            return "falling"
        return "steady"

    def _seasonal_pressure_bias(self, month: int) -> float:
        is_north = self.hemisphere != "south"
        is_summer_north = month in self.SUMMER_MONTHS_NORTH
        is_summer = is_summer_north if is_north else not is_summer_north
        return self.SEASONAL_PRESSURE_BIAS_MB if is_summer else -self.SEASONAL_PRESSURE_BIAS_MB

    def _zambretti_value(self, pressure_mb: float, trend: str, wind_adjustment: int, month: int) -> int:
        adjusted_pressure_mb = pressure_mb + self._seasonal_pressure_bias(month)

        if trend == "falling":
            raw = int((127 - (0.12 * adjusted_pressure_mb)) // 1) + wind_adjustment
            return max(1, min(9, raw))

        if trend == "rising":
            raw = int((185 - (0.16 * adjusted_pressure_mb)) // 1) + wind_adjustment
            return max(20, min(32, raw))

        raw = int((144 - (0.13 * adjusted_pressure_mb)) // 1) + wind_adjustment
        return max(10, min(19, raw))

    def _forecast_text(self, z_value: int, trend: str) -> str:
        if trend == "falling":
            return self.FALLING_FORECASTS.get(z_value, "Unsettled")
        if trend == "rising":
            return self.RISING_FORECASTS.get(z_value, "Improving")
        return self.STEADY_FORECASTS.get(z_value, "Changeable")

    def calculate(
        self,
        observations: Iterable[ZambrettiObservation],
        elevation_m: Optional[float],
    ) -> Optional[ZambrettiForecast]:
        ordered = sorted(observations, key=lambda obs: obs.timestamp)
        if len(ordered) < 2:
            return None

        latest = ordered[-1]
        latest_pressure = latest.sea_level_pressure_mb

        if latest_pressure is None and latest.station_pressure_mb is not None and elevation_m is not None and latest.air_temperature_c is not None:
            latest_pressure = self._compute_slp_from_station_pressure(
                latest.station_pressure_mb,
                elevation_m,
                latest.air_temperature_c,
            )

        if latest_pressure is None:
            return None

        target_time = latest.timestamp - timedelta(hours=3)
        reference = None

        for obs in reversed(ordered[:-1]):
            if obs.timestamp <= target_time:
                reference = obs
                break

        if reference is None:
            reference = ordered[0]

        reference_pressure = reference.sea_level_pressure_mb
        if reference_pressure is None and reference.station_pressure_mb is not None and elevation_m is not None and reference.air_temperature_c is not None:
            reference_pressure = self._compute_slp_from_station_pressure(
                reference.station_pressure_mb,
                elevation_m,
                reference.air_temperature_c,
            )

        if reference_pressure is None:
            return None

        pressure_delta_3h_mb = latest_pressure - reference_pressure
        trend = self._trend_from_pressure_delta(pressure_delta_3h_mb)
        wind_adjustment = self._wind_adjustment(latest.wind_direction_deg)
        z_value = self._zambretti_value(
            latest_pressure,
            trend,
            wind_adjustment,
            latest.timestamp.month,
        )

        return ZambrettiForecast(
            zambretti_number=z_value,
            forecast_text=self._forecast_text(z_value, trend),
            pressure_trend=trend,
            pressure_mb=round(latest_pressure, 1),
            pressure_delta_3h_mb=round(pressure_delta_3h_mb, 2),
            wind_direction_deg=latest.wind_direction_deg,
            dial_angle_deg=round(self._dial_angle(z_value), 1),
        )
