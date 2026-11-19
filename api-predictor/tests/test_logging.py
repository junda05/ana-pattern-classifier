"""The service logs through `logging` (never print) at the level set by LOG_LEVEL."""

import logging

import pytest
from pydantic import ValidationError

from app.core.app import create_app
from app.core.config import Settings, get_settings
from tests.conftest import AUTH_HEADERS
from tests.fakes import make_png


def post_prediction(client):
    response = client.post(
        "/api/v1/predict", files={"file": ("sample.png", make_png(32, 32), "image/png")},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200


def test_prediction_writes_nothing_to_stdout(client, capsys):
    post_prediction(client)

    assert capsys.readouterr().out == ""


def test_prediction_steps_are_logged(client, caplog):
    caplog.set_level(logging.INFO, logger="app")

    post_prediction(client)

    messages = [record.getMessage() for record in caplog.records
                if record.name == "app.services.prediction_service"]
    assert any("Classification finished at general level" in message for message in messages)


def test_log_level_defaults_to_info():
    create_app()

    assert logging.getLogger("app").level == logging.INFO


def test_log_level_setting_configures_the_app_logger(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "warning")
    get_settings.cache_clear()

    create_app()

    assert logging.getLogger("app").level == logging.WARNING


def test_invalid_log_level_is_rejected(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "verbose")

    with pytest.raises(ValidationError):
        Settings()
