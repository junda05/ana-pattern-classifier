"""Shared fixtures: isolated settings and fake models (no checkpoint is ever read)."""

import logging
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.app import create_app
from app.core.class_mapping import ModelConfig
from app.core.config import Settings, get_settings
from app.services.prediction_service import (
    PredictionService,
    get_prediction_service,
    reset_prediction_service,
)
from tests.fakes import FakeModel, default_vector

TEST_API_KEY = "test-key"
AUTH_HEADERS = {"Authorization": f"Bearer {TEST_API_KEY}"}

# The real loader, for tests that exercise it against missing checkpoint files
REAL_LOAD_ALL_MODELS = PredictionService._load_all_models


@pytest.fixture(autouse=True)
def isolated_app_logger() -> Iterator[None]:
    """Undo the handler and level that `create_app` installs on the "app" logger."""
    app_logger = logging.getLogger("app")
    handlers, level = list(app_logger.handlers), app_logger.level
    yield
    app_logger.handlers[:] = handlers
    app_logger.setLevel(level)


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Settings come only from the test environment, never from a developer `.env`."""
    for field_name in Settings.model_fields:
        monkeypatch.delenv(field_name.upper(), raising=False)
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("API_KEYS", TEST_API_KEY)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def fake_models() -> dict[str, FakeModel]:
    """One scripted fake per `ModelConfig.MODELS` key; tests may re-script or remove them."""
    return {model_key: FakeModel(default_vector(model_key)) for model_key in ModelConfig.MODELS}


@pytest.fixture(autouse=True)
def patched_model_loading(
    monkeypatch: pytest.MonkeyPatch, fake_models: dict[str, FakeModel]
) -> Iterator[None]:
    """Replace checkpoint loading so the service uses `fake_models` (same dict object)."""

    def load_fake_models(self: PredictionService) -> None:
        self.models = fake_models

    monkeypatch.setattr(PredictionService, "_load_all_models", load_fake_models)
    reset_prediction_service()
    yield
    reset_prediction_service()


@pytest.fixture
def service() -> PredictionService:
    return get_prediction_service()


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client
