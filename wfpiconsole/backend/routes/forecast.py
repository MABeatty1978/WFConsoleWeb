"""
Forecast routes - Sager and astronomical data endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from wfpiconsole.backend.auth import get_current_user
from wfpiconsole.backend.dependencies import get_db
from datetime import datetime, timezone

from wfpiconsole.core.astronomical import AstronomicalCalculator
from wfpiconsole.core.sager import SagerWeatherForecast

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


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
        
        # Calculate astronomical data
        calc = AstronomicalCalculator(
            latitude=station.latitude or 0,
            longitude=station.longitude or 0,
        )
        
        data = calc.calculate_astronomical_data(datetime.now(timezone.utc))
        
        return {
            "sunriseTime": int(data.sunrise.timestamp()) if data.sunrise else 0,
            "sunsetTime": int(data.sunset.timestamp()) if data.sunset else 0,
            "solarNoon": int(((data.sunrise.timestamp() + data.sunset.timestamp()) / 2)) if data.sunrise and data.sunset else 0,
            "moonPhase": data.moon_phase or 0,
            "moonIllumination": (data.moon_illumination or 0) / 100,
            "moonriseTime": int(data.moonrise.timestamp()) if data.moonrise else None,
            "moonsetTime": int(data.moonset.timestamp()) if data.moonset else None,
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
