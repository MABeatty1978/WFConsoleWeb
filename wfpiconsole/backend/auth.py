"""Authentication and authorization utilities for FastAPI backend"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthCredentials

from wfpiconsole.config.settings import get_settings


logger = logging.getLogger(__name__)

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer security
security = HTTPBearer()


class AuthManager:
    """Manage authentication, password hashing, and JWT tokens."""

    def __init__(self, secret_key: str, algorithm: str = "HS256", token_expire_minutes: int = 1440):
        """
        Initialize auth manager.

        Args:
            secret_key: Secret key for JWT signing
            algorithm: JWT algorithm to use
            token_expire_minutes: Token expiration time in minutes (default 24 hours)
        """
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.token_expire_minutes = token_expire_minutes

    def hash_password(self, password: str) -> str:
        """
        Hash password for storage.

        Args:
            password: Plain text password

        Returns:
            Hashed password
        """
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify plain password against hash.

        Args:
            plain_password: Plain text password from user
            hashed_password: Stored hash

        Returns:
            True if password matches
        """
        return pwd_context.verify(plain_password, hashed_password)

    def create_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create JWT token.

        Args:
            data: Payload data to encode
            expires_delta: Custom expiration delta (uses default if None)

        Returns:
            Encoded JWT token
        """
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=self.token_expire_minutes)

        to_encode.update({"exp": expire})

        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            return encoded_jwt
        except Exception as e:
            logger.error(f"Error creating JWT token: {e}")
            raise

    def verify_token(self, token: str) -> Optional[dict]:
        """
        Verify and decode JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded payload or None if invalid
        """
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            return None

    def validate_token(self, token: str) -> dict:
        """
        Validate token and raise exception if invalid.

        Args:
            token: JWT token string

        Returns:
            Decoded payload

        Raises:
            HTTPException if token is invalid or expired
        """
        payload = self.verify_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload


# Global auth manager instance
_auth_manager: Optional[AuthManager] = None


def get_auth_manager() -> AuthManager:
    """Get or create global auth manager."""
    global _auth_manager
    if _auth_manager is None:
        settings = get_settings()
        _auth_manager = AuthManager(
            secret_key=settings.jwt_secret_key,
            algorithm="HS256",
            token_expire_minutes=1440,  # 24 hours
        )
    return _auth_manager


async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)) -> dict:
    """
    FastAPI dependency to get current authenticated user.

    Args:
        credentials: HTTP Bearer credentials from request

    Returns:
        Decoded token payload

    Raises:
        HTTPException if authentication fails
    """
    auth_manager = get_auth_manager()
    payload = auth_manager.validate_token(credentials.credentials)
    
    # Check that payload has required fields
    if "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token structure",
        )
    
    return payload


async def get_optional_user(credentials: Optional[HTTPAuthCredentials] = Depends(security)) -> Optional[dict]:
    """
    FastAPI dependency to optionally get current user.

    Used for endpoints that support both authenticated and unauthenticated access.

    Args:
        credentials: HTTP Bearer credentials from request (optional)

    Returns:
        Decoded token payload or None
    """
    if not credentials:
        return None

    auth_manager = get_auth_manager()
    return auth_manager.verify_token(credentials.credentials)


class TokenResponse:
    """Helper for token response formatting."""

    @staticmethod
    def format_token(token: str, token_type: str = "bearer") -> dict:
        """
        Format token for API response.

        Args:
            token: JWT token string
            token_type: Token type (usually "bearer")

        Returns:
            Dictionary with token and type
        """
        return {"access_token": token, "token_type": token_type}
