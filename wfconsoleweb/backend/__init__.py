"""Backend FastAPI application and API routes.

Avoid importing the full app stack at package import time so lightweight scripts,
like install-time admin bootstrap, can import backend helpers without pulling in
all runtime web dependencies eagerly.
"""

__all__ = [
    "app",
    "create_app",
    "get_auth_manager",
    "get_current_user",
    "get_optional_user",
    "get_ws_manager",
]


def __getattr__(name: str):
    if name in {"app", "create_app"}:
        from wfconsoleweb.backend.main import app, create_app

        exports = {"app": app, "create_app": create_app}
        return exports[name]

    if name in {"get_auth_manager", "get_current_user", "get_optional_user"}:
        from wfconsoleweb.backend.auth import (
            get_auth_manager,
            get_current_user,
            get_optional_user,
        )

        exports = {
            "get_auth_manager": get_auth_manager,
            "get_current_user": get_current_user,
            "get_optional_user": get_optional_user,
        }
        return exports[name]

    if name == "get_ws_manager":
        from wfconsoleweb.backend.websocket import get_ws_manager

        return get_ws_manager

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
