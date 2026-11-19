"""Response fields of a hierarchical prediction: prediction_key, level and English notes."""

import pytest
from fastapi.testclient import TestClient

from app.core.app import create_app
from tests.conftest import AUTH_HEADERS
from tests.fakes import make_png, probability_vector

PREDICT_URL = "/api/v1/predict"


def predict(client) -> dict:
    response = client.post(
        PREDICT_URL, files={"file": ("sample.png", make_png(32, 32, value=120), "image/png")},
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_prediction_key_is_the_raw_class_key_of_the_final_result(client, fake_models):
    fake_models["general"].script(probability_vector("general", NUCLEAR=0.95))
    fake_models["nuclear_competent"].script(probability_vector("nuclear_competent", NUCLEAR_HOMOGENEOUS=0.95))

    body = predict(client)

    assert body["prediction_key"] == "NUCLEAR_HOMOGENEOUS"
    assert body["prediction"] == "Nuclear Homogeneous"
    assert body["classification_level"] == "competent"


def test_low_confidence_competent_result_falls_back_to_general_with_an_english_note(client, fake_models):
    fake_models["general"].script(probability_vector("general", NUCLEAR=0.95))
    # One patch: final confidence = 0.6 + 0.4 * 0.45 = 0.78, below the 0.80 competent threshold
    fake_models["nuclear_competent"].script(probability_vector("nuclear_competent", NUCLEAR_HOMOGENEOUS=0.45))

    body = predict(client)

    assert body["prediction_key"] == "NUCLEAR"
    assert body["prediction"] == "Nuclear"
    assert body["classification_level"] == "general"
    assert "competent level" in body["note"]
    assert "ClassificationLevel" not in body["note"]


def test_missing_next_level_model_note_uses_the_level_value(client, fake_models):
    fake_models["general"].script(probability_vector("general", CYTOPLASMIC=0.95))
    fake_models.pop("cytoplasmic_competent")

    body = predict(client)

    assert body["prediction_key"] == "CYTOPLASMIC"
    assert body["classification_level"] == "general"
    assert body["note"] == "No competent model is available for this class"


def test_error_at_competent_level_note_uses_the_level_value(client, fake_models):
    class BrokenModel:
        def __call__(self, source, verbose=False):
            raise RuntimeError("inference failed")

    fake_models["general"].script(probability_vector("general", NUCLEAR=0.95))
    fake_models["nuclear_competent"] = BrokenModel()

    body = predict(client)

    assert body["prediction_key"] == "NUCLEAR"
    assert body["classification_level"] == "general"
    assert body["note"] == "Error at competent level; classified at general level"


def test_error_at_expert_level_keeps_the_competent_result_without_the_exception_text(client, fake_models):
    class BrokenModel:
        def __call__(self, source, verbose=False):
            raise RuntimeError("inference failed")

    fake_models["general"].script(probability_vector("general", NUCLEAR=0.95))
    fake_models["nuclear_competent"].script(probability_vector("nuclear_competent", NUCLEOLAR=0.95))
    fake_models["nucleolar_expert"] = BrokenModel()

    body = predict(client)

    assert body["prediction_key"] == "NUCLEOLAR"
    assert body["classification_level"] == "competent"
    assert body["note"] == "Error at expert level; classified at competent level"


@pytest.mark.parametrize("general_class", ["NUCLEAR", "NEGATIVE"])
def test_legacy_general_only_mode_also_returns_prediction_key(fake_models, monkeypatch, general_class):
    monkeypatch.setenv("ENABLE_HIERARCHICAL_CLASSIFICATION", "false")
    fake_models["general"].script(probability_vector("general", **{general_class: 0.95}))

    with TestClient(create_app()) as client:
        body = predict(client)

    assert body["prediction_key"] == general_class
    assert "classification_level" not in body
