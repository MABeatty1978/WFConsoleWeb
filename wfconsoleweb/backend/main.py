"""FastAPI application initialization and core endpoints"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from wfconsoleweb import __version__
from wfconsoleweb.config.settings import get_settings
from wfconsoleweb.config.database import init_db
from wfconsoleweb.backend.websocket import get_ws_manager
from wfconsoleweb.backend.auth import get_auth_manager
from wfconsoleweb.backend.routes import (
    auth_router,
    config_router,
    station_router,
    history_router,
    themes_router,
    system_router,
    forecast_router,
)
from wfconsoleweb.service import get_service_manager


logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle (startup/shutdown)."""
    # Startup
    logger.info("Starting WFConsoleWeb application")
    try:
        init_db()
        logger.info("Database initialized successfully")

        # Validate admin bootstrap status. Install/setup should provision admin credentials.
        from wfconsoleweb.config.database import SessionLocal
        from wfconsoleweb.config.models import AdminUser
        db = SessionLocal()
        try:
            admin_count = db.query(AdminUser).count()
            if admin_count == 0:
                logger.warning(
                    "No admin account exists. Run installer/setup admin provisioning before login."
                )
            elif admin_count > 1:
                logger.error(
                    "Multiple admin accounts detected (%s). Expected exactly one.",
                    admin_count,
                )
        finally:
            db.close()

        # Start background services
        service_manager = get_service_manager()
        await service_manager.start_services()
        logger.info("Background services started")

    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise

    yield

    # Shutdown
    logger.info("Shutting down WFConsoleWeb application")
    try:
        service_manager = get_service_manager()
        await service_manager.stop_services()
        logger.info("Background services stopped")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


def create_app() -> FastAPI:
    """
    Create and configure FastAPI application.

    Returns:
        Configured FastAPI application instance
    """
    settings = get_settings()

    app = FastAPI(
        title="WeatherFlow Console Web",
        description="Local weather station web service",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # GZip middleware triggers noisy closed-stream errors on this Windows/Python 3.13 setup.
    # Skip compression for local stability.

    # Include routers
    app.include_router(auth_router)
    app.include_router(config_router)
    app.include_router(station_router)
    app.include_router(history_router)
    app.include_router(themes_router)
    app.include_router(system_router)
    app.include_router(forecast_router)

    # Add request logging middleware
    @app.middleware("http")
    async def log_requests(request, call_next):
        """Log HTTP requests."""
        logger.debug(f"{request.method} {request.url.path}")
        response = await call_next(request)
        logger.debug(f"{request.method} {request.url.path} - {response.status_code}")
        return response

    # Health check endpoint
    @app.get("/health", tags=["System"])
    async def health_check():
        """Check application health status."""
        return {
            "status": "healthy",
            "version": __version__,
            "name": "WFConsoleWeb",
        }

    # System info endpoint
    @app.get("/api/system/info", tags=["System"])
    async def system_info():
        """Get system information."""
        import platform
        import psutil

        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()

        return {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "python_version": platform.python_version(),
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_available_mb": memory.available // (1024 * 1024),
            "uptime_seconds": psutil.boot_time(),
        }

    # WebSocket endpoint for real-time observations
    @app.websocket("/ws/observations")
    async def websocket_observations(websocket: WebSocket):
        """
        WebSocket endpoint for real-time weather observations.

        Clients connect and receive live updates as observations arrive.
        """
        ws_manager = get_ws_manager()
        await ws_manager.connect(websocket)

        try:
            while True:
                # Keep connection alive by receiving messages
                # (We only broadcast from observation service)
                data = await websocket.receive_text()
                logger.debug(f"Received from client: {data}")

                # Echo back to acknowledge
                await websocket.send_json({"type": "ack", "received": data})

        except WebSocketDisconnect:
            await ws_manager.disconnect(websocket)
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
            await ws_manager.disconnect(websocket)

    # API version endpoint
    @app.get("/api/version", tags=["System"])
    async def api_version():
        """Get API version information."""
        return {
            "api_version": "1.0.0",
            "app_version": __version__,
            "release_date": "2024-01-01",
        }

    # Prefer the compiled React build; fall back to public for development assets.
    frontend_build = Path(__file__).parent.parent / "frontend" / "build"
    frontend_public = Path(__file__).parent.parent / "frontend" / "public"

    frontend_root = None
    static_root = None
    if frontend_build.exists() and (frontend_build / "index.html").exists():
        frontend_root = frontend_build
        static_root = frontend_build / "static"
        logger.info(f"Serving built React frontend from {frontend_root}")
    elif frontend_public.exists() and (frontend_public / "index.html").exists():
        frontend_root = frontend_public
        static_root = frontend_public / "static"
        logger.info(f"Serving frontend public assets from {frontend_root}")

    if frontend_root is not None:
        if static_root.exists():
            app.mount("/static", StaticFiles(directory=str(static_root)), name="static")

        @app.get("/", include_in_schema=False)
        async def frontend_index():
            """Serve the React application entry point."""
            return FileResponse(frontend_root / "index.html")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def frontend_spa(full_path: str):
            """Serve React index.html for client-side routes."""
            if full_path.startswith("api/") or full_path.startswith("ws/") or full_path == "health":
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={"detail": "Not Found"},
                )

            requested_file = frontend_root / full_path
            if requested_file.is_file():
                return FileResponse(requested_file)

            return FileResponse(frontend_root / "index.html")
    else:
        # Fallback if frontend not built
        @app.get("/", include_in_schema=False)
        async def root_fallback():
            """Fallback when frontend is not built."""
            logger.warning("Frontend not found - serving fallback API info. Build frontend with: npm run build")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "WFConsoleWeb API",
                    "version": __version__,
                    "status": "Frontend not built",
                    "build_command": "npm run build in wfconsoleweb/frontend directory",
                    "docs": "/api/docs",
                },
            )

    # 500 error handler
    @app.exception_handler(Exception)
    async def general_exception_handler(request, exc):
        """Handle general exceptions."""
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    logger.info(f"FastAPI app created: {app.title} {app.version}")

    return app


# Create application instance
app = create_app()


def main():
    """Entry point for wfconsoleweb command."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "wfconsoleweb.backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
