"""
Domain errors mapped to HTTP status codes by the routers
"""

from fastapi import status


class InvalidImageError(ValueError):
    """The uploaded file cannot be classified (400) or is too large (413)."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.status_code = status_code


class ModelsUnavailableError(RuntimeError):
    """The general model is not loaded, so no prediction can run (503)."""

    def __init__(self, message: str = "Prediction models are not loaded."):
        super().__init__(message)
