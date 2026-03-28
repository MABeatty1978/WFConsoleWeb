"""API routes for FastAPI application"""

from wfpiconsole.backend.routes.auth import router as auth_router
from wfpiconsole.backend.routes.config import router as config_router
from wfpiconsole.backend.routes.station import router as station_router
from wfpiconsole.backend.routes.history import router as history_router
from wfpiconsole.backend.routes.themes import router as themes_router
from wfpiconsole.backend.routes.system import router as system_router
from wfpiconsole.backend.routes.forecast import router as forecast_router

__all__ = ["auth_router", "config_router", "station_router", "history_router", "themes_router", "system_router", "forecast_router"]
