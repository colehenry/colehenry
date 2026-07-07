from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User
from app.security import decode_token


def get_current_email(request: Request) -> str | None:
    """Email from the session cookie, or None if absent/invalid."""
    token = request.cookies.get(get_settings().cookie_name)
    if not token:
        return None
    return decode_token(token)


def require_owner(
    request: Request, db: Session = Depends(get_db)
) -> User:
    """Guard for protected endpoints. 401 unless the cookie holds the owner."""
    email = get_current_email(request)
    if email is None or email.lower() != get_settings().owner_email.lower():
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
