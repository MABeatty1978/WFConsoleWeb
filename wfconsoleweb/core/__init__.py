"""Core business logic and weather calculations"""

from wfconsoleweb.core.types import (
    Observation,
    WeatherSnapshot,
    AstronomicalData,
    ForecastPeriod,
    WeatherForecast,
    SagerForecast,
)
from wfconsoleweb.core.observation_parser import ObservationParser, get_parser
from wfconsoleweb.core.calculations import (
    calculate_dew_point,
    calculate_feels_like_temperature,
    calculate_wind_chill,
    calculate_heat_index,
    calculate_absolute_humidity,
    convert_temperature,
    calculate_uv_risk_level,
    get_beaufort_scale,
)
from wfconsoleweb.core.astronomical import AstronomicalCalculator
from wfconsoleweb.core.sager import SagerWeatherForecast, get_sager_manager
from wfconsoleweb.core.forecast import ForecastService, ForecastCache, get_forecast_cache
from wfconsoleweb.core.data_archival import DataArchivalManager, DataRetentionScheduler, get_retention_scheduler
from wfconsoleweb.core.alerts import AlertManager, AlertRule, DefaultAlerts, get_alert_manager
from wfconsoleweb.core.api_clients import WeatherFlowAPI, CheckWXAPI, GitHubAPI

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
