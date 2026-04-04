"""Data types and models for weather observations"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List


@dataclass
class Observation:
    """Complete weather observation from Tempest device"""
    timestamp: datetime

    # Metadata about the source packet so clients can merge mixed-frequency data.
    packet_type: Optional[str] = None
    
    # Temperature (Celsius)
    air_temperature: Optional[float] = None
    feels_like_temperature: Optional[float] = None
    dew_point: Optional[float] = None
    relative_humidity: Optional[float] = None
    
    # Wind (m/s)
    wind_speed: Optional[float] = None
    wind_gust: Optional[float] = None
    wind_direction: Optional[int] = None  # 0-360 degrees
    wind_samples_rapid: Optional[int] = None
    
    # Pressure (mb)
    sea_level_pressure: Optional[float] = None
    pressure_trend: Optional[str] = None  # stable, falling, rising
    pressure_trend_3h: Optional[str] = None
    
    # Rainfall (mm)
    rainfall_rate: Optional[float] = None
    rainfall_accumulated_last_1h: Optional[float] = None
    rainfall_accumulated_last_24h: Optional[float] = None
    rainfall_daily: Optional[float] = None
    rainfall_monthly: Optional[float] = None
    rainfall_yearly: Optional[float] = None
    
    # Lightning (last hour)
    lightning_strike_count_3h: Optional[int] = None
    lightning_strike_last_distance: Optional[float] = None
    lightning_strike_last_time: Optional[datetime] = None
    
    # Solar/UV
    solar_radiation: Optional[float] = None
    uv_index: Optional[float] = None
    
    # Device status
    battery_voltage: Optional[float] = None
    rssi: Optional[int] = None  # Signal strength (-100 to 0 dBm)
    
    # Metadata
    station_id: Optional[str] = None
    device_id: Optional[str] = None
    sequence_number: Optional[int] = None
    obs_st_id: Optional[str] = None  # Observation station ID
    
    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            k: v for k, v in self.__dict__.items()
            if v is not None
        }


@dataclass
class WeatherSnapshot:
    """Current weather snapshot for dashboard display"""
    timestamp: datetime
    
    # Current conditions
    temperature: Optional[float] = None
    feels_like: Optional[float] = None
    humidity: Optional[float] = None
    
    # Wind
    wind_speed: Optional[float] = None
    wind_gust: Optional[float] = None
    wind_direction: Optional[int] = None
    
    # Pressure
    pressure: Optional[float] = None
    pressure_trend: Optional[str] = None
    
    # Precipitation
    rainfall_rate: Optional[float] = None
    rainfall_today: Optional[float] = None
    
    # Lightning (last hour)
    lightning_strikes_3h: Optional[int] = None
    lightning_distance: Optional[float] = None
    
    # Solar/UV
    uv_index: Optional[float] = None
    solar_radiation: Optional[float] = None
    
    # derived values
    dew_point: Optional[float] = None


@dataclass
class AstronomicalData:
    """Astronomical and celestial data"""
    timestamp: datetime
    sunrise: Optional[datetime] = None
    sunset: Optional[datetime] = None
    solar_noon: Optional[datetime] = None
    
    moonrise: Optional[datetime] = None
    moonset: Optional[datetime] = None
    
    # 0-1 (0=new moon, 0.5=full moon)
    moon_phase: Optional[float] = None
    moon_illumination: Optional[float] = None  # 0-100%
    
    # Julian date for detailed calculations
    julian_date: Optional[float] = None


@dataclass
class ForecastPeriod:
    """Single period of weather forecast"""
    timestamp: datetime
    
    # Temperature
    temp_high: Optional[float] = None
    temp_low: Optional[float] = None
    
    # Weather condition
    condition: Optional[str] = None  # clear, rain, snow, etc.
    condition_icon: Optional[str] = None  # Icon identifier
    
    # Wind
    wind_speed: Optional[float] = None
    wind_direction: Optional[int] = None
    
    # Precipitation probability
    pop: Optional[float] = None  # Probability of precipitation (0-1)
    
    # Rainfall amount
    rainfall_amount: Optional[float] = None
    
    # UV Index
    uv_index: Optional[float] = None


@dataclass
class WeatherForecast:
    """Weather forecast data"""
    timestamp: datetime
    periods: List[ForecastPeriod] = field(default_factory=list)
    source: str = "weatherflow"  # weatherflow, openweathermap, etc.


@dataclass
class SagerForecast:
    """Sager barometric forecast"""
    timestamp: datetime
    forecast_text: str
    confidence: str = "medium"  # high, medium, low
    trend: Optional[str] = None  # rising, stable, falling
    trend_speed: Optional[str] = None  # rapid, moderate, slow
