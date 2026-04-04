"""Application configuration and settings management"""
import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_URL = f"sqlite:///{(PROJECT_ROOT / 'wfconsoleweb.db').as_posix()}"
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # App configuration
    app_name: str = "WFConsoleWeb"
    app_version: str = "0.2.0"
    debug: bool = False

    # Server configuration
    host: str = "0.0.0.0"
    port: int = int(os.getenv("PORT", "8000"))
    reload: bool = False

    # Database
    database_url: str = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    database_echo: bool = False

    # JWT & Security
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440  # 24 hours

    # Encryption
    master_password: str = os.getenv("MASTER_PASSWORD", "")

    # Ko-fi Configuration
    kofi_profile_url: str = os.getenv("KOFI_PROFILE_URL", "https://ko-fi.com/michaelbeatty9142002")

    # GitHub update source
    github_repo_owner: str = os.getenv("GITHUB_REPO_OWNER", "michaelbeatty9142002")
    github_repo_name: str = os.getenv("GITHUB_REPO_NAME", "WFConsoleWeb")
    github_api_token: str = os.getenv("GITHUB_API_TOKEN", "")

    # Data Storage
    data_directory: Path = Path(os.getenv("DATA_DIR", str(DEFAULT_DATA_DIR)))
    max_historical_days: int = int(os.getenv("MAX_HISTORICAL_DAYS", "365"))

    # UDP Server (Tempest local broadcast)
    udp_port: int = int(os.getenv("UDP_PORT", "50222"))
    udp_host: str = "0.0.0.0"

    # API Timeouts
    api_timeout_seconds: int = 30

    # CORS Configuration
    cors_origins: list = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1",
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Ensure data directory exists
        self.data_directory.mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Export settings
settings = get_settings()
