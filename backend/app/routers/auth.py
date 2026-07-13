from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import require_owner
from app.models import User
from app.schemas import UserOut
from app.security import create_token

router = APIRouter(prefix="/auth", tags=["auth"])

settings = get_settings()

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@router.get("/google/login")
async def google_login(request: Request):
    return await oauth.google.authorize_redirect(request, settings.oauth_redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        raise HTTPException(status_code=400, detail="OAuth flow failed")

    userinfo = token.get("userinfo") or {}
    email = (userinfo.get("email") or "").lower()

    # The allowlist: exactly one account gets in, and Google must have verified
    # the address (belt-and-suspenders now that /brain hangs off this session).
    if not email or email != settings.owner_email.lower():
        raise HTTPException(status_code=403, detail="Not the owner")
    if userinfo.get("email_verified") is False:
        raise HTTPException(status_code=403, detail="Email not verified")

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(email=email)
        db.add(user)
        db.commit()

    response = RedirectResponse(url=settings.frontend_origin)
    response.set_cookie(
        key=settings.cookie_name,
        value=create_token(email),
        max_age=settings.jwt_expires_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        domain=settings.cookie_domain or None,
        path="/",
    )
    return response


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key=settings.cookie_name,
        domain=settings.cookie_domain or None,
        path="/",
    )
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(require_owner)):
    return user
