"""The test harness itself: fake models are installed and no checkpoint is loaded."""

import sys

from app.core.class_mapping import ModelConfig
from tests.fakes import make_png


def test_service_uses_the_fake_models(service, fake_models):
    assert service.models is fake_models
    assert set(service.models) == set(ModelConfig.MODELS)


def test_ultralytics_is_never_imported(client, service):
    assert "ultralytics" not in sys.modules


def test_make_png_builds_a_decodable_png():
    data = make_png(32, 16, value=200)
    assert data.startswith(b"\x89PNG\r\n\x1a\n")
