"""
Health endpoint (no authentication) used by container orchestration
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.services.prediction_service import PredictionService, get_prediction_service

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(
    prediction_service: Annotated[PredictionService, Depends(get_prediction_service)],
) -> JSONResponse:
    """
    Report whether the service can classify images

    Returns:
        200 {"status": "ok", "models_loaded": n} when the general model is loaded,
        503 {"status": "unavailable", "models_loaded": n} otherwise
    """
    models_loaded = len(prediction_service.models)

    if not prediction_service.is_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable", "models_loaded": models_loaded},
        )

    return JSONResponse(content={"status": "ok", "models_loaded": models_loaded})
