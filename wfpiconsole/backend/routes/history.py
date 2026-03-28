"""Historical data and analytics endpoints"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfpiconsole.config.models import ObservationHistory
from wfpiconsole.core.data_archival import DataArchivalManager
from wfpiconsole.backend.dependencies import get_db


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/history", tags=["History"])


# Pydantic models
class DataPoint(BaseModel):
    """Single data point in time series."""

    timestamp: str
    value: Optional[float]


class TimeSeriesData(BaseModel):
    """Time series data with metadata."""

    metric: str
    unit: str
    data_points: List[DataPoint]
    data_granularity: str
    min_value: Optional[float]
    max_value: Optional[float]
    avg_value: Optional[float]


class ExportRequest(BaseModel):
    """Request to export data."""

    start_time: datetime
    end_time: datetime
    format: str = "json"  # or "csv"


class DataExportResponse(BaseModel):
    """Response for data export."""

    status: str
    message: str
    file_path: Optional[str] = None
    record_count: int


# History endpoints


@router.get("/data/temperature")
async def get_temperature_history(
    hours: int = Query(24, ge=1, le=365 * 24),
    granularity: str = Query("1min", enum=["1min", "5min", "hourly", "daily"]),
    db: Session = Depends(get_db),
) -> TimeSeriesData:
    """
    Get historical temperature data.

    Args:
        hours: Number of hours to retrieve (1-8760)
        granularity: Data aggregation level

    Returns:
        TimeSeriesData with temperature readings
    """
    archival = DataArchivalManager(db)
    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    granularity_minutes = {"1min": 1, "5min": 5, "hourly": 60, "daily": 1440}[granularity]
    aggregated = archival.get_aggregated_data(granularity_minutes, start_time, end_time)

    data_points = []
    temperatures = []

    for timestamp in sorted(aggregated.keys()):
        bucket = aggregated[timestamp]
        temp = bucket.get("temperature", {}).get("avg")
        if temp is not None:
            data_points.append(DataPoint(timestamp=timestamp.isoformat(), value=temp))
            temperatures.append(temp)

    return TimeSeriesData(
        metric="temperature",
        unit="°C",
        data_points=data_points,
        data_granularity=granularity,
        min_value=min(temperatures) if temperatures else None,
        max_value=max(temperatures) if temperatures else None,
        avg_value=sum(temperatures) / len(temperatures) if temperatures else None,
    )


@router.get("/data/humidity")
async def get_humidity_history(
    hours: int = Query(24, ge=1, le=365 * 24),
    granularity: str = Query("1min", enum=["1min", "5min", "hourly", "daily"]),
    db: Session = Depends(get_db),
) -> TimeSeriesData:
    """Get historical humidity data."""
    archival = DataArchivalManager(db)
    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    granularity_minutes = {"1min": 1, "5min": 5, "hourly": 60, "daily": 1440}[granularity]
    aggregated = archival.get_aggregated_data(granularity_minutes, start_time, end_time)

    data_points = []
    humidities = []

    for timestamp in sorted(aggregated.keys()):
        bucket = aggregated[timestamp]
        humidity = bucket.get("humidity", {}).get("avg")
        if humidity is not None:
            data_points.append(DataPoint(timestamp=timestamp.isoformat(), value=humidity))
            humidities.append(humidity)

    return TimeSeriesData(
        metric="humidity",
        unit="%",
        data_points=data_points,
        data_granularity=granularity,
        min_value=min(humidities) if humidities else None,
        max_value=max(humidities) if humidities else None,
        avg_value=sum(humidities) / len(humidities) if humidities else None,
    )


@router.get("/data/pressure")
async def get_pressure_history(
    hours: int = Query(24, ge=1, le=365 * 24),
    granularity: str = Query("1min", enum=["1min", "5min", "hourly", "daily"]),
    db: Session = Depends(get_db),
) -> TimeSeriesData:
    """Get historical pressure data."""
    archival = DataArchivalManager(db)
    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    granularity_minutes = {"1min": 1, "5min": 5, "hourly": 60, "daily": 1440}[granularity]
    aggregated = archival.get_aggregated_data(granularity_minutes, start_time, end_time)

    data_points = []
    pressures = []

    for timestamp in sorted(aggregated.keys()):
        bucket = aggregated[timestamp]
        pressure = bucket.get("pressure", {}).get("avg_mb")
        if pressure is not None:
            data_points.append(DataPoint(timestamp=timestamp.isoformat(), value=pressure))
            pressures.append(pressure)

    return TimeSeriesData(
        metric="pressure",
        unit="mb",
        data_points=data_points,
        data_granularity=granularity,
        min_value=min(pressures) if pressures else None,
        max_value=max(pressures) if pressures else None,
        avg_value=sum(pressures) / len(pressures) if pressures else None,
    )


@router.get("/data/wind-speed")
async def get_wind_speed_history(
    hours: int = Query(24, ge=1, le=365 * 24),
    granularity: str = Query("1min", enum=["1min", "5min", "hourly", "daily"]),
    db: Session = Depends(get_db),
) -> TimeSeriesData:
    """Get historical wind speed data."""
    archival = DataArchivalManager(db)
    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    granularity_minutes = {"1min": 1, "5min": 5, "hourly": 60, "daily": 1440}[granularity]
    aggregated = archival.get_aggregated_data(granularity_minutes, start_time, end_time)

    data_points = []
    wind_speeds = []

    for timestamp in sorted(aggregated.keys()):
        bucket = aggregated[timestamp]
        wind = bucket.get("wind", {}).get("avg_mps")
        if wind is not None:
            data_points.append(DataPoint(timestamp=timestamp.isoformat(), value=wind))
            wind_speeds.append(wind)

    return TimeSeriesData(
        metric="wind_speed",
        unit="m/s",
        data_points=data_points,
        data_granularity=granularity,
        min_value=min(wind_speeds) if wind_speeds else None,
        max_value=max(wind_speeds) if wind_speeds else None,
        avg_value=sum(wind_speeds) / len(wind_speeds) if wind_speeds else None,
    )


@router.get("/data/rainfall")
async def get_rainfall_history(
    hours: int = Query(24, ge=1, le=365 * 24),
    granularity: str = Query("1min", enum=["1min", "5min", "hourly", "daily"]),
    db: Session = Depends(get_db),
) -> TimeSeriesData:
    """Get historical rainfall data (cumulative)."""
    archival = DataArchivalManager(db)
    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    granularity_minutes = {"1min": 1, "5min": 5, "hourly": 60, "daily": 1440}[granularity]
    aggregated = archival.get_aggregated_data(granularity_minutes, start_time, end_time)

    data_points = []
    rainfalls = []

    for timestamp in sorted(aggregated.keys()):
        bucket = aggregated[timestamp]
        rainfall = bucket.get("rainfall_total_mm", 0)
        if rainfall is not None and rainfall > 0:
            data_points.append(DataPoint(timestamp=timestamp.isoformat(), value=rainfall))
            rainfalls.append(rainfall)

    total_rainfall = sum(rainfalls)

    return TimeSeriesData(
        metric="rainfall",
        unit="mm",
        data_points=data_points,
        data_granularity=granularity,
        min_value=min(rainfalls) if rainfalls else 0,
        max_value=max(rainfalls) if rainfalls else 0,
        avg_value=total_rainfall / len(rainfalls) if rainfalls else 0,
    )


@router.get("/data/solar-radiation")
async def get_solar_radiation_history(
    hours: int = Query(24, ge=1, le=365 * 24),
    granularity: str = Query("1min", enum=["1min", "5min", "hourly", "daily"]),
    db: Session = Depends(get_db),
) -> TimeSeriesData:
    """Get historical solar radiation data."""
    archival = DataArchivalManager(db)
    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    observations = archival.get_observations_in_range(start_time, end_time)
    
    data_points = []
    solar_values = []

    # Simple aggregation by hour
    current_bucket = None
    bucket_data = []

    for obs in observations:
        bucket_time = obs.timestamp.replace(minute=0, second=0, microsecond=0)
        if current_bucket != bucket_time and bucket_data:
            avg_solar = sum(o.solar_radiation_wm2 for o in bucket_data if o.solar_radiation_wm2 is not None) / len(
                [o for o in bucket_data if o.solar_radiation_wm2 is not None]
            )
            data_points.append(DataPoint(timestamp=current_bucket.isoformat(), value=avg_solar))
            solar_values.append(avg_solar)
            bucket_data = []

        current_bucket = bucket_time
        bucket_data.append(obs)

    return TimeSeriesData(
        metric="solar_radiation",
        unit="W/m²",
        data_points=data_points,
        data_granularity="hourly",
        min_value=min(solar_values) if solar_values else None,
        max_value=max(solar_values) if solar_values else None,
        avg_value=sum(solar_values) / len(solar_values) if solar_values else None,
    )


@router.get("/raw")
async def get_raw_observations(
    start_time: datetime = Query(..., description="ISO format start time"),
    end_time: datetime = Query(..., description="ISO format end time"),
    limit: int = Query(10000, le=50000),
    db: Session = Depends(get_db),
):
    """
    Get raw observations in specified time range.

    Args:
        start_time: Start of range (ISO format)
        end_time: End of range (ISO format)
        limit: Maximum number of records (max 50000)

    Returns:
        List of raw observations
    """
    archival = DataArchivalManager(db)
    observations = archival.get_observations_in_range(start_time, end_time, limit)

    return {
        "record_count": len(observations),
        "time_range": {"start": start_time.isoformat(), "end": end_time.isoformat()},
        "observations": [
            {
                "timestamp": obs.timestamp.isoformat(),
                "device_id": obs.device_id,
                "temp_c": obs.temp_c,
                "humidity": obs.humidity,
                "pressure_mb": obs.pressure_mb,
                "wind_speed_mps": obs.wind_speed_mps,
                "wind_gust_mps": obs.wind_gust_mps,
                "wind_direction_deg": obs.wind_direction_deg,
                "rainfall_mm": obs.rainfall_mm,
                "solar_radiation_wm2": obs.solar_radiation_wm2,
                "uv_index": obs.uv_index,
                "lightning_strike_count": obs.lightning_strike_count,
                "lightning_strike_last_distance_km": obs.lightning_strike_last_distance_km,
                "battery_voltage": obs.battery_voltage,
                "signal_strength": obs.signal_strength,
            }
            for obs in observations
        ],
    }


@router.post("/export")
async def export_data(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
):
    """
    Export historical data to file.

    Args:
        export_request: Export parameters

    Returns:
        Export status and file path
    """
    try:
        archival = DataArchivalManager(db)
        
        # Generate export file path
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        export_path = f"/tmp/wfconsole_export_{timestamp_str}.json"

        # Perform export
        success = archival.archive_to_file(
            export_path,
            export_request.start_time,
            export_request.end_time,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to export data",
            )

        # Get record count
        observations = archival.get_observations_in_range(
            export_request.start_time,
            export_request.end_time,
        )

        return DataExportResponse(
            status="success",
            message=f"Data exported to {export_path}",
            file_path=export_path,
            record_count=len(observations),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Export failed",
        )
