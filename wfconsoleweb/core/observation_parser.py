"""Parser for WeatherFlow Tempest observations from UDP messages"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from wfconsoleweb.core.types import Observation

logger = logging.getLogger(__name__)


class ObservationParser:
    """Parse raw observation messages from Tempest device"""

    def __init__(self):
        """Initialize parser"""
        self.last_obs_timestamp = None
        self.last_rapid_wind_timestamp = None
        self.last_non_zero_rapid_wind_direction = None

    def parse_message(self, message: str) -> Optional[Dict[str, Any]]:
        """
        Parse a raw UDP message from Tempest device.

        Args:
            message: JSON string from UDP listener

        Returns:
            Dictionary with parsed data or None if parsing fails
        """
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "obs_st":
                return self._parse_observation(data)
            elif msg_type == "rapid_wind":
                return self._parse_rapid_wind(data)
            elif msg_type == "evt_strike":
                return self._parse_lightning_strike(data)
            elif msg_type == "evt_precip":
                return self._parse_precipitation(data)
            else:
                logger.debug(f"Unknown message type: {msg_type}")
                return None

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON message: {e}")
            return None
        except Exception as e:
            logger.error(f"Error parsing message: {e}")
            return None

    def _parse_observation(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse complete observation dataset"""
        try:
            obs = data.get("obs", [[]])
            if not obs or not obs[0]:
                return None

            # obs[0] contains the observation array
            obs_data = obs[0]

            timestamp = obs_data[0]
            self.last_obs_timestamp = timestamp

            result = {
                "type": "observation",
                "packet_type": "obs_st",
                "timestamp": datetime.fromtimestamp(timestamp, tz=timezone.utc),
                "air_temperature": obs_data[7],  # in Celsius
                "relative_humidity": obs_data[8],
                "sea_level_pressure": obs_data[6],
                "wind_speed": obs_data[2],  # Average wind speed (m/s)
                "wind_gust": obs_data[3],  # Gust wind speed (m/s)
                "wind_direction": obs_data[4],  # Wind direction (degrees)
                "rainfall_rate": obs_data[12],  # Rain accumulation over the previous minute (mm)
                "rainfall_daily": obs_data[18] if len(obs_data) > 18 else None,
                "solar_radiation": obs_data[11],  # W/m^2
                "uv_index": obs_data[10],
                # obs_st index 15 is strikes in the previous minute; use summary for 3h count.
                "lightning_strike_last_distance": (
                    (data.get("summary") or {}).get("strike_last_dist")
                    if isinstance(data.get("summary"), dict)
                    else None
                ) or (obs_data[14] if len(obs_data) > 14 else None),
                "lightning_strike_count_3h": (
                    (data.get("summary") or {}).get("strike_count_3h")
                    if isinstance(data.get("summary"), dict)
                    else None
                ) or (obs_data[15] if len(obs_data) > 15 else None),
                "battery_voltage": obs_data[16] if len(obs_data) > 16 else None,
                "station_id": data.get("station_id"),
                "device_id": data.get("device_id") or data.get("serial_number"),
            }

            return result

        except (IndexError, KeyError, TypeError) as e:
            logger.error(f"Error parsing observation: {e}")
            return None

    def _parse_rapid_wind(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse rapid wind update (3-second intervals)"""
        try:
            timestamp = data.get("ob")[0]
            self.last_rapid_wind_timestamp = timestamp

            wind_speed = data.get("ob")[1]
            wind_direction = data.get("ob")[2]

            if wind_speed == 0 and self.last_non_zero_rapid_wind_direction is not None:
                wind_direction = self.last_non_zero_rapid_wind_direction
            elif wind_speed not in (None, 0):
                self.last_non_zero_rapid_wind_direction = wind_direction

            result = {
                "type": "rapid_wind",
                "packet_type": "rapid_wind",
                "timestamp": datetime.fromtimestamp(timestamp, tz=timezone.utc),
                "wind_speed": wind_speed,  # m/s
                "wind_direction": wind_direction,  # degrees
                "device_id": data.get("device_id") or data.get("serial_number"),
                "station_id": data.get("station_id"),
            }

            return result

        except (IndexError, KeyError, TypeError) as e:
            logger.error(f"Error parsing rapid wind: {e}")
            return None

    def _parse_lightning_strike(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse lightning strike event"""
        try:
            event = data.get("evt") or []
            timestamp = event[0] if len(event) > 0 else data.get("ts")
            distance = event[1] if len(event) > 1 else data.get("distance")

            result = {
                "type": "lightning_strike",
                "packet_type": "evt_strike",
                "timestamp": datetime.fromtimestamp(timestamp, tz=timezone.utc),
                "strike_distance": distance,  # km
                "device_id": data.get("device_id") or data.get("serial_number"),
                "station_id": data.get("station_id"),
            }

            return result

        except (KeyError, TypeError) as e:
            logger.error(f"Error parsing lightning strike: {e}")
            return None

    def _parse_precipitation(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse precipitation event"""
        try:
            result = {
                "type": "precipitation",
                "packet_type": "evt_precip",
                "timestamp": datetime.fromtimestamp(data.get("ts"), tz=timezone.utc),
                "device_id": data.get("device_id") or data.get("serial_number"),
                "station_id": data.get("station_id"),
            }

            return result

        except (KeyError, TypeError) as e:
            logger.error(f"Error parsing precipitation event: {e}")
            return None

    @staticmethod
    def message_to_observation(message_dict: Dict[str, Any]) -> Optional[Observation]:
        """Convert parsed message to Observation dataclass"""
        if message_dict is None:
            return None

        obs_type = message_dict.get("type")

        if obs_type in {"observation", "rapid_wind", "lightning_strike", "precipitation"}:
            return Observation(
                timestamp=message_dict.get("timestamp"),
                packet_type=message_dict.get("packet_type") or obs_type,
                air_temperature=message_dict.get("air_temperature"),
                relative_humidity=message_dict.get("relative_humidity"),
                sea_level_pressure=message_dict.get("sea_level_pressure"),
                wind_speed=message_dict.get("wind_speed"),
                wind_gust=message_dict.get("wind_gust"),
                wind_direction=message_dict.get("wind_direction"),
                rainfall_accumulated_last_1h=message_dict.get("rainfall_accumulated_last_1h"),
                rainfall_rate=message_dict.get("rainfall_rate"),
                rainfall_daily=message_dict.get("rainfall_daily"),
                solar_radiation=message_dict.get("solar_radiation"),
                uv_index=message_dict.get("uv_index"),
                lightning_strike_count_3h=message_dict.get("lightning_strike_count_3h"),
                lightning_strike_last_distance=message_dict.get("lightning_strike_last_distance") or message_dict.get("strike_distance"),
                battery_voltage=message_dict.get("battery_voltage"),
                rssi=message_dict.get("rssi"),
                station_id=message_dict.get("station_id"),
                device_id=message_dict.get("device_id"),
            )

        return None


# Global parser instance
_parser = None


def get_parser() -> ObservationParser:
    """Get or create global parser instance"""
    global _parser
    if _parser is None:
        _parser = ObservationParser()
    return _parser


def parse_message(message: str) -> Optional[Dict[str, Any]]:
    """Convenience function to parse a message"""
    parser = get_parser()
    return parser.parse_message(message)
