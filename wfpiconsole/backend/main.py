"""FastAPI application initialization and core endpoints"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZIPMiddleware
from fastapi.responses import JSONResponse

from wfpiconsole.config.settings import get_settings
from wfpiconsole.config.database import init_db
from wfpiconsole.backend.websocket import get_ws_manager
from wfpiconsole.backend.routes import (
    auth_router,
    config_router,
    station_router,
    history_router,
    themes_router,
    system_router,
    forecast_router,
)
from wfpiconsole.service import get_service_manager


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
        version="0.1.0a1",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Add GZIP compression for responses
    app.add_middleware(GZIPMiddleware, minimum_size=1000)

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
            "version": "0.1.0a1",
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
            "app_version": "0.1.0a1",
            "release_date": "2024-01-01",
        }

    # 404 error handler
    @app.exception_handler(404)
    async def not_found_handler(request, exc):
        """Handle 404 errors."""
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "detail": f"Path '{request.url.path}' not found",
                "path": request.url.path,
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


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "wfpiconsole.backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info",
    )
