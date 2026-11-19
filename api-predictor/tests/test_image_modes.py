"""Image modes are normalised before preprocessing, so CLAHE always reads the green channel.

Each test compares the patches of an image with those of its RGB (or L) equivalent.
"""

import io

import numpy as np
import pytest
from PIL import Image

from app.core.errors import InvalidImageError
from tests.conftest import AUTH_HEADERS


def distinct_channel_rgb(width: int = 64, height: int = 48) -> Image.Image:
    """RGB image whose red, green and blue channels all differ."""
    y, x = np.mgrid[0:height, 0:width]
    red = (x * 4) % 256
    green = (y * 5 + (x // 8) * 30) % 256
    blue = ((x + y) % 2) * 200
    return Image.fromarray(np.stack([red, green, blue], axis=-1).astype(np.uint8), mode="RGB")


def encode(image: Image.Image, image_format: str = "PNG") -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=image_format)
    return buffer.getvalue()


def assert_same_patches(service, data: bytes, equivalent: bytes) -> None:
    actual, expected = service._preprocess(data), service._preprocess(equivalent)
    assert len(actual) == len(expected)
    for actual_patch, expected_patch in zip(actual, expected, strict=True):
        np.testing.assert_array_equal(actual_patch, expected_patch)


def test_palette_image_is_preprocessed_like_its_rgb_equivalent(service):
    palette = distinct_channel_rgb().convert("P", palette=Image.Palette.ADAPTIVE, colors=64)

    assert_same_patches(service, encode(palette), encode(palette.convert("RGB")))


def test_palette_image_with_transparency_is_preprocessed_like_its_rgb_equivalent(service):
    palette = distinct_channel_rgb().convert("P", palette=Image.Palette.ADAPTIVE, colors=64)
    palette.info["transparency"] = 0
    data = encode(palette)
    assert "transparency" in Image.open(io.BytesIO(data)).info

    assert_same_patches(service, data, encode(palette.convert("RGB")))


def test_cmyk_image_is_preprocessed_like_its_rgb_equivalent(service):
    cmyk = distinct_channel_rgb().convert("CMYK")
    rgb_equivalent = cmyk.convert("RGB")
    # Channel 1 of CMYK is magenta, not green: reading it would be wrong
    assert not np.array_equal(np.array(cmyk)[..., 1], np.array(rgb_equivalent)[..., 1])

    assert_same_patches(service, encode(cmyk, "TIFF"), encode(rgb_equivalent))


def test_rgba_image_is_preprocessed_like_rgb_without_alpha(service):
    rgb = distinct_channel_rgb()
    rgba = rgb.copy()
    rgba.putalpha(Image.fromarray((np.arange(64 * 48) % 256).reshape(48, 64).astype(np.uint8)))

    assert_same_patches(service, encode(rgba), encode(rgb))


def test_grayscale_with_alpha_uses_the_luminance_not_the_alpha(service):
    gray = distinct_channel_rgb().convert("L")
    with_alpha = gray.copy()
    with_alpha.putalpha(Image.fromarray(np.full((48, 64), 30, dtype=np.uint8)))
    assert with_alpha.getbands() == ("L", "A")

    assert_same_patches(service, encode(with_alpha), encode(gray))


def test_bilevel_image_is_preprocessed_like_its_grayscale_equivalent(service):
    bilevel = distinct_channel_rgb().convert("1")

    assert_same_patches(service, encode(bilevel), encode(bilevel.convert("L")))


@pytest.mark.parametrize(
    ("mode", "expected"),
    [("1", "L"), ("P", "RGB"), ("PA", "RGB"), ("RGBA", "RGB"), ("RGBX", "RGB"),
     ("CMYK", "RGB"), ("YCbCr", "RGB"), ("HSV", "RGB"), ("LAB", "RGB")],
)
def test_modes_are_normalised_to_rgb_or_grayscale(service, mode, expected):
    assert service._normalize_mode(Image.new(mode, (8, 8))).mode == expected


def test_grey_with_alpha_becomes_grayscale(service):
    image = Image.new("L", (8, 8))
    image.putalpha(128)

    assert service._normalize_mode(image).mode == "L"


@pytest.mark.parametrize("mode", ["RGB", "L", "I;16"])
def test_rgb_and_single_band_images_are_left_untouched(service, mode):
    image = Image.new(mode, (8, 8))

    assert service._normalize_mode(image) is image


@pytest.mark.parametrize("mode", ["I", "F"])
def test_32bit_modes_are_rejected_as_invalid_input(service, mode):
    image = Image.new(mode, (8, 8))

    with pytest.raises(InvalidImageError) as error:
        service._normalize_mode(image)

    assert error.value.status_code == 400
    assert str(error.value) == "Unsupported image mode."


def test_mode_that_cannot_be_converted_is_rejected_as_invalid_input(service, monkeypatch):
    def unsupported(self, mode=None, *args, **kwargs):
        raise ValueError(f"conversion from {self.mode} to {mode} not supported")

    monkeypatch.setattr(Image.Image, "convert", unsupported)

    with pytest.raises(InvalidImageError) as error:
        service._normalize_mode(Image.new("CMYK", (8, 8)))

    assert error.value.status_code == 400
    assert str(error.value) == "Unsupported image mode."


def test_cmyk_tiff_upload_is_classified(client):
    data = encode(distinct_channel_rgb().convert("CMYK"), "TIFF")

    response = client.post(
        "/api/v1/predict", files={"file": ("sample.tiff", data, "image/tiff")}, headers=AUTH_HEADERS
    )

    assert response.status_code == 200, response.text


@pytest.mark.parametrize("mode", ["I", "F"])
def test_32bit_image_upload_returns_400(client, mode):
    # TIFF, not PNG: Pillow silently turns an "I" image into "I;16" when saving
    # as PNG, and refuses to save "F" as PNG at all, so neither would reach the
    # service in the mode this test targets.
    data = encode(distinct_channel_rgb().convert("L").convert(mode), "TIFF")

    response = client.post(
        "/api/v1/predict", files={"file": ("sample.tiff", data, "image/tiff")}, headers=AUTH_HEADERS
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Unsupported image mode."}


def test_i16_tiff_upload_is_still_classified(client):
    image = distinct_channel_rgb().convert("L")
    sixteen_bit = np.array(image).astype(np.uint16) * 257  # spread 8-bit values across the 16-bit range
    data = encode(Image.fromarray(sixteen_bit, mode="I;16"), "TIFF")

    response = client.post(
        "/api/v1/predict", files={"file": ("sample.tiff", data, "image/tiff")}, headers=AUTH_HEADERS
    )

    assert response.status_code == 200, response.text
