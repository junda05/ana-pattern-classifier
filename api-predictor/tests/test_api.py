"""HTTP contract of POST /api/v1/predict: authentication, upload validation, settings and CORS."""

import io

import pytest
from PIL import Image
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from tests.conftest import AUTH_HEADERS
from tests.fakes import make_png

PREDICT_URL = "/api/v1/predict"
TEN_MEGABYTES = 10 * 1024 * 1024


def png_upload(data: bytes | None = None, filename: str = "sample.png", content_type: str = "image/png"):
    return {"file": (filename, data if data is not None else make_png(32, 32, value=120), content_type)}


# --- Authentication -------------------------------------------------------------------------------


def test_missing_authorization_header_returns_401(client):
    response = client.post(PREDICT_URL, files=png_upload())

    assert response.status_code == 401
    assert response.json() == {"detail": "API key required."}
    assert response.headers["www-authenticate"] == "Bearer"


def test_wrong_api_key_returns_401(client):
    response = client.post(PREDICT_URL, files=png_upload(), headers={"Authorization": "Bearer wrong-key"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid API key."}


def test_non_bearer_authorization_scheme_is_treated_as_missing(client):
    response = client.post(PREDICT_URL, files=png_upload(), headers={"Authorization": "Basic dGVzdC1rZXk="})

    assert response.status_code == 401
    assert response.json() == {"detail": "API key required."}


@pytest.mark.parametrize("configured", ["", " ", " , "])
def test_empty_api_keys_setting_rejects_every_key(client, monkeypatch, configured):
    monkeypatch.setenv("API_KEYS", configured)
    get_settings.cache_clear()

    for key in ["test-key", "", " "]:
        response = client.post(PREDICT_URL, files=png_upload(), headers={"Authorization": f"Bearer {key}"})
        assert response.status_code == 401, key


def test_comma_separated_api_keys_are_each_accepted(client, monkeypatch):
    monkeypatch.setenv("API_KEYS", "first-key, second-key")
    get_settings.cache_clear()

    for key in ["first-key", "second-key"]:
        response = client.post(PREDICT_URL, files=png_upload(), headers={"Authorization": f"Bearer {key}"})
        assert response.status_code == 200, key

    response = client.post(PREDICT_URL, files=png_upload(), headers={"Authorization": "Bearer first-key,"})
    assert response.status_code == 401


def test_api_keys_are_compared_in_constant_time(client, monkeypatch):
    import app.core.security as security

    compared = []
    real_compare = security.hmac.compare_digest

    def spy(a, b):
        compared.append((a, b))
        return real_compare(a, b)

    monkeypatch.setattr(security.hmac, "compare_digest", spy)

    response = client.post(PREDICT_URL, files=png_upload(), headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert compared, "API keys must be compared with hmac.compare_digest"


# --- Upload validation ----------------------------------------------------------------------------


def test_text_file_upload_returns_400(client):
    response = client.post(
        PREDICT_URL, files=png_upload(b"hello", filename="notes.txt", content_type="text/plain"),
        headers=AUTH_HEADERS,
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "File extension not allowed. Use: .jpg, .jpeg, .png, .bmp, .tiff."}


def test_non_image_content_type_returns_400(client):
    response = client.post(
        PREDICT_URL, files=png_upload(content_type="application/octet-stream"), headers=AUTH_HEADERS
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "The file must be an image."}


def test_empty_file_returns_400(client):
    response = client.post(PREDICT_URL, files=png_upload(b""), headers=AUTH_HEADERS)

    assert response.status_code == 400
    assert response.json() == {"detail": "The file is empty."}


def test_bytes_that_are_not_an_image_return_400(client):
    response = client.post(PREDICT_URL, files=png_upload(b"definitely not a PNG"), headers=AUTH_HEADERS)

    assert response.status_code == 400
    assert response.json() == {"detail": "The file is not a valid image."}


def test_truncated_png_returns_400(client):
    truncated = make_png(64, 64, value=90)[:-40]

    response = client.post(PREDICT_URL, files=png_upload(truncated), headers=AUTH_HEADERS)

    assert response.status_code == 400
    assert response.json() == {"detail": "The file is not a valid image."}


def test_file_larger_than_10_megabytes_returns_413(client):
    response = client.post(PREDICT_URL, files=png_upload(b"\0" * (TEN_MEGABYTES + 1)), headers=AUTH_HEADERS)

    assert response.status_code == 413
    assert response.json() == {"detail": "The file exceeds the maximum size of 10 MB."}


def bilevel_png(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("1", (width, height), 1).save(buffer, format="PNG")
    return buffer.getvalue()


def test_bilevel_png_is_classified(client):
    response = client.post(PREDICT_URL, files=png_upload(bilevel_png(32, 32)), headers=AUTH_HEADERS)

    assert response.status_code == 200, response.text


@pytest.mark.parametrize("side", [8000, 14000])
def test_image_above_the_pixel_limit_returns_413(client, side):
    response = client.post(PREDICT_URL, files=png_upload(bilevel_png(side, side)), headers=AUTH_HEADERS)

    assert response.status_code == 413
    assert response.json() == {"detail": "The image exceeds the maximum of 50,000,000 pixels."}


def test_oversized_upload_is_not_read_beyond_the_limit(client, service, monkeypatch):
    received = []

    async def record(image_data, filename):
        received.append(len(image_data))
        return {"status": "success"}

    monkeypatch.setattr(service, "predict_image", record)

    client.post(PREDICT_URL, files=png_upload(b"\0" * (TEN_MEGABYTES + 100)), headers=AUTH_HEADERS)

    assert received == [TEN_MEGABYTES + 1]


def test_valid_png_returns_a_prediction(client):
    response = client.post(PREDICT_URL, files=png_upload(), headers=AUTH_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["prediction"] == "Negative"
    assert body["classification_level"] == "general"
    assert set(body["class_probabilities"]) == {"CYTOPLASMIC", "MITOTIC", "NEGATIVE", "NUCLEAR"}


# --- Server errors ---------------------------------------------------------------------------------


def test_failed_classification_returns_500_without_internal_details(client, fake_models):
    class BrokenModel:
        def __call__(self, source, verbose=False):
            raise RuntimeError("inference failed")

    fake_models["general"] = BrokenModel()

    response = client.post(PREDICT_URL, files=png_upload(), headers=AUTH_HEADERS)

    assert response.status_code == 500
    assert response.json() == {"detail": "Prediction failed."}


def test_unexpected_failure_returns_a_generic_500(client, service, monkeypatch):
    async def explode(image_data, filename):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(service, "predict_image", explode)

    response = client.post(PREDICT_URL, files=png_upload(), headers=AUTH_HEADERS)

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error."}


# --- Settings and CORS ----------------------------------------------------------------------------


def test_settings_ignore_unknown_keys_in_env_file(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        'APP_NAME=From file\nALLOWED_HOSTS=["*"]\nSOME_RETIRED_SETTING=1\n', encoding="utf-8"
    )

    settings = Settings(_env_file=env_file)

    assert settings.app_name == "From file"


def test_api_keys_accept_a_json_list(monkeypatch):
    monkeypatch.setenv("API_KEYS", '["one", "two"]')

    assert Settings().api_keys == ["one", "two"]


@pytest.mark.parametrize("value", ['["one", ', "[1, 2]"])
def test_malformed_json_api_keys_fail_at_startup(monkeypatch, value):
    monkeypatch.setenv("API_KEYS", value)

    with pytest.raises(ValidationError):
        Settings()


def test_debug_defaults_to_false_and_hides_the_api_docs(client):
    assert Settings().debug is False
    for path in ["/docs", "/redoc", "/openapi.json"]:
        assert client.get(path).status_code == 404, path


def test_debug_mode_serves_the_api_docs(monkeypatch):
    from fastapi.testclient import TestClient

    from app.core.app import create_app

    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()

    with TestClient(create_app()) as debug_client:
        for path in ["/docs", "/redoc", "/openapi.json"]:
            assert debug_client.get(path).status_code == 200, path


def test_settings_parse_comma_separated_lists(monkeypatch):
    monkeypatch.setenv("API_KEYS", " one , two ,, ")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000, https://lab.example.com")

    settings = Settings()

    assert settings.api_keys == ["one", "two"]
    assert settings.allowed_origins == ["http://localhost:3000", "https://lab.example.com"]


def test_cors_allows_no_browser_origin_by_default(client):
    response = client.options(
        PREDICT_URL,
        headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
    )

    assert "access-control-allow-origin" not in response.headers


def test_cors_allows_only_configured_origins_without_credentials(monkeypatch):
    from fastapi.testclient import TestClient

    from app.core.app import create_app

    monkeypatch.setenv("ALLOWED_ORIGINS", "https://lab.example.com")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        allowed = client.options(
            PREDICT_URL,
            headers={"Origin": "https://lab.example.com", "Access-Control-Request-Method": "POST"},
        )
        denied = client.options(
            PREDICT_URL,
            headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
        )

    assert allowed.headers["access-control-allow-origin"] == "https://lab.example.com"
    assert "access-control-allow-credentials" not in allowed.headers
    assert "access-control-allow-origin" not in denied.headers
