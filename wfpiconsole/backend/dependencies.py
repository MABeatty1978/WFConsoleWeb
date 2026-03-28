"""FastAPI dependency injection utilities"""
import logging
from typing import Generator, Optional

from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status

from wfpiconsole.config.database import SessionLocal
from wfpiconsole.config.models import AdminUser, StationConfig
from wfpiconsole.backend.auth import get_current_user


logger = logging.getLogger(__name__)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency to get database session.

    Yields:
        SQLAlchemy session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_admin_user(
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> AdminUser:
    """
    FastAPI dependency to get authenticated admin user.

    Requires valid JWT token with 'sub' field containing username.

    Args:
        current_user: Decoded JWT token payload
        db: Database session

    Returns:
        AdminUser database object

    Raises:
        HTTPException if user not found or unauthorized
    """
    username = current_user.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_station_config(db: Session = Depends(get_db)) -> Optional[StationConfig]:
    """
    FastAPI dependency to get current station configuration.

    Returns the first (and typically only) station config.

    Args:
        db: Database session

    Returns:
        StationConfig or None if not configured
    """
    station = db.query(StationConfig).first()
    return station


async def require_station_config(station: Optional[StationConfig] = Depends(get_station_config)) -> StationConfig:
    """
    FastAPI dependency to require station configuration.

    Args:
        station: Optional station config

    Returns:
        StationConfig

    Raises:
        HTTPException if station not configured
    """
    if not station:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Station not configured. Please configure station settings first.",
        )
    return station
