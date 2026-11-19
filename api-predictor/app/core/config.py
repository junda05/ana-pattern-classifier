"""
Application settings
"""

import json
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# A list read from an environment variable, comma-separated ("a, b") or as a JSON list
CommaSeparatedList = Annotated[list[str], NoDecode]


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and .env
    """

    # Unknown keys (e.g. from an older .env) are ignored instead of failing startup
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ANA Pattern Classifier - Prediction API"
    # When true, /docs, /redoc and /openapi.json are served
    debug: bool = False

    # API keys accepted as Bearer tokens (comma-separated); empty rejects every request
    api_keys: CommaSeparatedList = []

    # Browser origins allowed by CORS (comma-separated); empty allows none (server-to-server only)
    allowed_origins: CommaSeparatedList = []

    # When false, only the general-level model is used
    enable_hierarchical_classification: bool = True

    # Logging level of the application loggers
    log_level: Literal["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"] = "INFO"

    # Uploads
    max_file_size: int = 10 * 1024 * 1024  # 10 MB
    max_image_pixels: int = 50_000_000  # width x height, checked before decoding
    allowed_extensions: list[str] = [".jpg", ".jpeg", ".png", ".bmp", ".tiff"]

    @field_validator("api_keys", "allowed_origins", mode="before")
    @classmethod
    def _split_comma_separated(cls, value: object) -> object:
        if isinstance(value, str) and value.strip().startswith("["):
            # A JSON list; malformed JSON or non-string items fail validation at startup
            return json.loads(value)
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("log_level", mode="before")
    @classmethod
    def _uppercase_log_level(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value


@lru_cache
def get_settings() -> Settings:
    """
    Return the cached Settings singleton
    """
    return Settings()
