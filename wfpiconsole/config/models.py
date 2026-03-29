"""SQLAlchemy ORM models for database tables"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Boolean, Text, JSON, ForeignKey,
    Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from wfpiconsole.config.database import Base
from wfpiconsole.config.encryption import encrypt_value, decrypt_value


class AdminUser(Base):
    """Admin user for authentication"""
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(128), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)  # bcrypt hash
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class StationConfig(Base):
    """Tempest weather station configuration"""
    __tablename__ = "station_config"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String(64), unique=True, index=True)
    station_name = Column(String(256))
    latitude = Column(Float)
    longitude = Column(Float)
    elevation = Column(Float)
    
    # Device IDs
    tempest_device_id = Column(String(64))
    air_device_id = Column(String(64), nullable=True)
    sky_device_id = Column(String(64), nullable=True)
    
    # Connection settings
    connection_type = Column(String(32), default="udp_priority")  # udp_priority, websocket_only
    udp_enabled = Column(Boolean, default=True)
    rest_api_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class APIKey(Base):
    """Encrypted API keys for external services"""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String(64), unique=True, index=True)  # weatherflow, checkwx, github
    key_encrypted = Column(Text, nullable=False)  # Encrypted with master password
    last_verified = Column(DateTime(timezone=True), nullable=True)
    is_valid = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def set_key(self, plaintext_key: str):
        """Encrypt and store API key"""
        self.key_encrypted = encrypt_value(plaintext_key)

    def get_key(self) -> str:
        """Decrypt and return API key"""
        return decrypt_value(self.key_encrypted)


class DisplaySettings(Base):
    """User display preferences"""
    __tablename__ = "display_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True, index=True)
    device_key = Column(String(128), nullable=True, index=True)
    
    # Units
    temperature_unit = Column(String(1), default="C")  # C or F
    wind_unit = Column(String(8), default="m/s")  # m/s, mph, kph, knots
    pressure_unit = Column(String(6), default="mb")  # mb, inHg
    rainfall_unit = Column(String(2), default="mm")  # mm, in
    distance_unit = Column(String(3), default="km")  # km, mi
    
    # Display preferences
    current_theme = Column(String(64), default="dark-minimalist")
    primary_panel_count = Column(Integer, default=6)
    preferred_forecast_source = Column(String(16), default="tempest")  # tempest, sager
    preferred_atmos_panel = Column(String(16), default="barometer")  # lightning, barometer
    
    # Feels-like temperature thresholds
    feels_like_cold_threshold = Column(Float, default=13.0)
    feels_like_warm_threshold = Column(Float, default=20.0)
    
    # Data granularity
    data_granularity_minutes = Column(Integer, default=5)  # 1, 5, or 60
    
    # Language
    language = Column(String(5), default="en")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DataRetentionPolicy(Base):
    """Historical data retention settings"""
    __tablename__ = "data_retention_policy"

    id = Column(Integer, primary_key=True, index=True)
    max_age_days = Column(Integer, default=365)  # -1 for unlimited
    auto_prune_enabled = Column(Boolean, default=False)
    auto_prune_frequency_hours = Column(Integer, default=24)
    last_pruned = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CustomPanel(Base):
    """User-defined custom weather panel"""
    __tablename__ = "custom_panels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    display_type = Column(String(32))  # gauge, text, graph, sparkline, etc.
    
    # Panel configuration as JSON
    config = Column(JSON)  # Stores metric bindings, thresholds, styling, etc.
    
    layout_position = Column(Integer, default=0)
    is_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Theme(Base):
    """Custom theme definitions"""
    __tablename__ = "themes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    display_name = Column(String(256))
    
    # Theme configuration as JSON (CSS variables, colors, etc.)
    config = Column(JSON, nullable=False)
    
    is_builtin = Column(Boolean, default=False)
    is_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ObservationHistory(Base):
    """Historical weather observations"""
    __tablename__ = "observation_history"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Temperature data
    air_temperature = Column(Float, nullable=True)
    feels_like_temperature = Column(Float, nullable=True)
    dew_point = Column(Float, nullable=True)
    relative_humidity = Column(Float, nullable=True)
    
    # Wind data
    wind_speed = Column(Float, nullable=True)
    wind_gust = Column(Float, nullable=True)
    wind_direction = Column(Integer, nullable=True)  # 0-360 degrees
    rapid_wind_samples = Column(Integer, nullable=True)  # Count of rapid wind samples
    
    # Pressure data
    sea_level_pressure = Column(Float, nullable=True)
    pressure_trend = Column(String(16), nullable=True)  # stable, falling, rising
    
    # Rainfall
    rainfall_rate = Column(Float, nullable=True)
    rainfall_daily = Column(Float, nullable=True)
    rainfall_monthly = Column(Float, nullable=True)
    rainfall_yearly = Column(Float, nullable=True)
    
    # Lightning
    lightning_strike_count = Column(Integer, nullable=True)
    lightning_avg_distance = Column(Float, nullable=True)
    
    # Solar & UV
    solar_radiation = Column(Float, nullable=True)
    uv_index = Column(Float, nullable=True)
    
    # Device status
    battery_voltage = Column(Float, nullable=True)
    rssi = Column(Integer, nullable=True)  # Signal strength
    
    # Metadata
    station_id = Column(String(64), nullable=True, index=True)
    device_id = Column(String(64), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Indexes for efficient querying
    __table_args__ = (
        Index("idx_timestamp", "timestamp", postgresql_using="btree"),
        Index("idx_station_timestamp", "station_id", "timestamp"),
    )


class SagerNotification(Base):
    """Sager weather forecast notifications"""
    __tablename__ = "sager_notifications"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    forecast_text = Column(Text)
    confidence_level = Column(String(32))  # high, medium, low
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WeatherAlert(Base):
    """User-defined weather alerts"""
    __tablename__ = "weather_alerts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    
    # Alert trigger
    metric = Column(String(64))  # temperature, wind_speed, pressure, etc.
    comparison = Column(String(16))  # gt, lt, eq, gte, lte
    threshold_value = Column(Float)
    
    # Alert configuration
    is_enabled = Column(Boolean, default=True)
    notify_on_trigger = Column(Boolean, default=True)
    alert_cooldown_minutes = Column(Integer, default=60)
    
    last_triggered = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
