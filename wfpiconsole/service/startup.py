"""Application startup and service initialization"""
import logging
import asyncio
from typing import Optional

from wfpiconsole.service.udp_listener import get_udp_service
from wfpiconsole.config.settings import get_settings


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


# Global singleton
_service_manager: Optional[ServiceManager] = None


def get_service_manager() -> ServiceManager:
    """Get or create global service manager."""
    global _service_manager
    if _service_manager is None:
        _service_manager = ServiceManager()
    return _service_manager
