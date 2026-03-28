"""Application startup and service initialization"""
import logging
import asyncio
from datetime import datetime
from typing import Optional

from wfpiconsole.service.udp_listener import get_udp_service
from wfpiconsole.config.settings import get_settings
from wfpiconsole.config.database import SessionLocal
from wfpiconsole.config.models import ObservationHistory


logger = logging.getLogger(__name__)


class ServiceManager:
    """Manage application services (UDP listener, etc)."""

    def __init__(self):
        """Initialize service manager."""
        self.udp_service = None
        self.tasks: list[asyncio.Task] = []
        self.is_running = False

    async def start_services(self) -> None:
        """Start all background services."""
        if self.is_running:
            logger.warning("Services already running")
            return

        try:
            settings = get_settings()

            # Start UDP listener
            self.udp_service = get_udp_service(port=settings.udp_port)
            self.udp_service.register_callback(self._persist_observation)
            await self.udp_service.start()
            logger.info("UDP listener service started")

            # Start background tasks
            self.tasks.append(asyncio.create_task(self._heartbeat_loop()))
            self.tasks.append(asyncio.create_task(self._health_check_loop()))

            self.is_running = True
            logger.info("All services started successfully")

        except Exception as e:
            logger.error(f"Failed to start services: {e}")
            await self.stop_services()
            raise

    async def stop_services(self) -> None:
        """Stop all background services."""
        if not self.is_running:
            logger.warning("Services not running")
            return

        try:
            # Stop UDP listener
            if self.udp_service:
                await self.udp_service.stop()
                logger.info("UDP listener service stopped")

            # Cancel all tasks
            for task in self.tasks:
                task.cancel()

            # Wait for all tasks to complete
            if self.tasks:
                await asyncio.gather(*self.tasks, return_exceptions=True)

            self.is_running = False
            logger.info("All services stopped")

        except Exception as e:
            logger.error(f"Error stopping services: {e}")

    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeat to WebSocket clients."""
        from wfpiconsole.backend.websocket import get_ws_manager

        try:
            while self.is_running:
                await asyncio.sleep(30)  # Every 30 seconds

                if self.is_running:
                    ws_manager = get_ws_manager()
                    await ws_manager.send_ping()
                    logger.debug("WebSocket heartbeat sent")

        except asyncio.CancelledError:
            logger.debug("Heartbeat loop cancelled")
        except Exception as e:
            logger.error(f"Error in heartbeat loop: {e}")

    async def _health_check_loop(self) -> None:
        """Periodic health checks."""
        from wfpiconsole.config.database import SessionLocal

        try:
            while self.is_running:
                await asyncio.sleep(60)  # Every 60 seconds

                if self.is_running:
                    try:
                        db = SessionLocal()
                        db.execute("SELECT 1")
                        db.close()
                        logger.debug("Health check passed")
                    except Exception as e:
                        logger.warning(f"Health check failed: {e}")

        except asyncio.CancelledError:
            logger.debug("Health check loop cancelled")
        except Exception as e:
            logger.error(f"Error in health check loop: {e}")

    def get_status(self) -> dict:
        """Get status of all services."""
        return {
            "is_running": self.is_running,
            "udp_service": self.udp_service.get_stats() if self.udp_service else None,
            "active_tasks": len(self.tasks),
        }

    async def _persist_observation(self, observation) -> None:
        """Persist each UDP observation to the database for REST endpoints and charts."""
        db = SessionLocal()
        try:
            obs = ObservationHistory(
                timestamp=observation.timestamp or datetime.utcnow(),
                station_id=observation.station_id,
                device_id=observation.device_id,
                air_temperature=observation.air_temperature,
                feels_like_temperature=observation.feels_like_temperature,
                dew_point=observation.dew_point,
                relative_humidity=observation.relative_humidity,
                wind_speed=observation.wind_speed,
                wind_gust=observation.wind_gust,
                wind_direction=observation.wind_direction,
                sea_level_pressure=observation.sea_level_pressure,
                pressure_trend=observation.pressure_trend,
                rainfall_rate=observation.rainfall_rate,
                rainfall_daily=observation.rainfall_daily or observation.rainfall_accumulated_last_1h,
                rainfall_monthly=observation.rainfall_monthly,
                rainfall_yearly=observation.rainfall_yearly,
                lightning_strike_count=observation.lightning_strike_count_3h,
                lightning_avg_distance=observation.lightning_strike_last_distance,
                solar_radiation=observation.solar_radiation,
                uv_index=observation.uv_index,
                battery_voltage=observation.battery_voltage,
                rssi=observation.rssi,
            )
            db.add(obs)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to persist UDP observation: {exc}")
        finally:
            db.close()


# Global singleton
_service_manager: Optional[ServiceManager] = None


def get_service_manager() -> ServiceManager:
    """Get or create global service manager."""
    global _service_manager
    if _service_manager is None:
        _service_manager = ServiceManager()
    return _service_manager
