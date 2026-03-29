"""
Forecast routes - Sager and astronomical data endpoints
"""

import os
import re
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import httpx
from zoneinfo import ZoneInfo
from typing import Optional

from wfpiconsole.backend.auth import get_current_user
from wfpiconsole.backend.dependencies import get_db
from datetime import datetime, timezone, timedelta

from wfpiconsole.core.astronomical import AstronomicalCalculator
from wfpiconsole.core.sager import SagerWeatherForecast
from wfpiconsole.core.api_clients import WeatherFlowAPI

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


def _sanitize_tempest_error_message(error: Exception) -> str:
    """Convert upstream Tempest/WeatherFlow errors into safe user-facing text."""
    message = str(error)

    if "401 Unauthorized" in message:
        return "WeatherFlow API token was rejected. Update the token in Settings."
    if "429" in message:
        return "WeatherFlow forecast is temporarily rate limited. Try again shortly."
    if "timed out" in message.lower():
        return "WeatherFlow forecast request timed out. Try again shortly."

    sanitized = re.sub(r"token=[^&\s]+", "token=[redacted]", message)
    return sanitized


def _get_weatherflow_token(db: Session) -> Optional[str]:
    """Resolve WeatherFlow API token from configured API keys or env vars."""
    from wfpiconsole.config.models import APIKey

    key = (
        db.query(APIKey)
        .filter(APIKey.service_name.in_(["weatherflow", "tempest"]))
        .first()
    )
    if key and getattr(key, "key_encrypted", None):
        try:
            return key.get_key()
        except Exception:
            pass

    return os.getenv("WEATHERFLOW_API_TOKEN") or os.getenv("WEATHERFLOW_TOKEN")


async def _fetch_live_solar_data(latitude: float, longitude: float) -> tuple[Optional[int], Optional[int], Optional[str]]:
    """Fetch sunrise/sunset from Open-Meteo with station-local timezone.

    Returns:
        (sunrise_epoch_seconds, sunset_epoch_seconds, timezone_name)
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "sunrise,sunset",
        "timezone": "auto",
        "forecast_days": 1,
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    daily = payload.get("daily") or {}
    sunrise_values = daily.get("sunrise") or []
    sunset_values = daily.get("sunset") or []
    tz_name = payload.get("timezone")
    utc_offset_seconds = payload.get("utc_offset_seconds")

    if not sunrise_values or not sunset_values:
        return None, None, tz_name

    sunrise_local = datetime.fromisoformat(sunrise_values[0])
    sunset_local = datetime.fromisoformat(sunset_values[0])

    tzinfo = None
    if tz_name:
        try:
            tzinfo = ZoneInfo(tz_name)
        except Exception:
            tzinfo = None

    if tzinfo is None and isinstance(utc_offset_seconds, int):
        tzinfo = timezone(timedelta(seconds=utc_offset_seconds))

    if sunrise_local.tzinfo is None and tzinfo is not None:
        sunrise_local = sunrise_local.replace(tzinfo=tzinfo)
    if sunset_local.tzinfo is None and tzinfo is not None:
        sunset_local = sunset_local.replace(tzinfo=tzinfo)

    if sunrise_local.tzinfo is None or sunset_local.tzinfo is None:
        return None, None, tz_name

    return int(sunrise_local.timestamp()), int(sunset_local.timestamp()), tz_name


@router.get("/sager")
async def get_sager_forecast(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get Sager barometric forecast
    
    Based on sea level pressure trends, provides weather prediction
    for the next 12-24 hours.
    """
    try:
        # Get latest observation for pressure trend calculation
        from wfpiconsole.config.models import ObservationHistory
        from sqlalchemy import select, desc
        
        result = db.execute(
            select(ObservationHistory)
            .order_by(desc(ObservationHistory.timestamp))
            .limit(24)
        )
        observations = result.scalars().all()
        
        if not observations:
            return {
                "forecastCode": 10,
                "forecastText": "Insufficient data for forecast",
                "seaLevelPressureTrend": "Unknown",
                "localTime": 0,
            }
        
        # Calculate Sager forecast based on pressure trend
        pressures = [obs.sea_level_pressure for obs in reversed(observations) if obs.sea_level_pressure is not None]

        if len(pressures) < 4:
            latest_with_pressure = next((obs for obs in observations if obs.sea_level_pressure is not None), None)
            if latest_with_pressure is not None:
                return {
                    "forecastCode": 4,
                    "forecastText": "Steady pressure (limited recent history)",
                    "seaLevelPressureTrend": "steady",
                    "localTime": int(latest_with_pressure.timestamp.timestamp()) if latest_with_pressure.timestamp else 0,
                }
            return {
                "forecastCode": 10,
                "forecastText": "Insufficient data for forecast",
                "seaLevelPressureTrend": "Unknown",
                "localTime": int(observations[0].timestamp.timestamp()) if observations and observations[0].timestamp else 0,
            }

        sager = SagerWeatherForecast(latitude=0)
        forecast = None
        ordered_observations = [obs for obs in reversed(observations) if obs.sea_level_pressure is not None]
        for obs in ordered_observations:
            forecast = sager.add_observation(obs.sea_level_pressure, obs.timestamp)

        if forecast is None:
            return {
                "forecastCode": 10,
                "forecastText": "Insufficient data for forecast",
                "seaLevelPressureTrend": "Unknown",
                "localTime": int(ordered_observations[-1].timestamp.timestamp()) if ordered_observations else 0,
            }
        
        latest = ordered_observations[-1]

        trend_lookup = {
            "steady": 4,
            "rising": 2,
            "falling": 7,
        }
        
        return {
            "forecastCode": trend_lookup.get(forecast.pressure_trend or "steady", 10),
            "forecastText": forecast.forecast_text,
            "seaLevelPressureTrend": forecast.pressure_trend or "Unknown",
            "localTime": int(latest.timestamp.timestamp()) if latest.timestamp else 0,
        }
    except Exception as e:
        return {
            "error": str(e),
            "forecastCode": 10,
            "forecastText": "Error calculating forecast",
            "seaLevelPressureTrend": "Unknown",
            "localTime": 0,
        }


@router.get("/tempest")
async def get_tempest_forecast(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get WeatherFlow Tempest Better Forecast data for configured station."""
    try:
        from wfpiconsole.config.models import StationConfig
        from sqlalchemy import select

        result = db.execute(select(StationConfig))
        station = result.scalar_one_or_none()
        if not station:
            return {
                "source": "tempest",
                "error": "Station not configured",
                "current": None,
                "daily": [],
                "hourly": [],
            }

        token = _get_weatherflow_token(db)
        if not token:
            return {
                "source": "tempest",
                "error": "WeatherFlow API token is not configured",
                "current": None,
                "daily": [],
                "hourly": [],
            }

        client = WeatherFlowAPI(token)
        try:
            data = await client.get_forecast(
                station.latitude or 0,
                station.longitude or 0,
                station.station_id,
            )
        finally:
            await client.close()

        if not data:
            return {
                "source": "tempest",
                "error": "No forecast data available",
                "current": None,
                "daily": [],
                "hourly": [],
            }

        forecast_block = data.get("forecast") if isinstance(data, dict) else None
        current = data.get("current_conditions") if isinstance(data, dict) else None
        daily = []
        hourly = []

        if isinstance(forecast_block, dict):
            daily = forecast_block.get("daily", []) or []
            hourly = forecast_block.get("hourly", []) or []

        if not daily and isinstance(data, dict):
            daily = data.get("daily", []) or []
        if not hourly and isinstance(data, dict):
            hourly = data.get("hourly", []) or []

        return {
            "source": "tempest",
            "fetchedAt": int(datetime.now(timezone.utc).timestamp()),
            "timezone": data.get("timezone") if isinstance(data, dict) else None,
            "current": current,
            "daily": daily[:7],
            "hourly": hourly[:24],
            "location": {
                "stationId": station.station_id,
                "latitude": station.latitude,
                "longitude": station.longitude,
            },
        }
    except Exception as e:
        return {
            "source": "tempest",
            "error": _sanitize_tempest_error_message(e),
            "current": None,
            "daily": [],
            "hourly": [],
        }


@router.get("/astronomical")
async def get_astronomical_data(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get astronomical data (sunrise, sunset, moon phases, etc.)
    """
    try:
        from wfpiconsole.config.models import StationConfig
        from sqlalchemy import select
        
        # Get station configuration for location
        result = db.execute(select(StationConfig))
        station = result.scalar_one_or_none()
        
        if not station:
            return {
                "error": "Station not configured",
                "sunriseTime": 0,
                "sunsetTime": 0,
                "solarNoon": 0,
                "moonPhase": 0,
                "moonIllumination": 0,
            }
        
        # Calculate astronomical data (fallback/default)
        calc = AstronomicalCalculator(
            latitude=station.latitude or 0,
            longitude=station.longitude or 0,
        )
        
        data = calc.calculate_astronomical_data(datetime.now(timezone.utc))

        sunrise_ts = int(data.sunrise.timestamp()) if data.sunrise else 0
        sunset_ts = int(data.sunset.timestamp()) if data.sunset else 0
        data_source = "calculated"
        station_timezone = None

        # Prefer live sunrise/sunset when internet is available; fall back if not.
        try:
            live_sunrise, live_sunset, live_timezone = await _fetch_live_solar_data(
                station.latitude or 0,
                station.longitude or 0,
            )
            if live_sunrise and live_sunset:
                sunrise_ts = live_sunrise
                sunset_ts = live_sunset
                data_source = "open-meteo"
                station_timezone = live_timezone
        except Exception:
            # Keep local calculated values if live lookup fails.
            pass

        solar_noon = int((sunrise_ts + sunset_ts) / 2) if sunrise_ts and sunset_ts else 0
        
        return {
            "sunriseTime": sunrise_ts,
            "sunsetTime": sunset_ts,
            "solarNoon": solar_noon,
            "moonPhase": data.moon_phase or 0,
            "moonIllumination": (data.moon_illumination or 0) / 100,
            "moonriseTime": int(data.moonrise.timestamp()) if data.moonrise else None,
            "moonsetTime": int(data.moonset.timestamp()) if data.moonset else None,
            "timezone": station_timezone,
            "dataSource": data_source,
        }
    except Exception as e:
        return {
            "error": str(e),
            "sunriseTime": 0,
            "sunsetTime": 0,
            "solarNoon": 0,
            "moonPhase": 0,
            "moonIllumination": 0,
        }
