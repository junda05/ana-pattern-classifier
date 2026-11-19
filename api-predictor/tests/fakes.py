"""Test doubles and in-memory inputs.

No test reads a model checkpoint or a real image: `FakeModel` replaces the
ultralytics YOLO classifier with scripted probabilities, and `make_png` builds
tiny images in memory with Pillow.
"""

import io
from collections.abc import Sequence

import numpy as np
from PIL import Image

from app.core.class_mapping import ModelConfig


class FakeTensor:
    """Minimal stand-in for the torch tensors that `_predict_patch` reads."""

    def __init__(self, value):
        self._value = np.asarray(value, dtype=np.float32)

    def cpu(self) -> "FakeTensor":
        return self

    def numpy(self) -> np.ndarray:
        return self._value

    def item(self) -> float:
        return self._value.item()


class FakeProbs:
    """Mimics `ultralytics.engine.results.Probs` (top1, top1conf, data)."""

    def __init__(self, vector: Sequence[float]):
        vector = np.asarray(vector, dtype=np.float32)
        self.top1 = int(np.argmax(vector))
        self.top1conf = FakeTensor(vector[self.top1])
        self.data = FakeTensor(vector)


class FakeResult:
    def __init__(self, vector: Sequence[float]):
        self.probs = FakeProbs(vector)


class FakeModel:
    """Scripted replacement for a YOLOv8 classification model.

    `script` accepts either one probability vector (returned for every patch) or
    a list of vectors returned one per call, cycling.
    """

    def __init__(self, probabilities):
        self.calls = 0
        self.script(probabilities)

    def script(self, probabilities) -> None:
        array = np.asarray(probabilities, dtype=np.float32)
        self._vectors = [array] if array.ndim == 1 else list(array)

    def __call__(self, source, verbose: bool = False) -> list[FakeResult]:
        vector = self._vectors[self.calls % len(self._vectors)]
        self.calls += 1
        return [FakeResult(vector)]

    predict = __call__


def probability_vector(model_key: str, **class_probabilities: float) -> list[float]:
    """Build a probability vector in the model's class-index order.

    Classes that are not named share the remaining probability mass equally.
    """
    classes = ModelConfig.get_model_classes(model_key)
    unknown = set(class_probabilities) - set(classes)
    if unknown:
        raise ValueError(f"Unknown classes for '{model_key}': {sorted(unknown)}")
    remaining = 1.0 - sum(class_probabilities.values())
    unnamed = [name for name in classes if name not in class_probabilities]
    share = remaining / len(unnamed) if unnamed else 0.0
    return [class_probabilities.get(name, share) for name in classes]


def default_vector(model_key: str) -> list[float]:
    """Confident vector used unless a test scripts something else.

    The general model says NEGATIVE, so an unscripted prediction stops at the
    general level; every other model favours its first class.
    """
    if model_key == "general":
        return probability_vector("general", NEGATIVE=0.97)
    first_class = ModelConfig.get_model_classes(model_key)[0]
    return probability_vector(model_key, **{first_class: 0.97})


def make_png(width: int, height: int, value: int = 0) -> bytes:
    """Return the bytes of a solid-colour RGB PNG generated in memory."""
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (value, value, value)).save(buffer, format="PNG")
    return buffer.getvalue()
