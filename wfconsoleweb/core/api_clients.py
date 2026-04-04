"""External API clients for WeatherFlow, CheckWX, and GitHub"""
import asyncio
import logging
import re
from datetime import datetime
from typing import Optional, Dict, Any, List

import httpx
from httpx._client import AsyncClient

from wfconsoleweb.core.types import WeatherSnapshot, ForecastPeriod, WeatherForecast

logger = logging.getLogger(__name__)


class WeatherFlowAPI:
    """WeatherFlow REST API client"""

    BASE_URL = "https://api.weatherflow.com/v4"
    FORECAST_URL = "https://swd.weatherflow.com/swd/rest/better_forecast"
    SWD_OBSERVATIONS_URL = "https://swd.weatherflow.com/swd/rest/observations/device/{device_id}"
    SWD_STATS_URL = "https://swd.weatherflow.com/swd/rest/stats/station/{station_id}"

    def __init__(self, api_token: str):
        """Initialize with API token"""
        self.api_token = api_token
        self.session: Optional[AsyncClient] = None

    async def _get_session(self) -> AsyncClient:
        """Get or create async HTTP session"""
        if self.session is None:
            self.session = httpx.AsyncClient(
                headers={"Authorization": f"Bearer {self.api_token}"},
                timeout=30.0,
            )
        return self.session

    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.aclose()
            self.session = None

    async def get_station_info(self, station_ids: List[int]) -> Optional[Dict[str, Any]]:
        """
        Get station information.

        Args:
            station_ids: List of station IDs

        Returns:
            Station information dict or None
        """
        try:
            session = await self._get_session()
            station_ids_str = ",".join(str(sid) for sid in station_ids)
            url = f"{self.BASE_URL}/stations?station_ids={station_ids_str}"

            response = await session.get(url)
            response.raise_for_status()
            return response.json()

        except httpx.RequestError as e:
            logger.error(f"Failed to fetch station info: {e}")
            return None

    async def get_station_observations(
        self,
        device_id: str,
        obs_type: str = "obs_st",
    ) -> Optional[Dict[str, Any]]:
        """
        Get latest observation from station.

        Args:
            device_id: Device ID (e.g., 'ST-00000001')
            obs_type: Observation type ('obs_st' for complete, 'evt_precip', 'evt_strike')

        Returns:
            Observation data dict or None
        """
        try:
            session = await self._get_session()
            url = f"{self.BASE_URL}/observations?station_id={device_id}"

            response = await session.get(url)
            response.raise_for_status()
            return response.json()

        except httpx.RequestError as e:
            logger.error(f"Failed to fetch observations: {e}")
            return None

    async def get_device_observations(
        self,
        device_id: str,
        bucket: str,
        time_start: int,
        time_end: int,
    ) -> Optional[Dict[str, Any]]:
        """Get SWD device observations for a time range.

        This matches the endpoint family used by WeatherFlow PiConsole for
        rainfall and lightning historical totals.
        """
        try:
            session = await self._get_session()
            url = self.SWD_OBSERVATIONS_URL.format(device_id=device_id)
            params = {
                "bucket": bucket,
                "time_start": time_start,
                "time_end": time_end,
                "token": self.api_token,
            }

            response = await session.get(url, params=params)
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.warning("WeatherFlow observations request failed with status %s", e.response.status_code)
            return None
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch device observations: {e}")
            return None

    async def get_station_statistics(self, station_id: str) -> Optional[Dict[str, Any]]:
        """Get SWD station statistics (stats_day/stats_month/stats_year)."""
        try:
            session = await self._get_session()
            url = self.SWD_STATS_URL.format(station_id=station_id)
            response = await session.get(url, params={"token": self.api_token})
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.warning("WeatherFlow station statistics request failed with status %s", e.response.status_code)
            return None
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch station statistics: {e}")
            return None

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        station_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Get weather forecast for location.

        Args:
            latitude: Station latitude
            longitude: Station longitude

        Returns:
            Forecast data dict or None
        """
        try:
            session = await self._get_session()
            url = self.FORECAST_URL
            params = {
                "token": self.api_token,
                "units_distance": "km",
                "units_speed": "mps",
                "units_temperature": "c",
            }

            # Some valid WeatherFlow tokens authorize station_id requests but reject lat/lon requests.
            if station_id:
                params["station_id"] = station_id
            else:
                params["lat"] = latitude
                params["lon"] = longitude

            response = await session.get(url, params=params)
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code if e.response is not None else None
            logger.error(f"WeatherFlow forecast request failed with status {status_code}")
            if status_code == 401:
                raise ValueError("WeatherFlow API token was rejected (401 Unauthorized)") from e
            if status_code == 429:
                raise ValueError("WeatherFlow forecast request was rate limited (429 Too Many Requests)") from e
            raise ValueError(f"WeatherFlow forecast request failed with status {status_code}") from e

        except httpx.RequestError as e:
            logger.error(f"Failed to fetch forecast: {e}")
            return None


class CheckWXAPI:
    """CheckWX aviation weather API client"""

    BASE_URL = "https://api.checkwx.com/metar"

    def __init__(self, api_key: str):
        """Initialize with API key"""
        self.api_key = api_key
        self.session: Optional[AsyncClient] = None

    async def _get_session(self) -> AsyncClient:
        """Get or create async HTTP session"""
        if self.session is None:
            self.session = httpx.AsyncClient(
                headers={"X-API-Key": self.api_key},
                timeout=30.0,
            )
        return self.session

    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.aclose()
            self.session = None

    async def get_station_metar(self, icao_code: str) -> Optional[Dict[str, Any]]:
        """
        Get METAR data for airport/weather station.

        Args:
            icao_code: ICAO code (e.g., 'KJFK')

        Returns:
            METAR data dict or None
        """
        try:
            session = await self._get_session()
            url = f"{self.BASE_URL}/latest"
            params = {"station": icao_code}

            response = await session.get(url, params=params)
            response.raise_for_status()
            return response.json()

        except httpx.RequestError as e:
            logger.error(f"Failed to fetch METAR: {e}")
            return None


class GitHubAPI:
    """GitHub API client for version checking"""

    BASE_URL = "https://api.github.com"

    def __init__(self, api_token: Optional[str] = None):
        """Initialize with optional API token"""
        self.api_token = api_token
        self.session: Optional[AsyncClient] = None

    async def _get_session(self) -> AsyncClient:
        """Get or create async HTTP session"""
        if self.session is None:
            headers = {"Accept": "application/vnd.github.v3+json"}
            if self.api_token:
                headers["Authorization"] = f"token {self.api_token}"

            self.session = httpx.AsyncClient(
                headers=headers,
                timeout=30.0,
            )
        return self.session

    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.aclose()
            self.session = None

    async def get_latest_release(
        self,
        owner: str,
        repo: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Get latest release info.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Release info dict or None
        """
        try:
            session = await self._get_session()
            url = f"{self.BASE_URL}/repos/{owner}/{repo}/releases/latest"

            response = await session.get(url)
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error("Failed to fetch latest release (%s): %s", e.response.status_code, e)
            return None
        except httpx.RequestError as e:
            logger.error(f"Failed to fetch latest release: {e}")
            return None

    async def compare_versions(
        self,
        current_version: str,
        owner: str,
        repo: str,
    ) -> Dict[str, Any]:
        """
        Check if a newer version is available.

        Args:
            current_version: Current version string (e.g., '0.2.0')
            owner: Repository owner
            repo: Repository name

        Returns:
            Dict with update_available and latest_version
        """
        try:
            release = await self.get_latest_release(owner, repo)
            if not release:
                return {"update_available": False, "latest_version": current_version}

            latest_version = release.get("tag_name", "").lstrip("v")

            # Simple version comparison (assumes semantic versioning)
            update_available = self._compare_versions(current_version, latest_version) < 0

            return {
                "update_available": update_available,
                "latest_version": latest_version,
                "download_url": release.get("html_url"),
            }

        except Exception as e:
            logger.error(f"Error comparing versions: {e}")
            return {"update_available": False, "latest_version": current_version}

    @staticmethod
    def _compare_versions(v1: str, v2: str) -> int:
        """
        Compare two version strings.

        Args:
            v1: Version 1
            v2: Version 2

        Returns:
            -1 if v1 < v2, 0 if equal, 1 if v1 > v2
        """
        def normalize(version_value: str) -> tuple:
            raw = version_value.strip().lstrip("v")
            match = re.match(r"^(\d+)\.(\d+)\.(\d+)(.*)$", raw)
            if not match:
                return (0, 0, 0, 1, raw)

            major = int(match.group(1))
            minor = int(match.group(2))
            patch = int(match.group(3))
            suffix = (match.group(4) or "").strip().lower()

            # Final release should sort after prerelease for same base version.
            if not suffix:
                return (major, minor, patch, 1, "")
            return (major, minor, patch, 0, suffix)

        pv1 = normalize(v1)
        pv2 = normalize(v2)

        if pv1 < pv2:
            return -1
        if pv1 > pv2:
            return 1
        return 0
