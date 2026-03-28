"""Authentication routes for login, logout, and token management"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfpiconsole.config.models import AdminUser
from wfpiconsole.backend.auth import get_auth_manager, get_current_user
from wfpiconsole.backend.dependencies import get_db


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# Pydantic models
class LoginRequest(BaseModel):
    """Login request credentials."""

    username: str
    password: str


class TokenResponse(BaseModel):
    """Token response with type and value."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 hours in seconds


class UserResponse(BaseModel):
    """User information (safe to send to client)."""

    username: str
    created_at: str


# Authentication endpoints


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.

    Args:
        credentials: LoginRequest with username and password

    Returns:
        TokenResponse with access_token

    Raises:
        HTTPException if credentials are invalid
    """
    try:
        # Find user by username
        user = db.query(AdminUser).filter(AdminUser.username == credentials.username).first()

        if not user:
            logger.warning(f"Login attempt with non-existent user: {credentials.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        # Verify password
        auth_manager = get_auth_manager()
        if not auth_manager.verify_password(credentials.password, user.password_hash):
            logger.warning(f"Failed login attempt for user: {credentials.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        # Create JWT token
        payload = {"sub": user.username}
        token = auth_manager.create_token(payload)

        logger.info(f"User logged in: {credentials.username}")
        return TokenResponse(access_token=token, token_type="bearer", expires_in=86400)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed",
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get current authenticated user information.

    Args:
        current_user: Decoded JWT token payload
        db: Database session

    Returns:
        UserResponse with user information
    """
    username = current_user.get("sub")
    user = db.query(AdminUser).filter(AdminUser.username == username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return UserResponse(username=user.username, created_at=user.created_at.isoformat())


@router.post("/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """
    Refresh JWT token for logged-in user.

    Args:
        current_user: Decoded JWT token payload

    Returns:
        TokenResponse with new access_token
    """
    auth_manager = get_auth_manager()
    username = current_user.get("sub")

    payload = {"sub": username}
    token = auth_manager.create_token(payload)

    return TokenResponse(access_token=token, token_type="bearer", expires_in=86400)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout current user.

    Note: This is primarily for client-side cleanup. JWT tokens
    cannot be revoked server-side without maintaining a blacklist.

    Args:
        current_user: Decoded JWT token payload

    Returns:
        Success message
    """
    username = current_user.get("sub")
    logger.info(f"User logged out: {username}")

    return {"status": "success", "message": "Logged out successfully"}


@router.post("/initialize")
async def initialize_admin(username: str, password: str, db: Session = Depends(get_db)):
    """
    Initialize admin user (only works if no admin exists).

    This is a one-time operation to create the initial admin account.

    Args:
        username: Admin username
        password: Admin password
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException if admin already exists
    """
    try:
        # Check if admin already exists
        existing_admin = db.query(AdminUser).first()
        if existing_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin user already initialized",
            )

        # Create admin user
        auth_manager = get_auth_manager()
        admin = AdminUser(username=username, password_hash=auth_manager.hash_password(password))

        db.add(admin)
        db.commit()

        logger.info(f"Admin user initialized: {username}")
        return {"status": "success", "message": f"Admin user '{username}' created"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initializing admin: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize admin user",
        )


@router.get("/health")
async def auth_health():
    """Check authentication service health."""
    return {"status": "healthy", "service": "authentication"}
