"""
API key authentication
"""

import hmac
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

# auto_error=False: a missing header must produce our 401, not FastAPI's default 403
security = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_api_key(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> str:
    """
    Validate the API key sent in the Authorization header

    Args:
        credentials: Bearer credentials from the Authorization header, if any

    Returns:
        str: The valid API key

    Raises:
        HTTPException: 401 if the API key is missing or invalid. An empty
            API_KEYS setting rejects every request.
    """
    if credentials is None:
        raise _unauthorized("API key required.")

    provided = credentials.credentials.encode()
    # Compare against every configured key so timing does not reveal which one matched
    matches = [hmac.compare_digest(provided, key.encode()) for key in get_settings().api_keys]

    if not any(matches):
        raise _unauthorized("Invalid API key.")

    return credentials.credentials
