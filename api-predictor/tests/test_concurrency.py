"""The event loop stays responsive during inference, and the shared service is built once."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor

from app.services.prediction_service import PredictionService, get_prediction_service
from tests.conftest import AUTH_HEADERS
from tests.fakes import FakeModel, default_vector, make_png


class BlockingModel(FakeModel):
    """Fake model that holds inference until the test releases it."""

    def __init__(self, probabilities):
        super().__init__(probabilities)
        self.started = threading.Event()
        self.release = threading.Event()

    def __call__(self, source, verbose=False):
        self.started.set()
        self.release.wait(timeout=10)
        return super().__call__(source, verbose)


def test_health_answers_while_a_prediction_is_running(client, fake_models):
    blocking = BlockingModel(default_vector("general"))
    fake_models["general"] = blocking
    upload = {"file": ("sample.png", make_png(32, 32), "image/png")}

    with ThreadPoolExecutor(max_workers=2) as pool:
        prediction = pool.submit(client.post, "/api/v1/predict", files=upload, headers=AUTH_HEADERS)
        try:
            assert blocking.started.wait(timeout=5)
            health = pool.submit(client.get, "/api/v1/health").result(timeout=2)
            assert health.status_code == 200
        finally:
            blocking.release.set()
        assert prediction.result(timeout=10).status_code == 200


def test_concurrent_first_calls_build_the_service_once(monkeypatch, fake_models):
    built = []

    def slow_load(self):
        built.append(self)
        time.sleep(0.2)
        self.models = fake_models

    monkeypatch.setattr(PredictionService, "_load_all_models", slow_load)

    with ThreadPoolExecutor(max_workers=4) as pool:
        services = list(pool.map(lambda _: get_prediction_service(), range(4)))

    assert len(built) == 1
    assert all(service is services[0] for service in services)
