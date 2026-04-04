"""UDP listener service for Tempest observations"""
import logging
import json
import asyncio
from datetime import datetime
from typing import Optional, Callable

from wfconsoleweb.core.observation_parser import get_parser
from wfconsoleweb.core.types import Observation
from wfconsoleweb.backend.websocket import get_ws_manager


logger = logging.getLogger(__name__)


class UDPListenerService:
    """Listen for UDP broadcasts from Tempest weather station."""

    def __init__(self, port: int = 50222, host: str = "0.0.0.0"):
        """
        Initialize UDP listener.

        Args:
            port: UDP port to listen on (default Tempest: 50222)
            host: Host to bind to (0.0.0.0 for all interfaces)
        """
        self.port = port
        self.host = host
        self.is_running = False
        self.transport = None
        self.protocol = None
        self.parser = get_parser()
        self.observation_callbacks: list[Callable] = []
        self.packet_count = 0
        self.error_count = 0

    async def start(self) -> None:
        """Start UDP listener."""
        if self.is_running:
            logger.warning("UDP listener already running")
            return

        try:
            loop = asyncio.get_event_loop()
            self.transport, self.protocol = await loop.create_datagram_endpoint(
                lambda: _UDPProtocol(self),
                local_addr=(self.host, self.port),
            )
            self.is_running = True
            logger.info(f"UDP listener started on {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Failed to start UDP listener: {e}")
            raise

    async def stop(self) -> None:
        """Stop UDP listener."""
        if not self.is_running:
            logger.warning("UDP listener not running")
            return

        try:
            if self.transport:
                self.transport.close()
            self.is_running = False
            logger.info("UDP listener stopped")
        except Exception as e:
            logger.error(f"Error stopping UDP listener: {e}")

    def register_callback(self, callback: Callable) -> None:
        """
        Register callback to be called on new observation.

        Args:
            callback: Async function with signature: callback(observation: Observation)
        """
        self.observation_callbacks.append(callback)

    async def _handle_packet(self, data: bytes, addr: tuple) -> None:
        """
        Handle incoming UDP packet.

        Args:
            data: Packet data
            addr: Sender address (host, port)
        """
        try:
            self.packet_count += 1

            # Decode to string (parser will handle JSON parsing)
            message = data.decode("utf-8")

            # Parse observation from message
            parsed = self.parser.parse_message(message)
            if not parsed:
                logger.debug(f"Unsupported message type from {addr}")
                return

            # Create Observation object
            observation = Observation(
                timestamp=parsed.get("timestamp") or datetime.utcnow(),
                packet_type=parsed.get("packet_type") or parsed.get("type"),
                station_id=parsed.get("station_id"),
                device_id=parsed.get("device_id") or "unknown",
                air_temperature=parsed.get("air_temperature"),
                relative_humidity=parsed.get("relative_humidity"),
                sea_level_pressure=parsed.get("sea_level_pressure"),
                wind_speed=parsed.get("wind_speed"),
                wind_gust=parsed.get("wind_gust"),
                wind_direction=parsed.get("wind_direction"),
                rainfall_rate=parsed.get("rainfall_rate"),
                rainfall_accumulated_last_1h=parsed.get("rainfall_accumulated_last_1h"),
                rainfall_daily=parsed.get("rainfall_daily"),
                solar_radiation=parsed.get("solar_radiation"),
                uv_index=parsed.get("uv_index"),
                lightning_strike_count_3h=parsed.get("lightning_strike_count_3h"),
                lightning_strike_last_distance=parsed.get("lightning_strike_last_distance") or parsed.get("strike_distance"),
                lightning_strike_last_time=parsed.get("lightning_strike_last_time"),
                battery_voltage=parsed.get("battery_voltage"),
                rssi=parsed.get("rssi"),
            )

            # Broadcast via WebSocket
            ws_manager = get_ws_manager()
            await ws_manager.broadcast_observation(observation)

            # Trigger registered callbacks
            for callback in self.observation_callbacks:
                try:
                    await callback(observation)
                except Exception as e:
                    logger.error(f"Error in observation callback: {e}")

            logger.debug(f"Observation {self.packet_count} from {addr}: {parsed.get('device_id')}")

        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON from {addr}: {e}")
            self.error_count += 1
        except Exception as e:
            logger.error(f"Error processing packet from {addr}: {e}")
            self.error_count += 1

    def get_stats(self) -> dict:
        """Get listener statistics."""
        return {
            "is_running": self.is_running,
            "port": self.port,
            "packets_received": self.packet_count,
            "errors": self.error_count,
            "connected_clients": get_ws_manager().get_connection_count(),
        }

    async def reset_stats(self) -> None:
        """Reset statistics."""
        self.packet_count = 0
        self.error_count = 0
        logger.info("UDP listener statistics reset")


class _UDPProtocol(asyncio.DatagramProtocol):
    """Internal UDP protocol handler."""

    def __init__(self, service: UDPListenerService):
        """
        Initialize protocol.

        Args:
            service: Parent UDPListenerService instance
        """
        self.service = service
        self.transport = None

    def connection_made(self, transport):
        """Called when connection is made."""
        self.transport = transport

    def datagram_received(self, data: bytes, addr: tuple) -> None:
        """
        Called when datagram is received.

        Args:
            data: Packet data
            addr: Sender address
        """
        # Schedule async handler
        asyncio.create_task(self.service._handle_packet(data, addr))

    def error_received(self, exc: Exception) -> None:
        """Called when error is received."""
        logger.error(f"UDP error: {exc}")
        self.service.error_count += 1

    def connection_lost(self, exc: Optional[Exception]) -> None:
        """Called when connection is lost."""
        if exc:
            logger.warning(f"UDP connection lost: {exc}")


# Global singleton
_udp_service: Optional[UDPListenerService] = None


def get_udp_service(port: int = 50222) -> UDPListenerService:
    """Get or create global UDP listener service."""
    global _udp_service
    if _udp_service is None:
        _udp_service = UDPListenerService(port=port)
    return _udp_service

