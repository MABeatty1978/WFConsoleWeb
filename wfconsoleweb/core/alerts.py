"""Weather alert and notification system"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Callable
from dataclasses import dataclass

from wfconsoleweb.core.types import Observation


logger = logging.getLogger(__name__)


@dataclass
class AlertRule:
    """Configuration for a weather alert rule."""

    alert_id: str
    name: str
    metric: str  # e.g., "temperature", "wind_speed", "pressure"
    operator: str  # "greater_than", "less_than", "between"
    threshold: float
    threshold_high: Optional[float] = None  # For "between" operator
    cooldown_minutes: int = 60  # Don't trigger again for N minutes
    enabled: bool = True


class AlertManager:
    """Manage and trigger weather alerts based on thresholds."""

    def __init__(self):
        """Initialize alert manager."""
        self.rules: dict[str, AlertRule] = {}
        self.triggered_alerts: dict[str, datetime] = {}
        self.callbacks: list[Callable] = []

    def register_rule(self, rule: AlertRule) -> None:
        """
        Register an alert rule.

        Args:
            rule: AlertRule instance
        """
        self.rules[rule.alert_id] = rule
        logger.info(f"Registered alert rule: {rule.name}")

    def unregister_rule(self, alert_id: str) -> None:
        """
        Unregister an alert rule.

        Args:
            alert_id: Rule identifier
        """
        if alert_id in self.rules:
            del self.rules[alert_id]
            logger.info(f"Unregistered alert rule: {alert_id}")

    def register_callback(self, callback: Callable) -> None:
        """
        Register callback to be called when alert triggers.

        Args:
            callback: Function with signature: callback(alert_id: str, message: str, observation: Observation)
        """
        self.callbacks.append(callback)

    def check_observation(self, observation: Observation) -> list[tuple[str, str]]:
        """
        Check observation against all rules.

        Args:
            observation: Weather observation

        Returns:
            List of triggered alerts as (alert_id, message) tuples
        """
        triggered = []

        for alert_id, rule in self.rules.items():
            if not rule.enabled:
                continue

            # Check cooldown
            if not self._check_cooldown(alert_id, rule):
                continue

            # Get metric value from observation
            value = self._get_metric_value(observation, rule.metric)
            if value is None:
                continue

            # Check threshold
            if self._check_threshold(value, rule):
                message = self._generate_alert_message(rule, value)
                triggered.append((alert_id, message))

                # Trigger callbacks
                for callback in self.callbacks:
                    try:
                        callback(alert_id, message, observation)
                    except Exception as e:
                        logger.error(f"Error in alert callback: {e}")

                # Mark as triggered
                self.triggered_alerts[alert_id] = datetime.utcnow()

        return triggered

    def _check_cooldown(self, alert_id: str, rule: AlertRule) -> bool:
        """Check if alert is on cooldown."""
        if alert_id not in self.triggered_alerts:
            return True

        last_triggered = self.triggered_alerts[alert_id]
        cooldown_end = last_triggered + timedelta(minutes=rule.cooldown_minutes)
        return datetime.utcnow() > cooldown_end

    @staticmethod
    def _get_metric_value(observation: Observation, metric: str) -> Optional[float]:
        """Extract metric value from observation."""
        metric_map = {
            "temperature": observation.air_temperature,
            "humidity": observation.relative_humidity,
            "pressure": observation.sea_level_pressure,
            "wind_speed": observation.wind_speed,
            "wind_gust": observation.wind_gust,
            "uv_index": observation.uv_index,
            "solar_radiation": observation.solar_radiation,
            "rainfall": observation.rainfall_rate,
            "lightning_distance": observation.lightning_strike_last_distance,
            "battery": observation.battery_voltage,
        }
        return metric_map.get(metric)

    @staticmethod
    def _check_threshold(value: float, rule: AlertRule) -> bool:
        """Check if value exceeds threshold."""
        if rule.operator == "greater_than":
            return value > rule.threshold
        elif rule.operator == "less_than":
            return value < rule.threshold
        elif rule.operator == "between":
            return rule.threshold <= value <= (rule.threshold_high or rule.threshold)
        return False

    @staticmethod
    def _generate_alert_message(rule: AlertRule, value: float) -> str:
        """Generate human-readable alert message."""
        if rule.operator == "greater_than":
            return f"{rule.name}: {value:.1f} exceeds threshold of {rule.threshold:.1f}"
        elif rule.operator == "less_than":
            return f"{rule.name}: {value:.1f} below threshold of {rule.threshold:.1f}"
        elif rule.operator == "between":
            return f"{rule.name}: {value:.1f} outside range {rule.threshold:.1f}-{rule.threshold_high:.1f}"
        return f"{rule.name}: Alert triggered at {value:.1f}"

    def get_active_alerts(self) -> dict[str, dict]:
        """
        Get currently active (recently triggered) alerts.

        Returns:
            Dictionary of active alerts with their details
        """
        active = {}
        now = datetime.utcnow()

        for alert_id, triggered_at in self.triggered_alerts.items():
            if alert_id in self.rules:
                rule = self.rules[alert_id]
                # Show alert for 2x cooldown period
                if (now - triggered_at).total_seconds() < rule.cooldown_minutes * 120:
                    active[alert_id] = {
                        "name": rule.name,
                        "triggered_at": triggered_at.isoformat(),
                        "cooldown_until": (triggered_at + timedelta(minutes=rule.cooldown_minutes)).isoformat(),
                    }

        return active

    def clear_alert(self, alert_id: str) -> None:
        """
        Manually clear an alert.

        Args:
            alert_id: Alert to clear
        """
        if alert_id in self.triggered_alerts:
            del self.triggered_alerts[alert_id]


class DefaultAlerts:
    """Default alert rules for common weather scenarios."""

    @staticmethod
    def get_default_rules() -> list[AlertRule]:
        """Get list of default alert rules."""
        return [
            AlertRule(
                alert_id="extreme_heat",
                name="Extreme Heat",
                metric="temperature",
                operator="greater_than",
                threshold=40.0,  # 40°C = 104°F
                cooldown_minutes=120,
            ),
            AlertRule(
                alert_id="extreme_cold",
                name="Extreme Cold",
                metric="temperature",
                operator="less_than",
                threshold=-20.0,  # -20°C = -4°F
                cooldown_minutes=120,
            ),
            AlertRule(
                alert_id="high_wind",
                name="High Wind",
                metric="wind_gust",
                operator="greater_than",
                threshold=15.5,  # ~35 mph = 56 km/h
                cooldown_minutes=60,
            ),
            AlertRule(
                alert_id="extreme_wind",
                name="Extreme Wind",
                metric="wind_gust",
                operator="greater_than",
                threshold=25.7,  # ~60 mph = 97 km/h
                cooldown_minutes=120,
            ),
            AlertRule(
                alert_id="high_uv",
                name="High UV Index",
                metric="uv_index",
                operator="greater_than",
                threshold=10.0,
                cooldown_minutes=60,
            ),
            AlertRule(
                alert_id="lightning_close",
                name="Lightning Nearby",
                metric="lightning_distance",
                operator="less_than",
                threshold=5.0,  # Within 5 km
                cooldown_minutes=30,
            ),
            AlertRule(
                alert_id="heavy_rain",
                name="Heavy Rainfall",
                metric="rainfall",
                operator="greater_than",
                threshold=50.0,  # 50 mm in observation period
                cooldown_minutes=60,
            ),
            AlertRule(
                alert_id="low_battery",
                name="Low Battery",
                metric="battery",
                operator="less_than",
                threshold=2.4,  # 2.4V typically low for Tempest
                cooldown_minutes=180,
            ),
        ]


# Global singleton
_alert_manager: Optional[AlertManager] = None


def get_alert_manager() -> AlertManager:
    """Get or create global alert manager."""
    global _alert_manager
    if _alert_manager is None:
        _alert_manager = AlertManager()
        # Register default rules
        for rule in DefaultAlerts.get_default_rules():
            _alert_manager.register_rule(rule)
    return _alert_manager
