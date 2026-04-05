"""Station observations and data endpoints"""
import logging
import os
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfconsoleweb.config.models import ObservationHistory, StationConfig, APIKey
from wfconsoleweb.backend.dependencies import (
    get_db,
    get_station_config,
)
from wfconsoleweb.core.api_clients import WeatherFlowAPI


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/station", tags=["Station"])

# Global storage for latest observation (in production, use database or cache)
_latest_observation: Optional[dict] = None


def _get_latest_complete_observation(db: Session) -> Optional[ObservationHistory]:
    """Return the newest observation row with complete sensor data."""
    return (
        db.query(ObservationHistory)
        .filter(
            or_(
                ObservationHistory.air_temperature.isnot(None),
                ObservationHistory.relative_humidity.isnot(None),
                ObservationHistory.sea_level_pressure.isnot(None),
            )
        )
        .order_by(ObservationHistory.timestamp.desc())
        .first()
    )


def _get_latest_wind_observation(db: Session) -> Optional[ObservationHistory]:
    """Return the newest row that contains wind data, including rapid wind packets."""
    return (
        db.query(ObservationHistory)
        .filter(ObservationHistory.wind_speed.isnot(None))
        .order_by(ObservationHistory.timestamp.desc())
        .first()
    )


def _get_latest_snapshot(db: Session) -> Optional[tuple[ObservationHistory, Optional[ObservationHistory]]]:
    """Return the latest full observation with the most recent wind update layered on top."""
    latest_complete = _get_latest_complete_observation(db)
    if not latest_complete:
        return None

    latest_wind = _get_latest_wind_observation(db)
    if latest_wind and latest_wind.timestamp and latest_complete.timestamp:
        if latest_wind.timestamp < latest_complete.timestamp:
            latest_wind = None

    return latest_complete, latest_wind


def _get_merged_wind_values(
    latest_complete: ObservationHistory,
    latest_wind: Optional[ObservationHistory],
) -> tuple[Optional[float], Optional[float], Optional[int], datetime]:
    """Merge the latest complete observation with any newer wind-only update."""
    wind_speed = latest_wind.wind_speed if latest_wind and latest_wind.wind_speed is not None else latest_complete.wind_speed
    wind_gust = latest_wind.wind_gust if latest_wind and latest_wind.wind_gust is not None else latest_complete.wind_gust
    wind_direction = latest_wind.wind_direction if latest_wind and latest_wind.wind_direction is not None else latest_complete.wind_direction
    effective_timestamp = latest_wind.timestamp if latest_wind and latest_wind.timestamp else latest_complete.timestamp

    if wind_speed is not None:
        wind_gust = max(wind_speed, wind_gust or wind_speed)

    return wind_speed, wind_gust, wind_direction, effective_timestamp


def _get_weatherflow_token(db: Session) -> Optional[str]:
    """Resolve WeatherFlow API token from configured API keys or env vars."""
    key = (
        db.query(APIKey)
        .filter(APIKey.service_name.in_(["weatherflow", "tempest"]))
        .first()
    )
    if key and getattr(key, "key_encrypted", None):
        try:
            return key.get_key()
        except Exception:
            logger.warning("WeatherFlow API key is present but could not be decrypted")

    return os.getenv("WEATHERFLOW_API_TOKEN") or os.getenv("WEATHERFLOW_TOKEN")


async def _get_weatherflow_lightning_metrics(db: Session, now: datetime) -> Optional[dict]:
    """Fetch PiConsole-style lightning/rain totals from WeatherFlow historical APIs."""
    def _to_unix_seconds(dt: datetime) -> int:
        # Project code mostly uses naive UTC datetimes; interpret naive values as UTC
        # when converting to epoch so time windows are not shifted by local timezone.
        if dt.tzinfo is None:
            return int(dt.replace(tzinfo=timezone.utc).timestamp())
        return int(dt.timestamp())

    station = db.query(StationConfig).first()
    token = _get_weatherflow_token(db)
    if not station or not token or not station.tempest_device_id:
        return None

    client = WeatherFlowAPI(token)
    try:
        obs_data = await client.get_device_observations(
            device_id=str(station.tempest_device_id),
            bucket="a",
            time_start=_to_unix_seconds(now - timedelta(hours=24)),
            time_end=_to_unix_seconds(now),
        )
        stats_data = None
        if station.station_id:
            stats_data = await client.get_station_statistics(str(station.station_id))
    finally:
        await client.close()

    observations = obs_data.get("obs") if isinstance(obs_data, dict) else None
    strikes_3h = None
    strike_freq_10m = None
    strike_last_distance_km = None
    if isinstance(observations, list):
        three_hours_ago_ts = _to_unix_seconds(now - timedelta(hours=3))
        ten_minutes_ago_ts = _to_unix_seconds(now - timedelta(minutes=10))

        strike_samples_3h = [
            int(item[15])
            for item in observations
            if isinstance(item, list)
            and len(item) > 15
            and item[15] is not None
            and item[0] >= three_hours_ago_ts
        ]
        strike_samples_10m = [
            int(item[15])
            for item in observations
            if isinstance(item, list)
            and len(item) > 15
            and item[15] is not None
            and item[0] >= ten_minutes_ago_ts
        ]

        # obs index 14 is average strike distance (km); keep the most recent non-zero.
        for item in reversed(observations):
            if not isinstance(item, list) or len(item) <= 14:
                continue
            if item[14] is None:
                continue
            try:
                candidate = float(item[14])
                if candidate <= 0:
                    continue
                strike_last_distance_km = candidate
                break
            except (TypeError, ValueError):
                continue

        strikes_3h = sum(strike_samples_3h)
        strike_freq_10m = round(sum(strike_samples_10m) / 10.0, 2)

    stats_day = stats_data.get("stats_day") if isinstance(stats_data, dict) else None
    stats_month = stats_data.get("stats_month") if isinstance(stats_data, dict) else None
    stats_year = stats_data.get("stats_year") if isinstance(stats_data, dict) else None

    def _extract_stat_count(rows: Optional[list]) -> Optional[int]:
        if not isinstance(rows, list) or not rows:
            return None
        latest_row = rows[-1]
        if not isinstance(latest_row, list) or len(latest_row) <= 24:
            return None
        try:
            return int(latest_row[24])
        except (TypeError, ValueError):
            return None

    def _extract_stat_value(rows: Optional[list], index: int, row_offset: int = -1) -> Optional[float]:
        if not isinstance(rows, list) or not rows:
            return None
        if abs(row_offset) > len(rows):
            return None
        row = rows[row_offset]
        if not isinstance(row, list) or len(row) <= index:
            return None
        value = row[index]
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    return {
        "strikes_3h": strikes_3h,
        "strikes_today": _extract_stat_count(stats_day),
        "strikes_month": _extract_stat_count(stats_month),
        "strikes_year": _extract_stat_count(stats_year),
        "strike_freq_10m": strike_freq_10m,
        "strike_last_distance_km": strike_last_distance_km,
        # Rain totals from WeatherFlow station stats (same column PiConsole uses).
        "rain_today_mm": _extract_stat_value(stats_day, 28, -1),
        "rain_yesterday_mm": _extract_stat_value(stats_day, 28, -2),
        "rain_month_mm": _extract_stat_value(stats_month, 28, -1),
        "rain_year_mm": _extract_stat_value(stats_year, 28, -1),
    }


# Pydantic models
class ObservationResponse(BaseModel):
    """Current observation data."""

    timestamp: str
    device_id: Optional[str]
    temp_c: Optional[float]
    humidity: Optional[float]
    pressure_mb: Optional[float]
    wind_speed_mps: Optional[float]
    wind_gust_mps: Optional[float]
    wind_direction_deg: Optional[int]
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
    pressure_trend: Optional[str]
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


@router.get("/info", response_model=Optional[StationInfoResponse])
async def get_station_info(station: Optional[StationConfig] = Depends(get_station_config)):
    """Get station configuration and metadata if available."""
    if not station:
        return None

    return StationInfoResponse(
        station_id=station.station_id,
        name=station.station_name,
        latitude=station.latitude,
        longitude=station.longitude,
        elevation_m=station.elevation,
        device_id=station.tempest_device_id,
        hub_sn=None,
        connection_type=station.connection_type,
    )


@router.get("/latest-observation", response_model=Optional[ObservationResponse])
@router.get("/observations", response_model=Optional[ObservationResponse])
async def get_latest_observation(db: Session = Depends(get_db)):
    """Get the latest observation from database."""
    snapshot = _get_latest_snapshot(db)

    if not snapshot:
        return None

    latest, latest_wind = snapshot

    wind_speed, wind_gust, wind_direction, effective_timestamp = _get_merged_wind_values(latest, latest_wind)

    return ObservationResponse(
        timestamp=effective_timestamp.isoformat(),
        device_id=latest.device_id or (latest_wind.device_id if latest_wind else None),
        temp_c=latest.air_temperature,
        humidity=latest.relative_humidity,
        pressure_mb=latest.sea_level_pressure,
        wind_speed_mps=wind_speed,
        wind_gust_mps=wind_gust,
        wind_direction_deg=wind_direction,
        rainfall_mm=latest.rainfall_rate,
        solar_radiation_wm2=latest.solar_radiation,
        uv_index=latest.uv_index,
        lightning_strike_count=latest.lightning_strike_count,
        lightning_strike_last_distance_km=latest.lightning_avg_distance,
        battery_voltage=latest.battery_voltage,
        signal_strength=latest.rssi,
    )


@router.get("/current-conditions", response_model=Optional[CurrentConditionsResponse])
async def get_current_conditions(db: Session = Depends(get_db)):
    """Get current conditions with unit conversions and calculated values."""
    from wfconsoleweb.core.calculations import (
        calculate_feels_like_temperature,
        convert_temperature,
        get_beaufort_scale,
        calculate_uv_risk_level,
    )

    snapshot = _get_latest_snapshot(db)

    if not snapshot:
        return None

    latest, latest_wind = snapshot
    wind_mps, wind_gust_mps, wind_dir_value, effective_timestamp = _get_merged_wind_values(latest, latest_wind)

    # Temperature conversions
    temp_c = latest.air_temperature
    temp_f = convert_temperature(temp_c, "C", "F") if temp_c is not None else None

    # Feels like calculation
    feels_like_c = (
        calculate_feels_like_temperature(temp_c, wind_mps, latest.relative_humidity)
        if temp_c is not None
        else None
    )
    # This dashboard treats "feels like" as wind chill style and should not be
    # warmer than measured air temperature.
    if temp_c is not None and feels_like_c is not None and feels_like_c > temp_c:
        feels_like_c = temp_c
    feels_like_f = convert_temperature(feels_like_c, "C", "F") if feels_like_c is not None else None

    # Wind conversions
    wind_mph = wind_mps * 2.23694 if wind_mps is not None else None
    wind_gust_mph = wind_gust_mps * 2.23694 if wind_gust_mps is not None else None

    # Rainfall conversions
    rain_mm = latest.rainfall_rate
    rain_in = rain_mm / 25.4 if rain_mm is not None else None

    # Pressure trend over ~3 hours (fallback to stable when insufficient data).
    pressure_trend: Optional[str] = None
    if latest.sea_level_pressure is not None and effective_timestamp is not None:
        window_start = effective_timestamp - timedelta(hours=3)
        baseline_obs = (
            db.query(ObservationHistory)
            .filter(
                ObservationHistory.timestamp >= window_start,
                ObservationHistory.timestamp <= effective_timestamp,
                ObservationHistory.sea_level_pressure.isnot(None),
            )
            .order_by(ObservationHistory.timestamp.asc())
            .first()
        )

        if baseline_obs and baseline_obs.sea_level_pressure is not None:
            delta = latest.sea_level_pressure - baseline_obs.sea_level_pressure
            if abs(delta) < 0.6:
                pressure_trend = "steady"
            elif delta > 0:
                pressure_trend = "rising"
            else:
                pressure_trend = "falling"

    # Wind direction (cardinal)
    wind_dir = wind_dir_value if wind_dir_value is not None else 0
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
        humidity=latest.relative_humidity,
        pressure_mb=latest.sea_level_pressure,
        pressure_trend=pressure_trend,
        wind_speed_mps=wind_mps,
        wind_speed_mph=wind_mph,
        wind_gust_mps=wind_gust_mps,
        wind_gust_mph=wind_gust_mph,
        wind_direction_deg=wind_dir,
        wind_direction_cardinal=cardinal,
        rainfall_mm=rain_mm,
        rainfall_in=rain_in,
        solar_radiation_wm2=latest.solar_radiation,
        uv_index=latest.uv_index,
        uv_risk_level=uv_risk,
        lightning_distance_km=latest.lightning_avg_distance,
        battery_status=battery_status,
        signal_strength=latest.rssi,
        observation_timestamp=effective_timestamp.isoformat(),
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
            air_temperature=observation.get("air_temperature"),
            relative_humidity=observation.get("relative_humidity"),
            sea_level_pressure=observation.get("sea_level_pressure"),
            wind_speed=observation.get("wind_speed"),
            wind_gust=observation.get("wind_gust"),
            wind_direction=observation.get("wind_direction"),
            rainfall_rate=observation.get("rainfall_rate"),
            rainfall_daily=observation.get("rainfall_daily", observation.get("rainfall_accumulated_last_1h")),
            solar_radiation=observation.get("solar_radiation"),
            uv_index=observation.get("uv_index"),
            lightning_strike_count=observation.get("lightning_strike_count_3h", observation.get("lightning_strike_count", 0)),
            lightning_avg_distance=observation.get("lightning_strike_last_distance"),
            battery_voltage=observation.get("battery_voltage"),
            rssi=observation.get("rssi"),
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
    temps = [o.air_temperature for o in observations if o.air_temperature is not None]
    humidities = [o.relative_humidity for o in observations if o.relative_humidity is not None]
    pressures = [o.sea_level_pressure for o in observations if o.sea_level_pressure is not None]
    winds = [o.wind_speed for o in observations if o.wind_speed is not None]
    gusts = [o.wind_gust for o in observations if o.wind_gust is not None]
    rainfall_total = sum(o.rainfall_daily or 0 for o in observations)

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


@router.get("/wx-summary")
async def get_wx_summary(db: Session = Depends(get_db)):
    """Get weather summary with daily/monthly/yearly statistics for dashboard panels."""
    from datetime import datetime, timedelta
    from wfconsoleweb.core.calculations import calculate_dew_point

    def _calc_period_rain_mm(observations: List[ObservationHistory]) -> float:
        """Prefer device daily accumulation when present; otherwise sum minute rain."""
        daily_values = [o.rainfall_daily for o in observations if o.rainfall_daily is not None]
        if daily_values:
            daily_peak = max(daily_values)
            if daily_peak > 0:
                return float(daily_peak)
        return float(sum(o.rainfall_rate or 0.0 for o in observations))

    def _calc_grouped_rain_mm(observations: List[ObservationHistory]) -> float:
        """Aggregate rain by day using daily peaks with minute-rain fallback."""
        by_day: dict = {}
        for obs in observations:
            if not obs.timestamp:
                continue
            day = obs.timestamp.date()
            bucket = by_day.setdefault(day, {"daily_peak": None, "rate_sum": 0.0})
            if obs.rainfall_daily is not None:
                if bucket["daily_peak"] is None:
                    bucket["daily_peak"] = obs.rainfall_daily
                else:
                    bucket["daily_peak"] = max(bucket["daily_peak"], obs.rainfall_daily)
            if obs.rainfall_rate is not None:
                bucket["rate_sum"] += obs.rainfall_rate

        return float(
            sum(
                (bucket["daily_peak"] if bucket["daily_peak"] not in (None, 0) else bucket["rate_sum"])
                for bucket in by_day.values()
            )
        )

    def _count_lightning_events(start: datetime, end: datetime) -> int:
        """Count probable strike-event rows emitted from evt_strike packets."""
        return (
            db.query(ObservationHistory)
            .filter(
                ObservationHistory.timestamp >= start,
                ObservationHistory.timestamp < end,
                ObservationHistory.lightning_avg_distance.isnot(None),
                ObservationHistory.lightning_strike_count.is_(None),
                ObservationHistory.air_temperature.is_(None),
                ObservationHistory.relative_humidity.is_(None),
                ObservationHistory.sea_level_pressure.is_(None),
                ObservationHistory.wind_speed.is_(None),
                ObservationHistory.wind_gust.is_(None),
                ObservationHistory.solar_radiation.is_(None),
                ObservationHistory.uv_index.is_(None),
                ObservationHistory.rainfall_rate.is_(None),
                ObservationHistory.rainfall_daily.is_(None),
            )
            .count()
        )

    now = datetime.utcnow()
    # Compute today_start as local calendar midnight converted to UTC so that the
    # daily high/low and rain totals align with the user's clock, not UTC midnight.
    _local_now = datetime.now().astimezone()
    _local_midnight = _local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = _local_midnight.astimezone(timezone.utc).replace(tzinfo=None)
    yesterday_start = today_start - timedelta(days=1)
    month_start = datetime(now.year, now.month, 1)
    year_start = datetime(now.year, 1, 1)

    # Today's observations
    today_obs = (
        db.query(ObservationHistory)
        .filter(ObservationHistory.timestamp >= today_start)
        .all()
    )

    # Yesterday's observations
    yesterday_obs = (
        db.query(ObservationHistory)
        .filter(
            ObservationHistory.timestamp >= yesterday_start,
            ObservationHistory.timestamp < today_start,
        )
        .all()
    )

    # Latest complete observation
    latest = _get_latest_complete_observation(db)

    # Today's temperature/wind stats.
    # Track (value, timestamp) pairs so we can return the time each extreme was reached.
    _temp_pairs_today = [
        (o.air_temperature, o.timestamp)
        for o in today_obs
        if o.air_temperature is not None
    ]
    winds_today = [o.wind_speed for o in today_obs if o.wind_speed is not None]
    gusts_today = [o.wind_gust for o in today_obs if o.wind_gust is not None]

    temp_max_c = temp_min_c = None
    temp_max_ts = temp_min_ts = None
    if _temp_pairs_today:
        _max_pair = max(_temp_pairs_today, key=lambda x: x[0])
        _min_pair = min(_temp_pairs_today, key=lambda x: x[0])
        temp_max_c = round(_max_pair[0], 1)
        temp_min_c = round(_min_pair[0], 1)
        temp_max_ts = _max_pair[1]
        temp_min_ts = _min_pair[1]

    def _dt_to_unix(dt) -> Optional[float]:
        """Convert a naive-UTC or tz-aware datetime to a Unix epoch float."""
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()

    # Robust wind aggregations:
    # - Some feeds provide speed but no gust on rapid packets.
    # - Some stations can briefly miss obs_st packets.
    # Use available wind fields and fall back to latest known values.
    avg_samples = winds_today if winds_today else [o.wind_gust for o in today_obs if o.wind_gust is not None]
    max_gust_samples = [
        (o.wind_gust if o.wind_gust is not None else o.wind_speed)
        for o in today_obs
        if o.wind_gust is not None or o.wind_speed is not None
    ]

    avg_wind_mps = (
        round(sum(avg_samples) / len(avg_samples), 2)
        if avg_samples
        else (
            round(latest.wind_speed, 2)
            if latest and latest.wind_speed is not None
            else (round(latest.wind_gust, 2) if latest and latest.wind_gust is not None else None)
        )
    )

    max_gust_mps = (
        round(max(max_gust_samples), 2)
        if max_gust_samples
        else (
            round(latest.wind_gust, 2)
            if latest and latest.wind_gust is not None
            else (round(latest.wind_speed, 2) if latest and latest.wind_speed is not None else None)
        )
    )

    # Today's rainfall
    rain_today = _calc_period_rain_mm(today_obs)

    # Yesterday's rainfall
    rain_yesterday = _calc_period_rain_mm(yesterday_obs)

    # Monthly rainfall - sum the peak rain_daily per distinct UTC day
    month_obs = (
        db.query(ObservationHistory)
        .filter(ObservationHistory.timestamp >= month_start)
        .all()
    )
    rain_month = _calc_grouped_rain_mm(month_obs)

    # Yearly rainfall
    year_obs = (
        db.query(ObservationHistory)
        .filter(ObservationHistory.timestamp >= year_start)
        .all()
    )
    rain_year = _calc_grouped_rain_mm(year_obs)

    # Lightning summary counts
    strikes_today = _count_lightning_events(today_start, now)
    strikes_month = _count_lightning_events(month_start, now)
    strikes_year = _count_lightning_events(year_start, now)
    strikes_10m = _count_lightning_events(now - timedelta(minutes=10), now)
    wf_metrics = await _get_weatherflow_lightning_metrics(db, now)
    latest_lightning_distance_obs = (
        db.query(ObservationHistory)
        .filter(
            ObservationHistory.lightning_avg_distance.isnot(None),
            ObservationHistory.lightning_avg_distance > 0,
        )
        .order_by(ObservationHistory.timestamp.desc())
        .first()
    )
    latest_lightning_distance_km = (
        float(latest_lightning_distance_obs.lightning_avg_distance)
        if latest_lightning_distance_obs
        and latest_lightning_distance_obs.lightning_avg_distance is not None
        else None
    )

    rain_today_final = (
        wf_metrics.get("rain_today_mm")
        if wf_metrics and wf_metrics.get("rain_today_mm") is not None
        else rain_today
    )
    rain_yesterday_final = (
        wf_metrics.get("rain_yesterday_mm")
        if wf_metrics and wf_metrics.get("rain_yesterday_mm") is not None
        else rain_yesterday
    )
    rain_month_final = (
        wf_metrics.get("rain_month_mm")
        if wf_metrics and wf_metrics.get("rain_month_mm") is not None
        else rain_month
    )
    rain_year_final = (
        wf_metrics.get("rain_year_mm")
        if wf_metrics and wf_metrics.get("rain_year_mm") is not None
        else rain_year
    )

    # Dew point
    dew_point_c = None
    if latest and latest.air_temperature is not None and latest.relative_humidity is not None:
        try:
            dew_point_c = calculate_dew_point(latest.air_temperature, latest.relative_humidity)
        except Exception:
            pass

    # 3-hour temperature trend: use nearest prior non-null temperature sample.
    three_hours_ago = now - timedelta(hours=3)
    old_obs = (
        db.query(ObservationHistory)
        .filter(
            ObservationHistory.timestamp <= three_hours_ago,
            ObservationHistory.air_temperature.isnot(None),
        )
        .order_by(ObservationHistory.timestamp.desc())
        .first()
    )
    if old_obs is None:
        old_obs = (
            db.query(ObservationHistory)
            .filter(
                ObservationHistory.timestamp >= three_hours_ago,
                ObservationHistory.air_temperature.isnot(None),
            )
            .order_by(ObservationHistory.timestamp.asc())
            .first()
        )
    temp_trend_c = None
    if (
        old_obs
        and latest
        and latest.air_temperature is not None
        and old_obs.air_temperature is not None
    ):
        temp_trend_c = round(latest.air_temperature - old_obs.air_temperature, 1)
    elif latest and latest.air_temperature is not None:
        temp_trend_c = 0.0

    # 24-hour temperature difference: nearest prior non-null temperature sample.
    twenty_four_hours_ago = now - timedelta(hours=24)
    day_old_obs = (
        db.query(ObservationHistory)
        .filter(
            ObservationHistory.timestamp <= twenty_four_hours_ago,
            ObservationHistory.air_temperature.isnot(None),
        )
        .order_by(ObservationHistory.timestamp.desc())
        .first()
    )
    if day_old_obs is None:
        day_old_obs = (
            db.query(ObservationHistory)
            .filter(
                ObservationHistory.timestamp >= twenty_four_hours_ago,
                ObservationHistory.air_temperature.isnot(None),
            )
            .order_by(ObservationHistory.timestamp.asc())
            .first()
        )
    temp_diff_24h_c = None
    if (
        day_old_obs
        and latest
        and latest.air_temperature is not None
        and day_old_obs.air_temperature is not None
    ):
        temp_diff_24h_c = round(latest.air_temperature - day_old_obs.air_temperature, 1)
    elif latest and latest.air_temperature is not None:
        temp_diff_24h_c = 0.0

    return {
        "today": {
            "temp_min_c": temp_min_c,
            "temp_max_c": temp_max_c,
            "temp_min_time": _dt_to_unix(temp_min_ts),
            "temp_max_time": _dt_to_unix(temp_max_ts),
            "rain_mm": round(rain_today_final, 2),
            "avg_wind_mps": avg_wind_mps,
            "max_gust_mps": max_gust_mps,
        },
        "yesterday": {
            "rain_mm": round(rain_yesterday_final, 2),
        },
        "month": {
            "rain_mm": round(rain_month_final, 2),
        },
        "year": {
            "rain_mm": round(rain_year_final, 2),
        },
        "current": {
            "dew_point_c": dew_point_c,
            # Tempest obs_st rainfall_rate is accumulation over the previous minute.
            "rain_rate_mm_per_hour": ((latest.rainfall_rate or 0.0) * 60.0) if latest and latest.rainfall_rate is not None else None,
            "temp_diff_24h_c": temp_diff_24h_c,
            "temp_trend_c": temp_trend_c,
            "lightning_strikes_3h": (
                wf_metrics.get("strikes_3h")
                if wf_metrics and wf_metrics.get("strikes_3h") is not None
                else (latest.lightning_strike_count if latest else None)
            ),
            "lightning_strikes_today": (
                wf_metrics.get("strikes_today")
                if wf_metrics and wf_metrics.get("strikes_today") is not None
                else strikes_today
            ),
            "lightning_strikes_month": (
                wf_metrics.get("strikes_month")
                if wf_metrics and wf_metrics.get("strikes_month") is not None
                else strikes_month
            ),
            "lightning_strikes_year": (
                wf_metrics.get("strikes_year")
                if wf_metrics and wf_metrics.get("strikes_year") is not None
                else strikes_year
            ),
            "lightning_frequency_10min": (
                wf_metrics.get("strike_freq_10m")
                if wf_metrics and wf_metrics.get("strike_freq_10m") is not None
                else round(strikes_10m / 10.0, 2)
            ),
            "lightning_last_distance_km": (
                wf_metrics.get("strike_last_distance_km")
                if wf_metrics and wf_metrics.get("strike_last_distance_km") is not None
                else latest_lightning_distance_km
            ),
        },
        "station_health": {
            "battery_voltage": latest.battery_voltage if latest else None,
            "rssi": latest.rssi if latest else None,
            "last_observation_ts": _dt_to_unix(latest.timestamp) if latest else None,
        },
    }
