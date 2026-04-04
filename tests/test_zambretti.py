from datetime import datetime, timedelta, timezone

from wfconsoleweb.core.zambretti import ZambrettiForecaster, ZambrettiObservation


def _obs(hours_offset: int, slp: float | None, station: float | None = None, temp: float | None = 20.0, wind: float | None = None) -> ZambrettiObservation:
    base = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
    return ZambrettiObservation(
        timestamp=base + timedelta(hours=hours_offset),
        sea_level_pressure_mb=slp,
        station_pressure_mb=station,
        air_temperature_c=temp,
        wind_direction_deg=wind,
    )


def test_trend_classification_boundaries():
    forecaster = ZambrettiForecaster()

    assert forecaster._trend_from_pressure_delta(1.6) == "rising"
    assert forecaster._trend_from_pressure_delta(1.59) == "steady"
    assert forecaster._trend_from_pressure_delta(-1.6) == "falling"
    assert forecaster._trend_from_pressure_delta(-1.59) == "steady"


def test_wind_adjustment_bins_and_wraparound():
    forecaster = ZambrettiForecaster()

    assert forecaster._wind_adjustment(None) == 0
    assert forecaster._wind_adjustment(0) == 0
    assert forecaster._wind_adjustment(359) == 0
    assert forecaster._wind_adjustment(90) == 1
    assert forecaster._wind_adjustment(180) == 2


def test_seasonal_bias_changes_rising_result_month_to_month():
    forecaster = ZambrettiForecaster("north")

    assert forecaster._zambretti_value(1018.0, "rising", 2, month=1) == 24
    assert forecaster._zambretti_value(1018.0, "rising", 2, month=7) == 23


def test_calculate_returns_none_when_insufficient_history():
    forecaster = ZambrettiForecaster()

    result = forecaster.calculate([_obs(0, 1015.0, wind=180)], elevation_m=50.0)

    assert result is None


def test_calculate_supports_station_pressure_fallback():
    forecaster = ZambrettiForecaster()
    observations = [
        _obs(-3, None, station=1008.0, temp=12.0, wind=90),
        _obs(0, None, station=1009.0, temp=12.0, wind=90),
    ]

    result = forecaster.calculate(observations, elevation_m=120.0)

    assert result is not None
    assert result.pressure_mb > 0
    assert result.forecast_text


def test_regression_output_for_known_winter_inputs():
    forecaster = ZambrettiForecaster("north")
    observations = [
        _obs(-6, 1015.0, wind=180),
        _obs(-3, 1016.0, wind=180),
        _obs(0, 1018.0, wind=180),
    ]

    result = forecaster.calculate(observations, elevation_m=100.0)

    assert result is not None
    assert result.zambretti_number == 24
    assert result.forecast_text == "Fairly Fine, Possibly Showers Early"
    assert result.pressure_trend == "rising"
    assert result.pressure_delta_3h_mb == 2.0
    assert result.dial_angle_deg == 58.1
