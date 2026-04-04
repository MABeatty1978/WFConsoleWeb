#!/usr/bin/env python3
"""Install-time admin bootstrap utility.

Creates exactly one admin user by optionally removing existing admin users first.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from wfconsoleweb.backend.auth import get_auth_manager  # noqa: E402
from wfconsoleweb.config.database import SessionLocal, init_db  # noqa: E402
from wfconsoleweb.config.models import AdminUser  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create/reset WFConsoleWeb admin user")
    parser.add_argument("--username", default=os.getenv("WF_ADMIN_USERNAME", ""))
    parser.add_argument("--password", default=os.getenv("WF_ADMIN_PASSWORD", ""))
    parser.add_argument(
        "--reset-existing",
        action="store_true",
        help="Delete existing admin users before creating the new one",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Fail if required values are missing instead of prompting",
    )
    return parser.parse_args()


def prompt_if_needed(username: str, password: str, non_interactive: bool) -> tuple[str, str]:
    resolved_username = username.strip()
    resolved_password = password

    if not resolved_username:
      if non_interactive:
          raise ValueError("Missing admin username in non-interactive mode")
      entered_username = input("Admin username [admin]: ").strip()
      resolved_username = entered_username or "admin"

    if not resolved_password:
        if non_interactive:
            raise ValueError("Missing admin password in non-interactive mode")
        while True:
            p1 = getpass.getpass("Admin password: ")
            p2 = getpass.getpass("Confirm admin password: ")
            if not p1:
                print("Password cannot be empty.")
                continue
            if p1 != p2:
                print("Passwords do not match. Try again.")
                continue
            resolved_password = p1
            break

    if len(resolved_password) < 8:
        raise ValueError("Admin password must be at least 8 characters")

    return resolved_username, resolved_password


def main() -> int:
    args = parse_args()

    username, password = prompt_if_needed(args.username, args.password, args.non_interactive)

    init_db()
    db = SessionLocal()
    try:
        existing = db.query(AdminUser).all()
        if existing and not args.reset_existing:
            print(
                "Admin user already exists. Use --reset-existing to replace it.",
                file=sys.stderr,
            )
            return 1

        if existing and args.reset_existing:
            db.query(AdminUser).delete()
            db.commit()

        auth_manager = get_auth_manager()
        admin = AdminUser(username=username, password_hash=auth_manager.hash_password(password))
        db.add(admin)
        db.commit()

        print(f"Admin account configured: {username}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
