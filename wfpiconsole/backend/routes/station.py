"""Station observations and data endpoints"""
import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfpiconsole.config.models import ObservationHistory, StationConfig
from wfpiconsole.backend.dependencies import (
    get_db,
    get_station_config,
    require_station_config,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/station", tags=["Station"])

# Global storage for latest observation (in production, use database or cache)
_latest_observation: Optional[dict] = None


# Pydantic models
class ObservationResponse(BaseModel):
    """Current observation data."""

    timestamp: str
    device_id: str
    temp_c: Optional[float]
    humidity: Optional[float]
    pressure_mb: Optional[float]
    wind_speed_mps: Optional[float]
    wind_gust_mps: Optional[float]
    wind_direction_deg: Optional[float]
    rainfall_mm: Optional[float]
    solar_radiation_wm2: Optional[float]
    uv_index: Optional[float]
    lightning_strike_count: Optional[int]
    lightning_strike_last_distance_km: Optional[float]
    battery_voltage: Optional[float]
    signal_strength: Optional[int]


class StationInfoResponse(BaseModel):
    """Station information."""

    station_id: str
    name: str
    latitude: float
    longitude: float
    elevation_m: float
    device_id: Optional[str]
    hub_sn: Optional[str]
    connection_type: str


class CurrentConditionsResponse(BaseModel):
    """Current weather conditions with calculated values."""

    temperature_c: Optional[float]
    temperature_f: Optional[float]
    feels_like_c: Optional[float]
    feels_like_f: Optional[float]
    humidity: Optional[float]
    pressure_mb: Optional[float]
    wind_speed_mps: Optional[float]
    wind_speed_mph: Optional[float]
    wind_gust_mps: Optional[float]
    wind_gust_mph: Optional[float]
    wind_direction_deg: Optional[float]
    wind_direction_cardinal: str
    rainfall_mm: Optional[float]
    rainfall_in: Optional[float]
    solar_radiation_wm2: Optional[float]
    uv_index: Optional[float]
    uv_risk_level: str
    lightning_distance_km: Optional[float]
    battery_status: str
    signal_strength: Optional[int]
    observation_timestamp: str


# Station endpoints


@router.get("/info", response_model=StationInfoResponse)
async def get_station_info(station: StationConfig = Depends(require_station_config)):
    """Get station configuration and metadata."""
    return StationInfoResponse(
        station_id=station.station_id,
        name=station.name,
        latitude=station.latitude,
        longitude=station.longitude,
        elevation_m=station.elevation_m,
        device_id=station.device_id,
        hub_sn=station.hub_sn,
        connection_type=station.connection_type,
    )


@router.get("/latest-observation", response_model=Optional[ObservationResponse])
async def get_latest_observation(db: Session = Depends(get_db)):
    """Get the latest observation from database."""
    latest = db.query(ObservationHistory).order_by(ObservationHistory.timestamp.desc()).first()

    if not latest:
        return None

    return ObservationResponse(
        timestamp=latest.timestamp.isoformat(),
        device_id=latest.device_id,
        temp_c=latest.temp_c,
        humidity=latest.humidity,
        pressure_mb=latest.pressure_mb,
        wind_speed_mps=latest.wind_speed_mps,
        wind_gust_mps=latest.wind_gust_mps,
        wind_direction_deg=latest.wind_direction_deg,
        rainfall_mm=latest.rainfall_mm,
        solar_radiation_wm2=latest.solar_radiation_wm2,
        uv_index=latest.uv_index,
        lightning_strike_count=latest.lightning_strike_count,
        lightning_strike_last_distance_km=latest.lightning_strike_last_distance_km,
        battery_voltage=latest.battery_voltage,
        signal_strength=latest.signal_strength,
    )


@router.get("/current-conditions", response_model=Optional[CurrentConditionsResponse])
async def get_current_conditions(db: Session = Depends(get_db)):
    """Get current conditions with unit conversions and calculated values."""
    from wfpiconsole.core.calculations import (
        calculate_feels_like_temperature,
        convert_temperature,
        get_beaufort_scale,
        calculate_uv_risk_level,
    )

    latest = db.query(ObservationHistory).order_by(ObservationHistory.timestamp.desc()).first()

    if not latest:
        return None

    # Temperature conversions
    temp_c = latest.temp_c
    temp_f = convert_temperature(temp_c, "C", "F") if temp_c is not None else None

    # Feels like calculation
    feels_like_c = (
        calculate_feels_like_temperature(temp_c, latest.wind_speed_mps, latest.humidity)
        if temp_c is not None
        else None
    )
    feels_like_f = convert_temperature(feels_like_c, "C", "F") if feels_like_c is not None else None

    # Wind conversions
    wind_mps = latest.wind_speed_mps
    wind_mph = wind_mps * 2.23694 if wind_mps is not None else None
    wind_gust_mph = latest.wind_gust_mps * 2.23694 if latest.wind_gust_mps is not None else None

    # Rainfall conversions
    rain_mm = latest.rainfall_mm
    rain_in = rain_mm / 25.4 if rain_mm is not None else None

    # Wind direction (cardinal)
    wind_dir = latest.wind_direction_deg if latest.wind_direction_deg is not None else 0
    cardinal_directions = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ]
    cardinal_idx = int((wind_dir + 11.25) / 22.5) % 16
    cardinal = cardinal_directions[cardinal_idx]

    # Battery status
    battery_voltage = latest.battery_voltage
    if battery_voltage is None:
        battery_status = "unknown"
    elif battery_voltage >= 2.7:
        battery_status = "good"
    elif battery_voltage >= 2.4:
        battery_status = "low"
    else:
        battery_status = "critical"

    # UV risk level
    uv_risk = calculate_uv_risk_level(latest.uv_index) if latest.uv_index is not None else "unknown"

    return CurrentConditionsResponse(
        temperature_c=temp_c,
        temperature_f=temp_f,
        feels_like_c=feels_like_c,
        feels_like_f=feels_like_f,
        humidity=latest.humidity,
        pressure_mb=latest.pressure_mb,
        wind_speed_mps=wind_mps,
        wind_speed_mph=wind_mph,
        wind_gust_mps=latest.wind_gust_mps,
        wind_gust_mph=wind_gust_mph,
        wind_direction_deg=wind_dir,
        wind_direction_cardinal=cardinal,
        rainfall_mm=rain_mm,
        rainfall_in=rain_in,
        solar_radiation_wm2=latest.solar_radiation_wm2,
        uv_index=latest.uv_index,
        uv_risk_level=uv_risk,
        lightning_distance_km=latest.lightning_strike_last_distance_km,
        battery_status=battery_status,
        signal_strength=latest.signal_strength,
        observation_timestamp=latest.timestamp.isoformat(),
    )


@router.post("/update-observation")
async def update_observation(observation: dict, db: Session = Depends(get_db)):
    """
    Update latest observation (called by UDP listener/WebSocket service).

    Internal endpoint for services to report new observations.
    """
    try:
        # Create new observation record
        obs = ObservationHistory(
            timestamp=datetime.utcnow(),
            device_id=observation.get("device_id", "unknown"),
            temp_c=observation.get("temp_c"),
            humidity=observation.get("humidity"),
            pressure_mb=observation.get("pressure_mb"),
            wind_speed_mps=observation.get("wind_speed_mps"),
            wind_gust_mps=observation.get("wind_gust_mps"),
            wind_direction_deg=observation.get("wind_direction_deg"),
            rainfall_mm=observation.get("rainfall_mm", 0),
            solar_radiation_wm2=observation.get("solar_radiation_wm2"),
            uv_index=observation.get("uv_index"),
            lightning_strike_count=observation.get("lightning_strike_count", 0),
            lightning_strike_last_distance_km=observation.get("lightning_strike_last_distance_km"),
            battery_voltage=observation.get("battery_voltage"),
            signal_strength=observation.get("signal_strength"),
        )

        db.add(obs)
        db.commit()

        # Store in memory for quick access
        global _latest_observation
        _latest_observation = observation

        logger.debug("Observation updated")
        return {"status": "success", "timestamp": obs.timestamp.isoformat()}

    except Exception as e:
        logger.error(f"Error updating observation: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update observation",
        )


@router.get("/observations/stats")
async def get_observation_stats(
    hours: int = 24, db: Session = Depends(get_db)
):
    """
    Get observation statistics for specified hours.

    Args:
        hours: Number of hours to analyze (default 24)

    Returns:
        Statistics including min/max/avg for key metrics
    """
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(hours=hours)
    observations = (
        db.query(ObservationHistory)
        .filter(ObservationHistory.timestamp >= cutoff)
        .all()
    )

    if not observations:
        return {"observation_count": 0}

    # Calculate statistics
    temps = [o.temp_c for o in observations if o.temp_c is not None]
    humidities = [o.humidity for o in observations if o.humidity is not None]
    pressures = [o.pressure_mb for o in observations if o.pressure_mb is not None]
    winds = [o.wind_speed_mps for o in observations if o.wind_speed_mps is not None]
    gusts = [o.wind_gust_mps for o in observations if o.wind_gust_mps is not None]
    rainfall_total = sum(o.rainfall_mm for o in observations if o.rainfall_mm is not None)

    return {
        "observation_count": len(observations),
        "period_hours": hours,
        "time_range": {
            "start": observations[0].timestamp.isoformat(),
            "end": observations[-1].timestamp.isoformat(),
        },
        "temperature": {
            "min_c": min(temps) if temps else None,
            "max_c": max(temps) if temps else None,
            "avg_c": sum(temps) / len(temps) if temps else None,
        },
        "humidity": {
            "min": min(humidities) if humidities else None,
            "max": max(humidities) if humidities else None,
            "avg": sum(humidities) / len(humidities) if humidities else None,
        },
        "pressure": {
            "min_mb": min(pressures) if pressures else None,
            "max_mb": max(pressures) if pressures else None,
            "avg_mb": sum(pressures) / len(pressures) if pressures else None,
        },
        "wind": {
            "min_mps": min(winds) if winds else None,
            "max_mps": max(winds) if winds else None,
            "avg_mps": sum(winds) / len(winds) if winds else None,
            "max_gust_mps": max(gusts) if gusts else None,
        },
        "rainfall_total_mm": rainfall_total,
    }
