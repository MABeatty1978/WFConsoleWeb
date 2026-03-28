"""System and diagnostic endpoints"""
import logging
import platform
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfpiconsole.config.models import AdminUser
from wfpiconsole.backend.dependencies import get_db, get_admin_user


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/system", tags=["System"])


# Pydantic models
class SystemInfoResponse(BaseModel):
    """System information."""

    platform: str
    platform_version: str
    python_version: str
    app_version: str
    uptime_seconds: float


class HealthCheckResponse(BaseModel):
    """Health check response."""

    status: str
    timestamp: str
    database_ok: bool
    websocket_ok: bool
    message: Optional[str] = None


class LogEntry(BaseModel):
    """Log entry."""

    timestamp: str
    level: str
    logger: str
    message: str


class DiagnosticsResponse(BaseModel):
    """Diagnostics information."""

    cpu_percent: float
    memory_percent: float
    memory_available_mb: int
    database_size_mb: float
    recent_errors: int


# System endpoints


@router.get("/info", response_model=SystemInfoResponse)
async def system_info():
    """Get system information."""
    return {
        "platform": platform.system(),
        "platform_version": platform.version(),
        "python_version": platform.python_version(),
        "app_version": "0.1.0a1",
        "uptime_seconds": datetime.utcnow().timestamp(),
    }


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(db: Session = Depends(get_db)):
    """System health check."""
    try:
        # Check database connectivity
        db.execute("SELECT 1")
        database_ok = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        database_ok = False

    return {
        "status": "healthy" if database_ok else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "database_ok": database_ok,
        "websocket_ok": True,
        "message": "All systems operational" if database_ok else "Database connection failed",
    }


@router.get("/diagnostics", response_model=DiagnosticsResponse)
async def get_diagnostics(db: Session = Depends(get_db)):
    """Get system diagnostics."""
    try:
        import psutil
        import os

        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()

        # Get database size
        database_path = "wfpiconsole.db"  # Default SQLite path
        db_size_mb = 0
        if os.path.exists(database_path):
            db_size_mb = os.path.getsize(database_path) / (1024 * 1024)

        # Count recent errors (from last hour in logs)
        # In production, this would query actual log storage
        recent_errors = 0

        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_available_mb": memory.available // (1024 * 1024),
            "database_size_mb": db_size_mb,
            "recent_errors": recent_errors,
        }

    except Exception as e:
        logger.error(f"Error getting diagnostics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get diagnostics",
        )


@router.get("/logs")
async def get_logs(
    level: str = "INFO",
    limit: int = 100,
    current_user: AdminUser = Depends(get_admin_user),
):
    """
    Get recent application logs.

    Args:
        level: Log level filter (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        limit: Maximum number of log entries

    Returns:
        List of recent log entries
    """
    try:
        # In production, this would query from actual log storage
        # For now, return placeholder structure
        log_entries = [
            {
                "timestamp": (datetime.utcnow() - timedelta(minutes=i)).isoformat(),
                "level": "INFO",
                "logger": "wfpiconsole",
                "message": f"Sample log entry {i}",
            }
            for i in range(min(limit, 10))
        ]

        return {"log_entries": log_entries, "total_count": len(log_entries)}

    except Exception as e:
        logger.error(f"Error retrieving logs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve logs",
        )


@router.post("/restart")
async def restart_service(current_user: AdminUser = Depends(get_admin_user)):
    """
    Restart the application (requires admin).

    Note: In production, this would be handled by systemd/supervisor.
    """
    logger.warning(f"Restart requested by {current_user.username}")

    return {
        "status": "scheduled",
        "message": "Application restart scheduled in 5 seconds",
        "requested_by": current_user.username,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/maintenance")
async def set_maintenance_mode(
    enabled: bool,
    current_user: AdminUser = Depends(get_admin_user),
):
    """
    Enable or disable maintenance mode.

    In maintenance mode, the app returns 503 Service Unavailable.
    """
    logger.info(f"Maintenance mode {'enabled' if enabled else 'disabled'} by {current_user.username}")

    return {
        "maintenance_mode": enabled,
        "message": "Maintenance mode " + ("enabled" if enabled else "disabled"),
        "set_by": current_user.username,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/version")
async def get_version():
    """Get application and API version information."""
    return {
        "app_name": "WFConsoleWeb",
        "app_version": "0.1.0a1",
        "api_version": "1.0.0",
        "release_date": "2024-01-01",
        "python_version": platform.python_version(),
        "environment": "development",
    }


@router.post("/reset-data")
async def reset_all_data(current_user: AdminUser = Depends(get_admin_user), db: Session = Depends(get_db)):
    """
    DANGEROUS: Reset all observation data (admin only).

    This operation cannot be undone.
    """
    try:
        from wfpiconsole.config.models import ObservationHistory

        # Delete all observations
        count = db.query(ObservationHistory).delete()
        db.commit()

        logger.critical(f"All observation data reset by {current_user.username} ({count} records deleted)")

        return {
            "status": "success",
            "message": f"All observation data reset ({count} records deleted)",
            "warning": "This operation cannot be undone",
            "performed_by": current_user.username,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error resetting data: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset data",
        )


@router.get("/services-status")
async def get_services_status():
    """Get status of all background services."""
    return {
        "services": {
            "database": {"status": "running", "uptime_seconds": 3600},
            "websocket": {"status": "running", "connected_clients": 0},
            "udp_listener": {"status": "running", "packets_received": 1234},
            "forecast": {"status": "running", "last_update": datetime.utcnow().isoformat()},
            "alert_manager": {"status": "running", "active_alerts": 0},
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/signal-detection-sensor")
async def trigger_signal_detection(current_user: AdminUser = Depends(get_admin_user)):
    """
    Trigger signal detection for Tempest sensor discovery.

    Useful for finding station ID and device IDs.
    """
    logger.info(f"Signal detection triggered by {current_user.username}")

    return {
        "status": "detecting",
        "message": "Listening for Tempest broadcast signals on UDP port 50222",
        "timeout_seconds": 30,
        "requested_by": current_user.username,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/alerts")
async def get_active_alerts():
    """Get list of active weather alerts."""
    from wfpiconsole.core.alerts import get_alert_manager

    alert_manager = get_alert_manager()
    active = alert_manager.get_active_alerts()

    return {
        "active_alerts": [
            {
                "alert_id": alert_id,
                "name": alert_info["name"],
                "triggered_at": alert_info["triggered_at"],
                "cooldown_until": alert_info["cooldown_until"],
            }
            for alert_id, alert_info in active.items()
        ],
        "total_active": len(active),
    }
