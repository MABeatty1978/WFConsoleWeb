"""Historical data archival and retention management"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from wfpiconsole.config.models import ObservationHistory, DataRetentionPolicy


logger = logging.getLogger(__name__)


class DataArchivalManager:
    """Manage historical data retention and pruning."""

    def __init__(self, db_session: Session):
        """
        Initialize archival manager.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session

    def apply_retention_policy(self, policy: DataRetentionPolicy) -> int:
        """
        Apply retention policy by pruning old observations.

        Args:
            policy: DataRetentionPolicy instance

        Returns:
            Number of records deleted
        """
        if not policy.max_age_days or policy.max_age_days <= 0:
            logger.info("No retention limit configured")
            return 0

        cutoff_date = datetime.utcnow() - timedelta(days=policy.max_age_days)

        try:
            # Delete observations older than cutoff
            query = self.db.query(ObservationHistory).filter(ObservationHistory.timestamp < cutoff_date)
            count = query.count()

            if count > 0:
                query.delete()
                self.db.commit()
                logger.info(f"Deleted {count} observations older than {cutoff_date}")

                # Update policy
                policy.last_prune_timestamp = datetime.utcnow()
                self.db.add(policy)
                self.db.commit()

            return count

        except Exception as e:
            logger.error(f"Error applying retention policy: {e}")
            self.db.rollback()
            return 0

    def get_observations_in_range(
        self, start_time: datetime, end_time: datetime, limit: int = 10000
    ) -> list[ObservationHistory]:
        """
        Retrieve observations within time range.

        Args:
            start_time: Start of time range
            end_time: End of time range
            limit: Maximum number of records to return

        Returns:
            List of ObservationHistory objects
        """
        try:
            observations = (
                self.db.query(ObservationHistory)
                .filter(and_(ObservationHistory.timestamp >= start_time, ObservationHistory.timestamp <= end_time))
                .order_by(ObservationHistory.timestamp.asc())
                .limit(limit)
                .all()
            )
            return observations
        except Exception as e:
            logger.error(f"Error retrieving observations: {e}")
            return []

    def get_aggregated_data(
        self, granularity_minutes: int, start_time: datetime, end_time: datetime
    ) -> dict[datetime, dict]:
        """
        Get aggregated observation data at specified granularity.

        Args:
            granularity_minutes: Aggregation interval (1, 5, 60, 1440)
            start_time: Start time
            end_time: End time

        Returns:
            Dictionary with timestamps as keys and aggregated data as values
        """
        # Note: For production, this would use database aggregation (GROUP BY)
        # For now, retrieve raw data and aggregate in Python

        observations = self.get_observations_in_range(start_time, end_time)
        if not observations:
            return {}

        aggregated = {}
        current_bucket = None
        bucket_data = []

        for obs in observations:
            bucket_time = self._round_to_interval(obs.timestamp, granularity_minutes)

            if current_bucket != bucket_time:
                if bucket_data and current_bucket:
                    aggregated[current_bucket] = self._aggregate_bucket(bucket_data)
                current_bucket = bucket_time
                bucket_data = []

            bucket_data.append(obs)

        # Don't forget last bucket
        if bucket_data and current_bucket:
            aggregated[current_bucket] = self._aggregate_bucket(bucket_data)

        return aggregated

    def archive_to_file(self, output_path: str, start_time: datetime, end_time: datetime) -> bool:
        """
        Export observations to JSON file for backup/sharing.

        Args:
            output_path: Path to output file
            start_time: Export start time
            end_time: Export end time

        Returns:
            True if successful
        """
        import json

        try:
            observations = self.get_observations_in_range(start_time, end_time)

            data = {
                "type": "weatherflow_observation_export",
                "version": "1.0",
                "exported_at": datetime.utcnow().isoformat(),
                "record_count": len(observations),
                "time_range": {"start": start_time.isoformat(), "end": end_time.isoformat()},
                "observations": [],
            }

            for obs in observations:
                data["observations"].append(
                    {
                        "timestamp": obs.timestamp.isoformat(),
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
                    }
                )

            with open(output_path, "w") as f:
                json.dump(data, f, indent=2)

            logger.info(f"Exported {len(observations)} observations to {output_path}")
            return True

        except Exception as e:
            logger.error(f"Error exporting observations: {e}")
            return False

    @staticmethod
    def _round_to_interval(dt: datetime, minutes: int) -> datetime:
        """Round datetime to nearest interval."""
        seconds = minutes * 60
        return dt.replace(microsecond=0) - timedelta(seconds=dt.timestamp() % seconds)

    @staticmethod
    def _aggregate_bucket(observations: list[ObservationHistory]) -> dict:
        """
        Aggregate observations in a bucket.

        Args:
            observations: List of observations

        Returns:
            Dictionary with aggregated statistics
        """
        if not observations:
            return {}

        temps = [o.temp_c for o in observations if o.temp_c is not None]
        humidities = [o.humidity for o in observations if o.humidity is not None]
        pressures = [o.pressure_mb for o in observations if o.pressure_mb is not None]
        wind_speeds = [o.wind_speed_mps for o in observations if o.wind_speed_mps is not None]
        wind_gusts = [o.wind_gust_mps for o in observations if o.wind_gust_mps is not None]

        return {
            "timestamp": observations[0].timestamp.isoformat(),
            "sample_count": len(observations),
            "temperature": {
                "avg": sum(temps) / len(temps) if temps else None,
                "min": min(temps) if temps else None,
                "max": max(temps) if temps else None,
            },
            "humidity": {
                "avg": sum(humidities) / len(humidities) if humidities else None,
                "min": min(humidities) if humidities else None,
                "max": max(humidities) if humidities else None,
            },
            "pressure": {
                "avg": sum(pressures) / len(pressures) if pressures else None,
                "min": min(pressures) if pressures else None,
                "max": max(pressures) if pressures else None,
            },
            "wind": {
                "avg_speed": sum(wind_speeds) / len(wind_speeds) if wind_speeds else None,
                "max_speed": max(wind_speeds) if wind_speeds else None,
                "max_gust": max(wind_gusts) if wind_gusts else None,
            },
            "rainfall_total_mm": sum(o.rainfall_mm for o in observations if o.rainfall_mm is not None),
        }


class DataRetentionScheduler:
    """Schedule automatic data retention policy enforcement."""

    def __init__(self, check_interval_hours: int = 24):
        """
        Initialize scheduler.

        Args:
            check_interval_hours: How often to check and apply policies
        """
        self.check_interval_hours = check_interval_hours
        self.last_check: Optional[datetime] = None

    def should_run_pruning(self) -> bool:
        """
        Check if it's time to run data pruning.

        Returns:
            True if pruning should run
        """
        if self.last_check is None:
            return True

        time_since_last = (datetime.utcnow() - self.last_check).total_seconds() / 3600
        return time_since_last >= self.check_interval_hours

    def mark_run(self) -> None:
        """Mark that pruning has been run."""
        self.last_check = datetime.utcnow()


# Global singleton
_retention_scheduler: Optional[DataRetentionScheduler] = None


def get_retention_scheduler() -> DataRetentionScheduler:
    """Get or create global retention scheduler."""
    global _retention_scheduler
    if _retention_scheduler is None:
        _retention_scheduler = DataRetentionScheduler()
    return _retention_scheduler
