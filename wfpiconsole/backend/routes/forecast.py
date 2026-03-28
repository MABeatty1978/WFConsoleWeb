"""
Forecast routes - Sager and astronomical data endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from wfpiconsole.backend.dependencies import get_db, get_current_user
from wfpiconsole.config.database import get_db
from wfpiconsole.core.astronomical import AstronomicalCalculator
from wfpiconsole.core.sager import SagerForecast

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/sager")
async def get_sager_forecast(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
        
        result = await db.execute(
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
        pressures = [obs.pressure for obs in reversed(observations) if obs.pressure]
        
        sager = SagerForecast()
        forecast_code = sager.get_forecast(pressures)
        
        latest = observations[0]
        
        return {
            "forecastCode": forecast_code,
            "forecastText": SagerForecast.get_forecast_text(forecast_code),
            "seaLevelPressureTrend": sager.get_trend_text(pressures),
            "localTime": int(latest.timestamp) if latest.timestamp else 0,
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
    db: AsyncSession = Depends(get_db),
):
    """
    Get astronomical data (sunrise, sunset, moon phases, etc.)
    """
    try:
        from wfpiconsole.config.models import StationConfig
        from sqlalchemy import select
        
        # Get station configuration for location
        result = await db.execute(select(StationConfig))
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
            elevation=station.elevation or 0,
        )
        
        data = calc.get_all_data()
        
        return {
            "sunriseTime": int(data["sunrise"]),
            "sunsetTime": int(data["sunset"]),
            "solarNoon": int(data["solar_noon"]),
            "moonPhase": data.get("moon_phase", 0),
            "moonIllumination": data.get("moon_illumination", 0),
            "moonriseTime": int(data.get("moonrise", 0)) if data.get("moonrise") else None,
            "moonsetTime": int(data.get("moonset", 0)) if data.get("moonset") else None,
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
