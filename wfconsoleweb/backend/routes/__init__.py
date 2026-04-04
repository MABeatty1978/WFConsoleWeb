"""API routes for FastAPI application"""

from wfconsoleweb.backend.routes.auth import router as auth_router
from wfconsoleweb.backend.routes.config import router as config_router
from wfconsoleweb.backend.routes.station import router as station_router
from wfconsoleweb.backend.routes.history import router as history_router
from wfconsoleweb.backend.routes.themes import router as themes_router
from wfconsoleweb.backend.routes.system import router as system_router
from wfconsoleweb.backend.routes.forecast import router as forecast_router

__all__ = ["auth_router", "config_router", "station_router", "history_router", "themes_router", "system_router", "forecast_router"]
