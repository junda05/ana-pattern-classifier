"""
Router for image prediction endpoints
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.errors import InvalidImageError, ModelsUnavailableError
from app.services.prediction_service import PredictionService, get_prediction_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=dict[str, Any])
async def predict_image(
    file: Annotated[UploadFile, File(description="Image to classify")],
    prediction_service: Annotated[PredictionService, Depends(get_prediction_service)],
) -> JSONResponse:
    """
    Run a prediction on an uploaded image

    Args:
        file: Image file (JPG, PNG, BMP, TIFF)

    Returns:
        JSONResponse with the prediction result

    Raises:
        HTTPException: 400 for an unsupported, empty or undecodable file, 413 for a
            file above the size limit, 503 when the models are not loaded, 500 for an
            unexpected failure
    """
    settings = get_settings()

    # Validate the file extension
    if file.filename:
        file_extension = "." + file.filename.split(".")[-1].lower()
        if file_extension not in settings.allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension not allowed. Use: {', '.join(settings.allowed_extensions)}."
            )

    # Validate the content type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file must be an image."
        )

    try:
        # Read at most one byte over the limit: enough to reject the file without buffering all of it
        image_data = await file.read(settings.max_file_size + 1)
        result = await prediction_service.predict_image(image_data, file.filename or "unknown")
    except InvalidImageError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    except ModelsUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unexpected failure while predicting an image")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error."
        ) from error

    if result.get("status") == "error":
        # The reason is logged by the service; it is not echoed to the client
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction failed."
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=result
    )
