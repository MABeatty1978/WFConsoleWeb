"""Theme management endpoints"""
import logging
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from wfpiconsole.config.models import Theme, AdminUser
from wfpiconsole.backend.dependencies import get_db, get_admin_user


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/themes", tags=["Themes"])


# Pydantic models
class ThemeConfig(BaseModel):
    """Theme configuration object."""

    name: str
    colors: dict
    fonts: dict
    spacing: dict
    borders: dict
    shadows: dict


class ThemeRequest(BaseModel):
    """Request for theme creation/update."""

    name: str
    config: dict
    enabled: bool = True


class ThemeResponse(BaseModel):
    """Theme response with metadata."""

    id: int
    name: str
    is_builtin: bool
    is_enabled: bool
    config: dict
    created_at: str
    updated_at: str


# Built-in themes
BUILTIN_THEMES = {
    "dark-minimalist": {
        "name": "Dark Minimalist",
        "colors": {
            "primary": "#1e293b",
            "secondary": "#64748b",
            "accent": "#0ea5e9",
            "background": "#0f172a",
            "surface": "#1e293b",
            "text": "#f1f5f9",
            "text_secondary": "#cbd5e1",
            "success": "#10b981",
            "warning": "#f59e0b",
            "error": "#ef4444",
        },
        "fonts": {
            "family": "'Inter', 'Segoe UI', sans-serif",
            "sizes": {"xs": 12, "sm": 14, "md": 16, "lg": 18, "xl": 24},
            "weights": {"light": 300, "normal": 400, "semibold": 600, "bold": 700},
        },
        "spacing": {
            "xs": 4,
            "sm": 8,
            "md": 16,
            "lg": 24,
            "xl": 32,
        },
        "borders": {
            "radius": 8,
            "width": 1,
            "style": "solid",
        },
        "shadows": {
            "sm": "0 1px 2px 0 rgba(0,0,0,0.05)",
            "md": "0 4px 6px -1px rgba(0,0,0,0.1)",
            "lg": "0 10px 15px -3px rgba(0,0,0,0.1)",
        },
    },
    "glass-morphism": {
        "name": "Glass Morphism",
        "colors": {
            "primary": "rgba(255, 255, 255, 0.1)",
            "secondary": "rgba(255, 255, 255, 0.05)",
            "accent": "#60a5fa",
            "background": "#0f172a",
            "surface": "rgba(255, 255, 255, 0.08)",
            "text": "#f1f5f9",
            "text_secondary": "#cbd5e1",
            "success": "#34d399",
            "warning": "#fbbf24",
            "error": "#f87171",
        },
        "fonts": {
            "family": "'Poppins', 'Segoe UI', sans-serif",
            "sizes": {"xs": 12, "sm": 14, "md": 16, "lg": 18, "xl": 24},
            "weights": {"light": 300, "normal": 400, "semibold": 600, "bold": 700},
        },
        "spacing": {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32},
        "borders": {
            "radius": 20,
            "width": 1,
            "style": "solid",
        },
        "shadows": {
            "sm": "0 8px 32px 0 rgba(31, 38, 135, 0.1)",
            "md": "0 8px 32px 0 rgba(31, 38, 135, 0.2)",
            "lg": "0 8px 32px 0 rgba(31, 38, 135, 0.3)",
        },
    },
    "scientific-dashboard": {
        "name": "Scientific Dashboard",
        "colors": {
            "primary": "#f7fafc",
            "secondary": "#d9e2ec",
            "accent": "#0f6cbd",
            "background": "#e9f1f7",
            "surface": "#ffffff",
            "text": "#102a43",
            "text_secondary": "#486581",
            "success": "#1f7a4c",
            "warning": "#b95c00",
            "error": "#b42318",
            "button_text": "#f8fbff",
        },
        "fonts": {
            "family": "'Courier New', 'IBM Plex Mono', monospace",
            "sizes": {"xs": 11, "sm": 13, "md": 15, "lg": 17, "xl": 22},
            "weights": {"light": 300, "normal": 400, "semibold": 600, "bold": 700},
        },
        "spacing": {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32},
        "borders": {
            "radius": 4,
            "width": 2,
            "style": "solid",
        },
        "shadows": {
            "sm": "0 2px 4px rgba(44, 62, 80, 0.08)",
            "md": "0 4px 8px rgba(44, 62, 80, 0.12)",
            "lg": "0 8px 16px rgba(44, 62, 80, 0.16)",
        },
    },
    "weather-realistic": {
        "name": "Weather Realistic",
        "colors": {
            "primary": "#f4fbff",
            "secondary": "#d6ebf5",
            "accent": "#b76a00",
            "background": "#dff1fb",
            "surface": "#ffffff",
            "text": "#12344a",
            "text_secondary": "#4b7188",
            "success": "#1d8f5b",
            "warning": "#b76a00",
            "error": "#c24b43",
            "button_text": "#fffaf2",
        },
        "fonts": {
            "family": "'Rubik', 'Segoe UI', sans-serif",
            "sizes": {"xs": 12, "sm": 14, "md": 16, "lg": 18, "xl": 24},
            "weights": {"light": 300, "normal": 400, "semibold": 600, "bold": 700},
        },
        "spacing": {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32},
        "borders": {
            "radius": 12,
            "width": 1,
            "style": "solid",
        },
        "shadows": {
            "sm": "0 2px 4px rgba(26, 95, 122, 0.08)",
            "md": "0 4px 12px rgba(26, 95, 122, 0.12)",
            "lg": "0 10px 25px rgba(26, 95, 122, 0.15)",
        },
    },
}


# Theme endpoints


@router.get("/builtin")
async def list_builtin_themes():
    """Return built-in themes in the format expected by the frontend."""
    return [
        {
            "id": hash(theme_id) % (10**8),
            "name": theme_config["name"],
            "is_builtin": True,
            "is_enabled": True,
            "config": theme_config,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
        for theme_id, theme_config in BUILTIN_THEMES.items()
    ]


@router.get("/list", response_model=List[ThemeResponse])
async def list_themes(db: Session = Depends(get_db)):
    """List all available themes (built-in + custom)."""
    themes = db.query(Theme).all()
    theme_list = []

    # Add built-in themes
    for theme_id, theme_config in BUILTIN_THEMES.items():
        theme_list.append(
            {
                "id": hash(theme_id) % (10**8),  # Generate consistent ID
                "name": theme_config["name"],
                "is_builtin": True,
                "is_enabled": True,
                "config": theme_config,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            }
        )

    # Add custom themes
    for theme in themes:
        theme_list.append(
            {
                "id": theme.id,
                "name": theme.name,
                "is_builtin": False,
                "is_enabled": theme.enabled,
                "config": json.loads(theme.config_json) if theme.config_json else {},
                "created_at": theme.created_at.isoformat(),
                "updated_at": theme.updated_at.isoformat(),
            }
        )

    return theme_list


@router.get("/{theme_id}", response_model=ThemeResponse)
async def get_theme(theme_id: str, db: Session = Depends(get_db)):
    """Get specific theme by ID or name."""
    # Check if it's a built-in theme
    if theme_id in BUILTIN_THEMES:
        theme_config = BUILTIN_THEMES[theme_id]
        return {
            "id": hash(theme_id) % (10**8),
            "name": theme_config["name"],
            "is_builtin": True,
            "is_enabled": True,
            "config": theme_config,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

    # Check custom themes
    theme = db.query(Theme).filter(Theme.name == theme_id).first()
    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Theme '{theme_id}' not found",
        )

    return {
        "id": theme.id,
        "name": theme.name,
        "is_builtin": False,
        "is_enabled": theme.enabled,
        "config": json.loads(theme.config_json) if theme.config_json else {},
        "created_at": theme.created_at.isoformat(),
        "updated_at": theme.updated_at.isoformat(),
    }


@router.post("/custom", response_model=ThemeResponse)
async def create_custom_theme(
    theme: ThemeRequest,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a new custom theme."""
    try:
        # Check if theme name already exists
        existing = db.query(Theme).filter(Theme.name == theme.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Theme '{theme.name}' already exists",
            )

        # Create new theme
        new_theme = Theme(
            name=theme.name,
            config_json=json.dumps(theme.config),
            enabled=theme.enabled,
            builtin=False,
        )

        db.add(new_theme)
        db.commit()

        logger.info(f"Custom theme '{theme.name}' created by {current_user.username}")

        return {
            "id": new_theme.id,
            "name": new_theme.name,
            "is_builtin": False,
            "is_enabled": new_theme.enabled,
            "config": theme.config,
            "created_at": new_theme.created_at.isoformat(),
            "updated_at": new_theme.updated_at.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating theme: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create theme",
        )


@router.put("/{theme_id}", response_model=ThemeResponse)
async def update_custom_theme(
    theme_id: int,
    theme: ThemeRequest,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update a custom theme."""
    try:
        db_theme = db.query(Theme).filter(Theme.id == theme_id).first()
        if not db_theme:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Theme with ID {theme_id} not found",
            )

        db_theme.name = theme.name
        db_theme.config_json = json.dumps(theme.config)
        db_theme.enabled = theme.enabled

        db.commit()

        logger.info(f"Theme '{theme.name}' updated by {current_user.username}")

        return {
            "id": db_theme.id,
            "name": db_theme.name,
            "is_builtin": False,
            "is_enabled": db_theme.enabled,
            "config": theme.config,
            "created_at": db_theme.created_at.isoformat(),
            "updated_at": db_theme.updated_at.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating theme: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update theme",
        )


@router.delete("/{theme_id}")
async def delete_custom_theme(
    theme_id: int,
    current_user: AdminUser = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a custom theme."""
    try:
        db_theme = db.query(Theme).filter(Theme.id == theme_id).first()
        if not db_theme:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Theme with ID {theme_id} not found",
            )

        if db_theme.builtin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete built-in themes",
            )

        theme_name = db_theme.name
        db.delete(db_theme)
        db.commit()

        logger.info(f"Theme '{theme_name}' deleted by {current_user.username}")

        return {"status": "success", "message": f"Theme '{theme_name}' deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting theme: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete theme",
        )


@router.get("/builtin/list")
async def list_builtin_themes():
    """List all built-in themes."""
    return {
        "builtin_themes": [
            {
                "id": theme_id,
                "name": config["name"],
                "preview_colors": {
                    "primary": config["colors"]["primary"],
                    "accent": config["colors"]["accent"],
                    "success": config["colors"]["success"],
                },
            }
            for theme_id, config in BUILTIN_THEMES.items()
        ]
    }
