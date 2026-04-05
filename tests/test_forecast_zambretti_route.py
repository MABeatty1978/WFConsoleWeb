from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from wfconsoleweb.backend.dependencies import get_db
from wfconsoleweb.backend.routes.forecast import router as forecast_router
from wfconsoleweb.config.database import Base
from wfconsoleweb.config.models import ObservationHistory, StationConfig


def _build_test_client(seed_observations: bool) -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        db.add(
            StationConfig(
                station_id="station-1",
                station_name="Test Station",
                latitude=40.0,
                longitude=-74.0,
                elevation=120.0,
            )
        )

        if seed_observations:
            now = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
            db.add_all(
                [
                    ObservationHistory(
                        timestamp=now - timedelta(hours=3),
                        sea_level_pressure=1016.0,
                        air_temperature=12.0,
                        wind_direction=180,
                    ),
                    ObservationHistory(
                        timestamp=now,
                        sea_level_pressure=1018.0,
                        air_temperature=12.0,
                        wind_direction=180,
                    ),
                ]
            )

        db.commit()
    finally:
        db.close()

    app = FastAPI()
    app.include_router(forecast_router)

    def override_get_db():
        test_db = TestingSessionLocal()
        try:
            yield test_db
        finally:
            test_db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_zambretti_route_success_payload_shape():
    client = _build_test_client(seed_observations=True)

    response = client.get("/api/forecast/zambretti")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "zambretti"
    assert payload["zambrettiNumber"] == 24
    assert payload["forecastText"] == "Fairly Fine, Possibly Showers Early"
    assert payload["pressureTrend"] == "rising"
    assert payload["pressureMb"] == 1018.0
    assert payload["pressureDelta3hMb"] == 2.0
    assert payload["dialAngle"] == 58.1
    assert "algorithmSource" in payload


def test_zambretti_route_insufficient_data_response():
    client = _build_test_client(seed_observations=False)

    response = client.get("/api/forecast/zambretti")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "zambretti"
    assert payload["error"] == "Insufficient pressure history for Zambretti forecast"
    assert payload["zambrettiNumber"] is None
    assert payload["forecastText"] == "Insufficient data"


def test_sager_route_uses_non_null_history_beyond_latest_window():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        db.add(
            StationConfig(
                station_id="station-1",
                station_name="Test Station",
                latitude=40.0,
                longitude=-74.0,
                elevation=120.0,
            )
        )

        now = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)

        # Build >180 non-null pressure samples first.
        for i in range(220):
            db.add(
                ObservationHistory(
                    timestamp=now - timedelta(minutes=244 - i),
                    sea_level_pressure=1008.0 + (i * 0.01),
                    air_temperature=12.0,
                    wind_direction=180,
                )
            )

        # Add newest 24 observations where only one has pressure.
        for i in range(24):
            db.add(
                ObservationHistory(
                    timestamp=now - timedelta(minutes=23 - i),
                    sea_level_pressure=1011.2 if i == 23 else None,
                    air_temperature=12.0,
                    wind_direction=180,
                )
            )

        db.commit()
    finally:
        db.close()

    app = FastAPI()
    app.include_router(forecast_router)

    def override_get_db():
        test_db = TestingSessionLocal()
        try:
            yield test_db
        finally:
            test_db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    response = client.get("/api/forecast/sager")
    assert response.status_code == 200

    payload = response.json()
    assert "limited recent history" not in payload["forecastText"]
    assert payload["seaLevelPressureTrend"] in {"rising", "steady", "falling"}
    assert payload["forecastCode"] in {2, 4, 7}
    assert payload["pressureSampleCount"] >= 180


def test_sager_route_limited_history_with_too_few_pressure_points():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        db.add(
            StationConfig(
                station_id="station-1",
                station_name="Test Station",
                latitude=40.0,
                longitude=-74.0,
                elevation=120.0,
            )
        )

        now = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
        for i, pressure in enumerate([1010.1, 1010.2, 1010.0]):
            db.add(
                ObservationHistory(
                    timestamp=now - timedelta(minutes=10 - i),
                    sea_level_pressure=pressure,
                    air_temperature=12.0,
                    wind_direction=180,
                )
            )

        db.commit()
    finally:
        db.close()

    app = FastAPI()
    app.include_router(forecast_router)

    def override_get_db():
        test_db = TestingSessionLocal()
        try:
            yield test_db
        finally:
            test_db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    response = client.get("/api/forecast/sager")
    assert response.status_code == 200

    payload = response.json()
    assert payload["forecastCode"] == 4
    assert payload["forecastText"] == "Steady pressure (limited recent history: 3 samples)"
    assert payload["seaLevelPressureTrend"] == "steady"
    assert payload["pressureSampleCount"] == 3
