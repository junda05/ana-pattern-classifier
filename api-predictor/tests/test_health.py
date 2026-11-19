"""GET /api/v1/health and behaviour when the required general model is missing."""

from app.core.class_mapping import ModelConfig
from app.services.prediction_service import PredictionService
from tests.conftest import AUTH_HEADERS, REAL_LOAD_ALL_MODELS
from tests.fakes import make_png

HEALTH_URL = "/api/v1/health"


def test_health_reports_loaded_models_without_authentication(client):
    response = client.get(HEALTH_URL)

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "models_loaded": 6}


def test_health_is_ok_when_only_an_optional_model_is_missing(client, fake_models):
    fake_models.pop("mitotic_expert")

    response = client.get(HEALTH_URL)

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "models_loaded": 5}


def test_health_returns_503_when_the_general_model_is_missing(client, fake_models):
    fake_models.pop("general")

    response = client.get(HEALTH_URL)

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "models_loaded": 5}


def test_prediction_returns_503_when_the_general_model_is_missing(client, fake_models):
    fake_models.pop("general")

    response = client.post(
        "/api/v1/predict", files={"file": ("sample.png", make_png(32, 32), "image/png")},
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "Prediction models are not loaded."}


def test_missing_checkpoint_files_do_not_crash_the_service(monkeypatch, tmp_path):
    monkeypatch.setattr(PredictionService, "_load_all_models", REAL_LOAD_ALL_MODELS)
    for model_key in ModelConfig.MODELS:
        monkeypatch.setitem(ModelConfig.MODELS[model_key], "path", str(tmp_path / f"{model_key}.pt"))

    service = PredictionService()

    assert service.models == {}
    assert service.is_ready is False
