"""Patch creation: 640 px windows with 40 % overlap (step 384); remainders dropped; small images resized."""

import asyncio
import tempfile

import cv2
import numpy as np
import pytest

from tests.fakes import make_png

PATCH = 640
STEP = 384  # int(640 * (1 - 0.4))


def numbered_image(width: int, height: int) -> np.ndarray:
    """Grayscale image whose pixels identify their position (modulo 251)."""
    return (np.arange(width * height) % 251).reshape(height, width).astype(np.uint8)


def test_1280x960_gives_two_patches_and_drops_the_right_and_bottom_remainders(service):
    image = numbered_image(1280, 960)

    patches = service._create_patches(image)

    # Rows: y in {0} (0 + 640 <= 960 but 384 + 640 > 960); columns: x in {0, 384}
    assert len(patches) == 2
    np.testing.assert_array_equal(patches[0], image[0:640, 0:640])
    np.testing.assert_array_equal(patches[1], image[0:640, 384:1024])

    # Pixels right of x = 1024 and below y = 640 are never part of a patch
    marked = np.zeros((960, 1280), dtype=np.uint8)
    marked[640:, :] = 255
    marked[:, 1024:] = 255
    assert all(p.max() == 0 for p in service._create_patches(marked))


@pytest.mark.parametrize(
    ("width", "height", "expected_count"),
    [
        (640, 640, 1),     # exact fit, no resize
        (1024, 640, 2),    # x in {0, 384}
        (1280, 960, 2),
        (2048, 1536, 12),  # y in {0, 384, 768} x x in {0, 384, 768, 1152}
    ],
)
def test_patch_count_follows_the_384_pixel_step(service, width, height, expected_count):
    patches = service._create_patches(numbered_image(width, height))

    rows = len(range(0, height - PATCH + 1, STEP))
    columns = len(range(0, width - PATCH + 1, STEP))
    assert len(patches) == rows * columns == expected_count
    assert all(p.shape == (PATCH, PATCH) for p in patches)


def test_exact_640_image_is_used_as_is(service):
    image = numbered_image(640, 640)

    (patch,) = service._create_patches(image)

    np.testing.assert_array_equal(patch, image)


@pytest.mark.parametrize(("width", "height"), [(500, 500), (500, 1000), (1000, 500)])
def test_image_smaller_than_a_patch_is_resized_to_a_single_patch(service, width, height):
    patches = service._create_patches(numbered_image(width, height))

    assert len(patches) == 1
    assert patches[0].shape == (PATCH, PATCH)


def test_prediction_classifies_every_patch_of_the_uploaded_image(service, fake_models):
    result = asyncio.run(service.predict_image(make_png(1280, 960, value=80), "sample.png"))

    assert result["patch_statistics"]["total_patches"] == 2
    assert fake_models["general"].calls == 2


def test_patch_prediction_removes_its_temporary_file(service, monkeypatch, tmp_path):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))

    service._predict_patch(np.zeros((PATCH, PATCH), dtype=np.uint8), "general")

    assert list(tmp_path.iterdir()) == []


def test_no_temporary_file_is_left_when_writing_the_patch_raises(service, monkeypatch, tmp_path):
    def broken_imwrite(path, image):
        raise RuntimeError("disk full")

    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    monkeypatch.setattr(cv2, "imwrite", broken_imwrite)

    with pytest.raises(RuntimeError):
        service._predict_patch(np.zeros((PATCH, PATCH), dtype=np.uint8), "general")

    assert list(tmp_path.iterdir()) == []


def test_a_patch_that_cannot_be_written_is_an_error(service, monkeypatch, tmp_path):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    monkeypatch.setattr(cv2, "imwrite", lambda path, image: False)

    with pytest.raises(ValueError, match="temporary file"):
        service._predict_patch(np.zeros((PATCH, PATCH), dtype=np.uint8), "general")

    assert list(tmp_path.iterdir()) == []


def test_three_channel_input_is_converted_to_grayscale_patches(service):
    rgb = np.zeros((640, 640, 3), dtype=np.uint8)
    rgb[..., 1] = 200

    (patch,) = service._create_patches(rgb)

    assert patch.shape == (PATCH, PATCH)
    assert patch.ndim == 2
