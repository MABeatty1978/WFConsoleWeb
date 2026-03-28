"""Backend FastAPI application and API routes"""

from wfpiconsole.backend.main import app, create_app
from wfpiconsole.backend.auth import get_auth_manager, get_current_user, get_optional_user
from wfpiconsole.backend.websocket import get_ws_manager

__all__ = [
    "app",
    "create_app",
    "get_auth_manager",
    "get_current_user",
    "get_optional_user",
    "get_ws_manager",
]
