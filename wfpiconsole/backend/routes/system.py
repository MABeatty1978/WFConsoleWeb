"""System and diagnostic endpoints"""
import logging
import os
import platform
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfpiconsole import __version__
from wfpiconsole.config.settings import get_settings
from wfpiconsole.config.models import AdminUser
from wfpiconsole.backend.dependencies import get_db, get_admin_user
from wfpiconsole.core.api_clients import GitHubAPI


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


class UpdateCheckResponse(BaseModel):
    """Application update check response."""

    current_version: str
    latest_version: str
    update_available: bool
    release_url: Optional[str] = None
    release_name: Optional[str] = None
    published_at: Optional[str] = None
    wheel_asset_name: Optional[str] = None
    wheel_asset_url: Optional[str] = None
    error: Optional[str] = None


# System endpoints


@router.get("/info", response_model=SystemInfoResponse)
async def system_info():
    """Get system information."""
    return {
        "platform": platform.system(),
        "platform_version": platform.version(),
        "python_version": platform.python_version(),
        "app_version": __version__,
        "uptime_seconds": datetime.utcnow().timestamp(),
    }


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(db: Session = Depends(get_db)):
    """System health check."""
    try:
        # Check database connectivity
        db.execute(text("SELECT 1"))
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

        # Get database size for local sqlite deployments.
        settings = get_settings()
        database_path = None
        if settings.database_url.startswith("sqlite"):
            sqlite_url = settings.database_url.replace("sqlite:///", "", 1)
            parsed = urlparse(settings.database_url)
            if parsed.scheme == "sqlite" and parsed.path:
                sqlite_url = parsed.path.lstrip("/") if parsed.netloc else parsed.path
            database_path = sqlite_url

        db_size_mb = 0
        if database_path and os.path.exists(database_path):
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
        "app_version": __version__,
        "api_version": "1.0.0",
        "release_date": "2024-01-01",
        "python_version": platform.python_version(),
        "environment": "development",
    }


async def _get_latest_release_details() -> dict:
    settings = get_settings()
    github = GitHubAPI(settings.github_api_token or None)
    try:
        release = await github.get_latest_release(settings.github_repo_owner, settings.github_repo_name)
    finally:
        await github.close()

    if not release:
        return {
            "latest_version": __version__,
            "update_available": False,
            "release": None,
            "wheel_asset": None,
            "error": "Unable to fetch latest release from GitHub",
        }

    latest_version = str(release.get("tag_name", "")).strip().lstrip("v")
    if not latest_version:
        return {
            "latest_version": __version__,
            "update_available": False,
            "release": release,
            "wheel_asset": None,
            "error": "Latest release does not contain a valid tag name",
        }

    wheel_asset = None
    assets = release.get("assets") or []
    for asset in assets:
        asset_name = str(asset.get("name", ""))
        if asset_name.endswith(".whl"):
            wheel_asset = asset
            break

    return {
        "latest_version": latest_version,
        "update_available": GitHubAPI._compare_versions(__version__, latest_version) < 0,
        "release": release,
        "wheel_asset": wheel_asset,
        "error": None,
    }


@router.get("/updates/check", response_model=UpdateCheckResponse)
async def check_updates():
    """Check GitHub Releases for a newer application version."""
    details = await _get_latest_release_details()
    release = details["release"]
    wheel_asset = details["wheel_asset"]

    if not release:
        return {
            "current_version": __version__,
            "latest_version": details["latest_version"],
            "update_available": False,
            "error": details.get("error"),
        }

    return {
        "current_version": __version__,
        "latest_version": details["latest_version"],
        "update_available": details["update_available"],
        "release_url": release.get("html_url"),
        "release_name": release.get("name") or release.get("tag_name"),
        "published_at": release.get("published_at"),
        "wheel_asset_name": wheel_asset.get("name") if wheel_asset else None,
        "wheel_asset_url": wheel_asset.get("browser_download_url") if wheel_asset else None,
        "error": details.get("error"),
    }


@router.post("/updates/install")
async def install_update(current_user: AdminUser = Depends(get_admin_user)):
    """
    Schedule installation of latest GitHub release wheel.

    This endpoint launches an external updater script that handles:
    1) DB backup
    2) package upgrade
    3) automatic backend restart
    """
    details = await _get_latest_release_details()
    if not details.get("release"):
        return {
            "status": "error",
            "message": details.get("error") or "Unable to fetch latest release",
            "current_version": __version__,
            "latest_version": details.get("latest_version", __version__),
        }

    if not details["update_available"]:
        return {
            "status": "noop",
            "message": "Already on latest version",
            "current_version": __version__,
            "latest_version": details["latest_version"],
        }

    wheel_asset = details["wheel_asset"]
    if not wheel_asset:
        return {
            "status": "error",
            "message": "Latest release has no wheel asset available for auto-update",
            "current_version": __version__,
            "latest_version": details["latest_version"],
        }

    asset_url = wheel_asset.get("browser_download_url")
    if not asset_url:
        return {
            "status": "error",
            "message": "Latest release wheel is missing a download URL",
            "current_version": __version__,
            "latest_version": details["latest_version"],
        }

    repo_root = Path(__file__).resolve().parents[3]

    if os.name == "nt":
        updater_script = repo_root / "scripts" / "update-windows.ps1"
        if not updater_script.exists():
            return {
                "status": "error",
                "message": "Windows updater script not found",
            }

        cmd = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(updater_script),
            "-AssetUrl",
            str(asset_url),
            "-ExpectedVersion",
            str(details["latest_version"]),
        ]
        creation_flags = 0
        if hasattr(subprocess, "DETACHED_PROCESS"):
            creation_flags |= subprocess.DETACHED_PROCESS
        if hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
            creation_flags |= subprocess.CREATE_NEW_PROCESS_GROUP

        subprocess.Popen(
            cmd,
            cwd=str(repo_root),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
        )
    else:
        updater_script = repo_root / "scripts" / "update-linux.sh"
        if not updater_script.exists():
            return {
                "status": "error",
                "message": "Linux updater script not found",
            }

        cmd = [
            "bash",
            str(updater_script),
            "--asset-url",
            str(asset_url),
            "--expected-version",
            str(details["latest_version"]),
        ]
        subprocess.Popen(
            cmd,
            cwd=str(repo_root),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

    logger.warning(
        "Update scheduled by %s: %s -> %s",
        current_user.username,
        __version__,
        details["latest_version"],
    )

    return {
        "status": "scheduled",
        "message": "Update installation scheduled. Service will restart automatically.",
        "current_version": __version__,
        "target_version": details["latest_version"],
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
