"""Database configuration and session management"""
from collections.abc import Generator
from sqlalchemy import text
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import StaticPool
import logging

from wfconsoleweb.config.settings import settings

logger = logging.getLogger(__name__)

# Debug: Log the database URL being used
logger.info(f"Database URL: {settings.database_url}")

# Create SQLAlchemy engine
if settings.database_url.startswith("sqlite"):
    # SQLite specific configuration
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.database_echo,
    )

    # Enable foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    # PostgreSQL or other databases
    engine = create_engine(
        settings.database_url,
        echo=settings.database_echo,
        pool_pre_ping=True,
    )

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Declarative base class for ORM models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency injection function for FastAPI to provide database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database by creating all tables"""
    logger.info("Initializing database...")
    Base.metadata.create_all(bind=engine)
    _ensure_display_settings_schema()
    logger.info("Database initialized successfully")


def _ensure_display_settings_schema():
    """Backfill new display_settings columns for older deployments."""
    with engine.begin() as conn:
        dialect = conn.dialect.name

        if dialect == "sqlite":
            columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(display_settings)")).fetchall()
            }

            if "user_id" not in columns:
                conn.execute(text("ALTER TABLE display_settings ADD COLUMN user_id INTEGER"))
            if "device_key" not in columns:
                conn.execute(text("ALTER TABLE display_settings ADD COLUMN device_key VARCHAR(128)"))
            if "rainfall_unit" not in columns:
                conn.execute(text("ALTER TABLE display_settings ADD COLUMN rainfall_unit VARCHAR(2) DEFAULT 'mm'"))
            if "distance_unit" not in columns:
                conn.execute(text("ALTER TABLE display_settings ADD COLUMN distance_unit VARCHAR(3) DEFAULT 'km'"))
            if "preferred_forecast_source" not in columns:
                conn.execute(text("ALTER TABLE display_settings ADD COLUMN preferred_forecast_source VARCHAR(16) DEFAULT 'tempest'"))
            if "preferred_atmos_panel" not in columns:
                conn.execute(text("ALTER TABLE display_settings ADD COLUMN preferred_atmos_panel VARCHAR(16) DEFAULT 'barometer'"))

            conn.execute(
                text(
                    """
                    UPDATE display_settings
                    SET preferred_forecast_source = 'tempest'
                    WHERE preferred_forecast_source IS NULL
                       OR preferred_forecast_source NOT IN ('tempest', 'sager', 'zambretti')
                    """
                )
            )
            return

        # PostgreSQL and other SQL dialects
        conn.execute(text("ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS user_id INTEGER"))
        conn.execute(text("ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS device_key VARCHAR(128)"))
        conn.execute(text("ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS rainfall_unit VARCHAR(2) DEFAULT 'mm'"))
        conn.execute(text("ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS distance_unit VARCHAR(3) DEFAULT 'km'"))
        conn.execute(text("ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS preferred_forecast_source VARCHAR(16) DEFAULT 'tempest'"))
        conn.execute(text("ALTER TABLE display_settings ADD COLUMN IF NOT EXISTS preferred_atmos_panel VARCHAR(16) DEFAULT 'barometer'"))
        conn.execute(
            text(
                """
                UPDATE display_settings
                SET preferred_forecast_source = 'tempest'
                WHERE preferred_forecast_source IS NULL
                   OR preferred_forecast_source NOT IN ('tempest', 'sager', 'zambretti')
                """
            )
        )


def drop_all_tables():
    """Drop all tables (for development/testing only)"""
    logger.warning("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    logger.warning("All tables dropped")
