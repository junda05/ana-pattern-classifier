"""
FastAPI application factory
"""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.security import get_api_key
from app.routers import health, prediction
from app.services.prediction_service import get_prediction_service

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configure_logging(level: str) -> None:
    """
    Send the application's log records (loggers under "app") to stderr at `level`
    """
    app_logger = logging.getLogger("app")
    app_logger.setLevel(level)
    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        app_logger.addHandler(handler)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the checkpoints at startup so the first request does not pay for it
    get_prediction_service()
    yield


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application
    """
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        description="Hierarchical ANA pattern classification of HEp-2 IIF images using YOLOv8",
        version="1.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan,
    )

    # Browsers are only allowed from explicitly configured origins. Clients authenticate
    # with a Bearer API key, never with cookies, so credentials are not allowed.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Health checks are unauthenticated so orchestrators can probe the service
    app.include_router(health.router, prefix="/api/v1")

    # Every prediction route requires a valid API key
    app.include_router(
        prediction.router,
        prefix="/api/v1",
        dependencies=[Depends(get_api_key)]
    )

    return app
