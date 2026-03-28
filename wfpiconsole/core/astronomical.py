"""Astronomical calculations for sunrise, sunset, and moon phases"""
import math
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional

from wfpiconsole.core.types import AstronomicalData


class AstronomicalCalculator:
    """Calculate astronomical events like sunrise, sunset, moon phase"""

    def __init__(self, latitude: float, longitude: float):
        """
        Initialize calculator with station location.

        Args:
            latitude: Station latitude in degrees
            longitude: Station longitude in degrees
        """
        self.latitude = latitude
        self.longitude = longitude

    def calculate_julian_date(self, dt: datetime) -> float:
        """
        Calculate Julian date for given datetime.

        Args:
            dt: Datetime object (should be UTC)

        Returns:
            Julian date as float
        """
        # Convert to UTC if necessary
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

        a = (14 - dt.month) // 12
        y = dt.year + 4800 - a
        m = dt.month + 12 * a - 3

        jdn = dt.day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
        jd = jdn + (dt.hour - 12) / 24.0 + dt.minute / 1440.0 + dt.second / 86400.0

        return jd

    def sun_position(self, dt: datetime) -> Tuple[float, float]:
        """
        Calculate sun position (altitude and azimuth).

        Args:
            dt: Datetime object (UTC)

        Returns:
            Tuple of (altitude degrees, azimuth degrees)
        """
        jd = self.calculate_julian_date(dt)
        t = (jd - 2451545.0) / 36525.0

        # Sun's geometric mean longitude (degrees)
        l0 = 280.46646 + t * (36000.76983 + t * 0.0003032)
        l0 = l0 % 360

        # Mean anomaly of the sun
        m = 357.52911 + t * (35999.05029 - t * 0.0001536)
        m = m % 360
        m_rad = math.radians(m)

        # Sun's equation of center
        c = (
            (1.914602 - t * (0.004817 + 0.000014 * t)) * math.sin(m_rad)
            + (0.019993 - 0.000101 * t) * math.sin(2 * m_rad)
            + 0.000029 * math.sin(3 * m_rad)
        )

        # Sun's true longitude
        sun_lon = l0 + c

        # Apparent sun longitude
        omega = 125.04 - 1934.136 * t
        lambda_ = sun_lon - 0.00569 - 0.00478 * math.sin(math.radians(omega))

        # Mean obliquity of ecliptic
        epsilon0 = 23 + 26 / 60 + 21.448 / 3600 - 46.8150 / 3600 * t - 0.00059 / 3600 * t * t + 0.001813 / 3600 * t * t * t
        epsilon = epsilon0 + 0.00256 * math.cos(math.radians(omega))

        # Geocentric sun right ascension and declination
        lambda_rad = math.radians(lambda_)
        epsilon_rad = math.radians(epsilon)

        ra = math.degrees(math.atan2(math.cos(epsilon_rad) * math.sin(lambda_rad), math.cos(lambda_rad)))
        dec = math.degrees(math.asin(math.sin(epsilon_rad) * math.sin(lambda_rad)))

        # Hour angle
        gst = self._greenwich_sidereal_time(jd)
        lst = gst + self.longitude
        ha = (lst - ra) % 360
        if ha > 180:
            ha = ha - 360

        ha_rad = math.radians(ha)
        dec_rad = math.radians(dec)
        lat_rad = math.radians(self.latitude)

        # Altitude
        alt = math.degrees(
            math.asin(
                math.sin(lat_rad) * math.sin(dec_rad)
                + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)
            )
        )

        # Azimuth
        az = math.degrees(
            math.atan2(
                math.sin(ha_rad),
                math.cos(ha_rad) * math.sin(lat_rad) - math.tan(dec_rad) * math.cos(lat_rad),
            )
        )
        az = (az + 180) % 360

        return alt, az

    def calculate_sunrise_sunset(self, dt: datetime) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        Calculate sunrise and sunset times.

        Args:
            dt: Date for which to calculate (date part used only)

        Returns:
            Tuple of (sunrise datetime UTC, sunset datetime UTC)
        """
        # Use standard refraction of 0.833 degrees (sun's radius + atmospheric refraction)
        return self._calculate_solar_noon_and_times(dt, -0.833)

    def calculate_civil_twilight(self, dt: datetime) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        Calculate civil twilight times (when sun is 6 degrees below horizon).

        Args:
            dt: Date for which to calculate

        Returns:
            Tuple of (civil twilight start, civil twilight end)
        """
        return self._calculate_solar_noon_and_times(dt, -6.0)

    def _calculate_solar_noon_and_times(self, dt: datetime, angle: float) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        Calculate solar noon and event times.

        Args:
            dt: Date
            angle: Depression angle of sun below horizon

        Returns:
            Tuple of (event1 datetime UTC, event2 datetime UTC)
        """
        jd = self.calculate_julian_date(dt.replace(hour=0, minute=0, second=0, microsecond=0))
        t = (jd - 2451545.0) / 36525.0

        # Solar noon
        l0 = 280.46646 + t * (36000.76983 + t * 0.0003032)
        m = 357.52911 + t * (35999.05029 - t * 0.0001536)
        m_rad = math.radians(m)

        c = (
            (1.914602 - t * (0.004817 + 0.000014 * t)) * math.sin(m_rad)
            + (0.019993 - 0.000101 * t) * math.sin(2 * m_rad)
            + 0.000029 * math.sin(3 * m_rad)
        )

        sun_lon = l0 + c
        omega = 125.04 - 1934.136 * t
        lambda_ = sun_lon - 0.00569 - 0.00478 * math.sin(math.radians(omega))

        epsilon0 = 23 + 26 / 60 + 21.448 / 3600 - 46.8150 / 3600 * t
        epsilon = epsilon0 + 0.00256 * math.cos(math.radians(omega))

        lambda_rad = math.radians(lambda_)
        epsilon_rad = math.radians(epsilon)

        ra = math.atan2(math.cos(epsilon_rad) * math.sin(lambda_rad), math.cos(lambda_rad))

        # Time of solar noon
        approx_time = jd + ra / (2 * math.pi) - self.longitude / 360.0
        jd_transit = approx_time + self._equation_of_time(approx_time - 2451545.0)

        # Time of event (sunrise/sunset)
        sin_dec = math.sin(epsilon_rad) * math.sin(lambda_rad)
        cos_dec = math.sqrt(1 - sin_dec * sin_dec)

        lat_rad = math.radians(self.latitude)
        h = (math.sin(math.radians(angle)) - math.sin(lat_rad) * sin_dec) / (math.cos(lat_rad) * cos_dec)

        if h < -1 or h > 1:
            # Sun doesn't rise or set (polar regions)
            return None, None

        ha = math.acos(h)
        jd_event = jd_transit - ha / (2 * math.pi)

        # Event 1 (sunrise) and Event 2 (sunset)
        jd_event1 = jd_transit - ha / (2 * math.pi)
        jd_event2 = jd_transit + ha / (2 * math.pi)

        dt1 = self._julian_to_datetime(jd_event1)
        dt2 = self._julian_to_datetime(jd_event2)

        return dt1, dt2

    def calculate_moon_phase(self, dt: datetime) -> Tuple[float, float]:
        """
        Calculate moon phase and illumination.

        Args:
            dt: Datetime object

        Returns:
            Tuple of (phase 0-1, illumination 0-100%)
        """
        jd = self.calculate_julian_date(dt)

        # Reference: new moon on 2000-01-06
        reference_new_moon = 2451550.1

        # Synodic month (lunar cycle)
        synodic_month = 29.530588861

        # Days since reference new moon
        days_since = jd - reference_new_moon

        # Phase (0-1)
        phase = (days_since % synodic_month) / synodic_month

        # Illumination (0-100%)
        illumination = 50 * (1 - math.cos(2 * math.pi * phase))

        return phase, illumination

    def calculate_astronomical_data(self, dt: datetime) -> AstronomicalData:
        """
        Calculate all astronomical data for a given time.

        Args:
            dt: Datetime object (UTC)

        Returns:
            AstronomicalData object
        """
        sunrise, sunset = self.calculate_sunrise_sunset(dt)
        moonrise, moonset = self._calculate_moonrise_moonset(dt)
        phase, illumination = self.calculate_moon_phase(dt)

        return AstronomicalData(
            timestamp=dt,
            sunrise=sunrise,
            sunset=sunset,
            moonrise=moonrise,
            moonset=moonset,
            moon_phase=phase,
            moon_illumination=illumination,
            julian_date=self.calculate_julian_date(dt),
        )

    def _greenwich_sidereal_time(self, jd: float) -> float:
        """Calculate Greenwich Sidereal Time"""
        t = (jd - 2451545.0) / 36525.0
        gst = 280.46061837 + 360.98564724 * (jd - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000.0
        return gst % 360

    def _equation_of_time(self, jd_days: float) -> float:
        """Calculate equation of time in days"""
        t = jd_days / 36525.0
        m = 357.52911 + t * (35999.05029 - t * 0.0001536)
        m_rad = math.radians(m)

        l0 = 280.46646 + t * (36000.76983 + t * 0.0003032)

        e = 0.016708634 - t * (0.000042037 + t * 0.0000001267)

        y = math.tan(math.radians((l0 % 360) / 2.0))
        y = y * y

        eq = (
            y * math.sin(2 * math.radians((l0 % 360)))
            - 2 * e * math.sin(m_rad)
            + 4 * e * y * math.sin(m_rad) * math.cos(2 * math.radians((l0 % 360)))
            - 0.5 * y * y * math.sin(4 * math.radians((l0 % 360)))
            - 1.25 * e * e * math.sin(2 * m_rad)
        )

        return math.degrees(eq) / 360.0

    def _calculate_moonrise_moonset(self, dt: datetime) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        Calculate moon rise and set times.

        Args:
            dt: Datetime

        Returns:
            Tuple of (moonrise, moonset) or (None, None)
        """
        # Simplified calculation - detailed lunar calculations are complex
        # For production, use ephemeris library
        return None, None

    @staticmethod
    def _julian_to_datetime(jd: float) -> datetime:
        """Convert Julian date to datetime"""
        a = int(jd + 0.5)
        b = a + 1537
        c = int((b - 122.1) / 365.25)
        d = int(365.25 * c)
        e = int((b - d) / 30.6001)

        day = b - d - int(30.6001 * e)
        month = e - 1 if e < 14 else e - 13
        year = c - 4716 if month > 2 else c - 4715

        frac = jd + 0.5 - int(jd + 0.5)
        hours = frac * 24
        hour = int(hours)
        minutes = (hours - hour) * 60
        minute = int(minutes)
        seconds = (minutes - minute) * 60
        second = int(seconds)

        return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
