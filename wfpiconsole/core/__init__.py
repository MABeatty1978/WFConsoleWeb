"""Core business logic and weather calculations"""

from wfpiconsole.core.types import (
    Observation,
    WeatherSnapshot,
    AstronomicalData,
    ForecastPeriod,
    WeatherForecast,
    SagerForecast,
)
from wfpiconsole.core.observation_parser import ObservationParser, get_parser
from wfpiconsole.core.calculations import (
    calculate_dew_point,
    calculate_feels_like_temperature,
    calculate_wind_chill,
    calculate_heat_index,
    calculate_absolute_humidity,
    convert_temperature,
    calculate_uv_risk_level,
    get_beaufort_scale,
)
from wfpiconsole.core.astronomical import AstronomicalCalculator
from wfpiconsole.core.sager import SagerWeatherForecast, get_sager_manager
from wfpiconsole.core.forecast import ForecastService, ForecastCache, get_forecast_cache
from wfpiconsole.core.data_archival import DataArchivalManager, DataRetentionScheduler, get_retention_scheduler
from wfpiconsole.core.alerts import AlertManager, AlertRule, DefaultAlerts, get_alert_manager
from wfpiconsole.core.api_clients import WeatherFlowAPI, CheckWXAPI, GitHubAPI

__all__ = [
    # Data types
    "Observation",
    "WeatherSnapshot",
    "AstronomicalData",
    "ForecastPeriod",
    "WeatherForecast",
    "SagerForecast",
    # Observation parsing
    "ObservationParser",
    "get_parser",
    # Calculations
    "calculate_dew_point",
    "calculate_feels_like_temperature",
    "calculate_wind_chill",
    "calculate_heat_index",
    "calculate_absolute_humidity",
    "convert_temperature",
    "calculate_uv_risk_level",
    "get_beaufort_scale",
    # Astronomy
    "AstronomicalCalculator",
    # Weather forecasting
    "SagerWeatherForecast",
    "get_sager_manager",
    "ForecastService",
    "ForecastCache",
    "get_forecast_cache",
    # Data management
    "DataArchivalManager",
    "DataRetentionScheduler",
    "get_retention_scheduler",
    # Alerts
    "AlertManager",
    "AlertRule",
    "DefaultAlerts",
    "get_alert_manager",
    # API clients
    "WeatherFlowAPI",
    "CheckWXAPI",
    "GitHubAPI",
]
