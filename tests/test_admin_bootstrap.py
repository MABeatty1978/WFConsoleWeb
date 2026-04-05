import importlib
import os
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


REPO_ROOT = Path(__file__).resolve().parents[1]
SETUP_ADMIN_SCRIPT = REPO_ROOT / "scripts" / "setup-admin.py"


def _reset_backend_modules() -> None:
    module_names = [
        "wfconsoleweb.config.settings",
        "wfconsoleweb.config.database",
        "wfconsoleweb.config.models",
        "wfconsoleweb.backend.auth",
        "wfconsoleweb.backend.dependencies",
        "wfconsoleweb.backend.routes.auth",
    ]

    for name in module_names:
        sys.modules.pop(name, None)


def test_setup_admin_creates_single_admin_and_login_works_with_special_chars(tmp_path, monkeypatch):
    db_path = tmp_path / "wfconsoleweb.db"
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    username = "installtest"
    password = "InstallTest123!"

    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    env["DATA_DIR"] = str(data_dir)
    env["MASTER_PASSWORD"] = "test-master-password"
    env["JWT_SECRET_KEY"] = "test-jwt-secret-key-with-32-chars"

    bootstrap = subprocess.run(
        [
            sys.executable,
            str(SETUP_ADMIN_SCRIPT),
            "--username",
            username,
            "--password",
            password,
            "--reset-existing",
            "--non-interactive",
        ],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert bootstrap.returncode == 0, bootstrap.stderr
    assert "Admin account configured" in bootstrap.stdout
    assert db_path.exists()

    for key, value in env.items():
        if key in {"DATABASE_URL", "DATA_DIR", "MASTER_PASSWORD", "JWT_SECRET_KEY"}:
            monkeypatch.setenv(key, value)

    _reset_backend_modules()

    auth_module = importlib.import_module("wfconsoleweb.backend.auth")
    routes_auth_module = importlib.import_module("wfconsoleweb.backend.routes.auth")
    database_module = importlib.import_module("wfconsoleweb.config.database")
    models_module = importlib.import_module("wfconsoleweb.config.models")

    db = database_module.SessionLocal()
    try:
        admin_users = db.query(models_module.AdminUser).all()
        assert len(admin_users) == 1
        assert admin_users[0].username == username
        assert admin_users[0].password_hash != password
        assert auth_module.get_auth_manager().verify_password(password, admin_users[0].password_hash)
    finally:
        db.close()

    app = FastAPI()
    app.include_router(routes_auth_module.router)
    client = TestClient(app)

    login_response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert login_response.status_code == 200, login_response.text

    token = login_response.json()["access_token"]
    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200, me_response.text
    assert me_response.json()["username"] == username
    assert me_response.json()["role"] == "admin"

    wrong_password_response = client.post(
        "/api/auth/login",
        json={"username": username, "password": "wrong-password"},
    )
    assert wrong_password_response.status_code == 401