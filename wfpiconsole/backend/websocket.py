"""WebSocket connection management for real-time observations"""
import logging
import json
from typing import Callable
from collections import deque

from fastapi import WebSocket, WebSocketDisconnect

from wfpiconsole.core.types import Observation


logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manage WebSocket connections and broadcast observations."""

    def __init__(self, max_buffer_size: int = 100):
        """
        Initialize WebSocket manager.

        Args:
            max_buffer_size: Maximum observations to buffer for new connections
        """
        self.active_connections: list[WebSocket] = []
        self.observation_buffer: deque = deque(maxlen=max_buffer_size)
        self.subscribers: dict[str, list[Callable]] = {}  # For non-WebSocket subscribers

    async def connect(self, websocket: WebSocket) -> None:
        """
        Accept and register new WebSocket connection.

        Args:
            websocket: WebSocket connection
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

        # Send buffered observations to new client
        await self._send_buffered_data(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        """
        Disconnect and unregister WebSocket connection.

        Args:
            websocket: WebSocket connection
        """
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast_observation(self, observation: Observation) -> None:
        """
        Broadcast observation to all connected clients.

        Args:
            observation: Weather observation to broadcast
        """
        # Convert to dict for JSON serialization
        obs_dict = self._observation_to_dict(observation)

        # Store in buffer for new connections
        self.observation_buffer.append(obs_dict)

        # Send to all connected clients
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json({"type": "observation", "data": obs_dict})
            except Exception as e:
                logger.warning(f"Error sending to WebSocket: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            await self.disconnect(connection)

        # Trigger any registered callbacks
        await self._trigger_callbacks("observation", obs_dict)

    async def send_message(self, websocket: WebSocket, message_type: str, data: dict) -> None:
        """
        Send message to specific WebSocket client.

        Args:
            websocket: WebSocket connection
            message_type: Type of message
            data: Message data
        """
        try:
            await websocket.send_json({"type": message_type, "data": data})
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            await self.disconnect(websocket)

    async def broadcast_message(self, message_type: str, data: dict) -> None:
        """
        Broadcast message to all clients.

        Args:
            message_type: Type of message
            data: Message data
        """
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json({"type": message_type, "data": data})
            except Exception as e:
                logger.warning(f"Error broadcasting: {e}")
                disconnected.append(connection)

        for connection in disconnected:
            await self.disconnect(connection)

    async def send_ping(self) -> None:
        """Send ping to all clients to keep connections alive."""
        await self.broadcast_message("ping", {"timestamp": self._get_timestamp()})

    def register_callback(self, event_type: str, callback: Callable) -> None:
        """
        Register callback for specific event type.

        Args:
            event_type: Type of event to listen for
            callback: Async function to call with (event_type, data)
        """
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)

    async def _trigger_callbacks(self, event_type: str, data: dict) -> None:
        """Trigger registered callbacks for event."""
        if event_type in self.subscribers:
            for callback in self.subscribers[event_type]:
                try:
                    await callback(event_type, data)
                except Exception as e:
                    logger.error(f"Error in callback: {e}")

    async def _send_buffered_data(self, websocket: WebSocket) -> None:
        """Send buffered observations to new connection."""
        for obs_dict in self.observation_buffer:
            try:
                await websocket.send_json({"type": "observation", "data": obs_dict})
            except Exception as e:
                logger.warning(f"Error sending buffered data: {e}")

    @staticmethod
    def _observation_to_dict(observation: Observation) -> dict:
        """Convert Observation to JSON-serializable dict."""
        return {
            "timestamp": observation.timestamp.isoformat() if observation.timestamp else None,
            "packet_type": observation.packet_type,
            "station_id": observation.station_id,
            "device_id": observation.device_id,
            "air_temperature": observation.air_temperature,
            "relative_humidity": observation.relative_humidity,
            "sea_level_pressure": observation.sea_level_pressure,
            "wind_speed": observation.wind_speed,
            "wind_gust": observation.wind_gust,
            "wind_direction": observation.wind_direction,
            "rainfall_rate": observation.rainfall_rate,
            "rainfall_daily": observation.rainfall_daily,
            "solar_radiation": observation.solar_radiation,
            "uv_index": observation.uv_index,
            "lightning_strike_count_3h": observation.lightning_strike_count_3h,
            "lightning_strike_last_distance": observation.lightning_strike_last_distance,
            "battery_voltage": observation.battery_voltage,
            "rssi": observation.rssi,
        }

    @staticmethod
    def _get_timestamp() -> str:
        """Get current ISO timestamp."""
        from datetime import datetime
        return datetime.utcnow().isoformat()

    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self.active_connections)


# Global singleton
_ws_manager: WebSocketManager = WebSocketManager()


def get_ws_manager() -> WebSocketManager:
    """Get global WebSocket manager."""
    return _ws_manager
