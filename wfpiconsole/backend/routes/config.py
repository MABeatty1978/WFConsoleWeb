"""Configuration API routes for settings management"""
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfpiconsole.config.models import (
    AdminUser,
    StationConfig,
    APIKey,
    DisplaySettings,
    DataRetentionPolicy,
    Theme,
)
from wfpiconsole.config.encryption import get_encryption_manager
from wfpiconsole.backend.dependencies import (
    get_db,
    get_admin_user,
    get_station_config,
    require_station_config,
)
from wfpiconsole.backend.auth import get_auth_manager


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["Configuration"])


# Pydantic models for request/response
class StationConfigRequest(BaseModel):
    """Request model for station configuration."""

    station_id: str
    name: str
    latitude: float
    longitude: float
    elevation_m: float
    device_id: Optional[str] = None
    hub_sn: Optional[str] = None
    connection_type: str = "local_broadcast"  # or "rest_api", "websocket"


class APIKeyRequest(BaseModel):
    """Request model for API key configuration."""

    service: str  # "weatherflow", "checkwx", "github"
    key: str
    secret: Optional[str] = None


class DisplaySettingsRequest(BaseModel):
    """Request model for display preferences."""

    temperature_unit: str = "C"  # or "F"
    wind_speed_unit: str = "m/s"  # or "mph", "kph", "knots"
    pressure_unit: str = "mb"  # or "inHg", "hPa"
    current_theme: str = "dark-minimalist"
    panels_per_row: int = 2
    feels_like_threshold_cold_c: float = 10.0
    feels_like_threshold_hot_c: float = 25.0
    data_granularity: str = "1min"  # "1min", "5min", "hourly"
    language: str = "en"


class DataRetentionRequest(BaseModel):
    """Request model for data retention policy."""

    max_age_days: Optional[int] = None  # None = unlimited
    auto_prune_enabled: bool = True


class PasswordChangeRequest(BaseModel):
    """Request model for password change."""

    current_password: str
    new_password: str


# Configuration endpoints


@router.get("/status")
async def get_config_status(db: Session = Depends(get_db)):
    """Get configuration status (is station configured, etc)."""
    station = db.query(StationConfig).first()
    settings = db.query(DisplaySettings).first()
    api_keys = db.query(APIKey).all()

    return {
        "is_configured": bool(station),
        "station_name": station.station_name if station else None,
        "has_display_settings": bool(settings),
        "api_keys_configured": [key.service_name for key in api_keys if key.is_valid],
    }


@router.get("/station")
async def get_station_config(station: Optional[StationConfig] = Depends(get_station_config)):
    """Get current station configuration."""
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Station not configured",
        )

    return {
        "station_id": station.station_id,
        "name": station.station_name,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "elevation_m": station.elevation,
        "device_id": station.tempest_device_id,
        "hub_sn": None,
        "connection_type": station.connection_type,
        "created_at": station.created_at.isoformat() if station.created_at else None,
        "updated_at": station.updated_at.isoformat() if station.updated_at else None,
    }


@router.post("/station")
async def update_station_config(
    config: StationConfigRequest,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update or create station configuration."""
    try:
        # Get or create station config
        station = db.query(StationConfig).first()
        if not station:
            station = StationConfig()
            db.add(station)

        # Update fields
        station.station_id = config.station_id
        station.station_name = config.name
        station.latitude = config.latitude
        station.longitude = config.longitude
        station.elevation = config.elevation_m
        station.tempest_device_id = config.device_id
        station.connection_type = config.connection_type

        db.commit()
        db.refresh(station)
        logger.info(f"Station configuration updated by {current_user.username}")

        return {"status": "success", "station_name": station.station_name}

    except Exception as e:
        logger.error(f"Error updating station config: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update station configuration",
        )


@router.get("/display")
async def get_display_settings(db: Session = Depends(get_db)):
    """Get display preferences."""
    settings = db.query(DisplaySettings).first()
    if not settings:
        # Return defaults if not configured
        return {
            "temperature_unit": "C",
            "wind_speed_unit": "m/s",
            "pressure_unit": "mb",
            "current_theme": "dark-minimalist",
            "panels_per_row": 2,
            "feels_like_threshold_cold_c": 10.0,
            "feels_like_threshold_hot_c": 25.0,
            "data_granularity": "1min",
            "language": "en",
        }

    return {
        "temperature_unit": settings.temperature_unit,
        "wind_speed_unit": settings.wind_speed_unit,
        "pressure_unit": settings.pressure_unit,
        "current_theme": settings.current_theme,
        "panels_per_row": settings.panels_per_row,
        "feels_like_threshold_cold_c": settings.feels_like_threshold_cold_c,
        "feels_like_threshold_hot_c": settings.feels_like_threshold_hot_c,
        "data_granularity": settings.data_granularity,
        "language": settings.language,
    }


@router.post("/display")
async def update_display_settings(
    settings: DisplaySettingsRequest,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update display preferences."""
    try:
        display = db.query(DisplaySettings).first()
        if not display:
            display = DisplaySettings()
            db.add(display)

        display.temperature_unit = settings.temperature_unit
        display.wind_speed_unit = settings.wind_speed_unit
        display.pressure_unit = settings.pressure_unit
        display.current_theme = settings.current_theme
        display.panels_per_row = settings.panels_per_row
        display.feels_like_threshold_cold_c = settings.feels_like_threshold_cold_c
        display.feels_like_threshold_hot_c = settings.feels_like_threshold_hot_c
        display.data_granularity = settings.data_granularity
        display.language = settings.language

        db.commit()
        logger.info(f"Display settings updated by {current_user.username}")

        return {"status": "success", "message": "Display settings updated"}

    except Exception as e:
        logger.error(f"Error updating display settings: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update display settings",
        )


@router.get("/api-keys")
async def list_api_keys(
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List configured API keys (without exposing values)."""
    keys = db.query(APIKey).all()
    return {
        "api_keys": [
            {
                "service": key.service,
                "is_configured": bool(key.encrypted_value),
                "is_valid": key.is_valid,
                "last_verified": key.last_verified_at.isoformat() if key.last_verified_at else None,
            }
            for key in keys
        ]
    }


@router.post("/api-keys")
async def configure_api_key(
    api_key: APIKeyRequest,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Configure or update an API key."""
    try:
        encryption = get_encryption_manager()

        # Find or create API key record
        key_record = db.query(APIKey).filter(APIKey.service == api_key.service).first()
        if not key_record:
            key_record = APIKey(service=api_key.service)
            db.add(key_record)

        # Encrypt and store the key
        key_record.encrypted_value = encryption.encrypt_value(api_key.key)
        if api_key.secret:
            key_record.encrypted_secret = encryption.encrypt_value(api_key.secret)

        db.commit()
        logger.info(f"API key configured for {api_key.service} by {current_user.username}")

        return {
            "status": "success",
            "service": api_key.service,
            "message": f"API key for {api_key.service} configured successfully",
        }

    except Exception as e:
        logger.error(f"Error configuring API key: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to configure API key",
        )


@router.delete("/api-keys/{service}")
async def delete_api_key(
    service: str,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete an API key configuration."""
    try:
        key = db.query(APIKey).filter(APIKey.service == service).first()
        if not key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"API key for {service} not found",
            )

        db.delete(key)
        db.commit()
        logger.info(f"API key for {service} deleted by {current_user.username}")

        return {"status": "success", "message": f"API key for {service} deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API key: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete API key",
        )


@router.post("/password")
async def change_password(
    password_change: PasswordChangeRequest,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Change admin user password."""
    try:
        auth_manager = get_auth_manager()

        # Verify current password
        if not auth_manager.verify_password(password_change.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )

        # Update password
        current_user.password_hash = auth_manager.hash_password(password_change.new_password)
        db.commit()

        logger.info(f"Password changed for user {current_user.username}")
        return {"status": "success", "message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password",
        )


@router.get("/retention")
async def get_retention_policy(db: Session = Depends(get_db)):
    """Get data retention policy."""
    policy = db.query(DataRetentionPolicy).first()
    if not policy:
        return {
            "max_age_days": None,
            "auto_prune_enabled": True,
        }

    return {
        "max_age_days": policy.max_age_days,
        "auto_prune_enabled": policy.auto_prune_enabled,
        "last_prune_timestamp": policy.last_prune_timestamp.isoformat() if policy.last_prune_timestamp else None,
    }


@router.post("/retention")
async def update_retention_policy(
    policy: DataRetentionRequest,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update data retention policy."""
    try:
        retention = db.query(DataRetentionPolicy).first()
        if not retention:
            retention = DataRetentionPolicy()
            db.add(retention)

        retention.max_age_days = policy.max_age_days
        retention.auto_prune_enabled = policy.auto_prune_enabled

        db.commit()
        logger.info(f"Retention policy updated by {current_user.username}")

        return {"status": "success", "message": "Retention policy updated"}

    except Exception as e:
        logger.error(f"Error updating retention policy: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update retention policy",
        )
