import html
import secrets

from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import require_owner
from app.models import User
from app.schemas import UserOut
from app.security import create_token
from app.services.brain_calendar import (
    CALENDAR_SCOPE,
    calendar_scope_granted,
    connection_status as calendar_connection_status,
    delete_credential as delete_calendar_credential,
    encryption_configured,
    save_credential as save_calendar_credential,
)
from app.services.brain_gmail import (
    GMAIL_SCOPE,
    connection_status as gmail_connection_status,
    delete_credential as delete_gmail_credential,
    gmail_scope_granted,
    save_credential as save_gmail_credential,
)

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


def _disclosure_page(kind: str, csrf_token: str) -> HTMLResponse:
    is_gmail = kind == "gmail"
    source = "Gmail messages" if is_gmail else "Google Calendar events"
    detail = (
        "Search initially returns bounded headers and snippets. A full email body is retrieved "
        "only when needed; attachments are never accessed."
        if is_gmail
        else "Brain can list calendars, read bounded event ranges, and inspect free/busy intervals."
    )
    extra_safeguards = (
        "<li>Credential-like values, one-time codes, sensitive links, and financial identifiers "
        "are redacted before message content reaches the model.</li>"
        "<li>Replies derived from Gmail are shown live but are not retained in Brain chat "
        "history.</li>"
        if is_gmail
        else "<li>Calendar text and links are treated as untrusted data and never as instructions.</li>"
    )
    privacy_path = "/auth/google/privacy"
    body = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Connect {html.escape(source)}</title>
<style>
body{{font:16px/1.55 system-ui,sans-serif;max-width:680px;margin:64px auto;padding:0 24px;color:#18181b}}
h1{{font-size:28px}} .box{{border:1px solid #d4d4d8;border-radius:12px;padding:20px;margin:24px 0}}
button{{background:#18181b;color:white;border:0;border-radius:8px;padding:12px 18px;font-weight:650}}
a{{color:#6d28d9}} li{{margin:8px 0}}
</style></head><body>
<h1>Connect {html.escape(source)} to Brain</h1>
<p>{html.escape(detail)}</p>
<div class="box"><strong>Before you continue</strong><ul>
<li>Access is read-only. Brain cannot create, send, modify, delete, archive, or label anything.</li>
<li>Only information needed for your question is sent to OpenRouter and the selected model.</li>
<li>Model routing is restricted to zero-data-retention providers that do not collect prompts.</li>
{extra_safeguards}
<li>You can disconnect this integration at any time.</li>
</ul></div>
<form method="post" action="/auth/google/{html.escape(kind)}/connect">
<input type="hidden" name="consent_token" value="{html.escape(csrf_token)}">
<p><label><input type="checkbox" name="acknowledge" value="yes" required>
I understand and consent to this use of my Google data.</label></p>
<button type="submit">Continue to Google</button>
</form>
<p><a href="{privacy_path}">Google data privacy and Limited Use disclosure</a> ·
<a href="{html.escape(settings.frontend_origin.rstrip('/'))}/brain">Cancel</a></p>
</body></html>"""
    return HTMLResponse(
        body,
        headers={
            "Content-Security-Policy": (
                "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
            ),
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


def _new_consent(request: Request, kind: str) -> str:
    token = secrets.token_urlsafe(32)
    request.session[f"google_{kind}_consent"] = token
    return token


def _consume_consent(request: Request, kind: str, supplied: str, acknowledged: str) -> None:
    expected = str(request.session.pop(f"google_{kind}_consent", ""))
    if acknowledged != "yes" or not expected or not secrets.compare_digest(expected, supplied):
        raise HTTPException(status_code=400, detail="Google data consent expired; start again")
    if not encryption_configured():
        raise HTTPException(status_code=503, detail="Google token encryption is not configured")


@router.get("/google/privacy", response_class=HTMLResponse)
async def google_data_privacy():
    """Public disclosure URL suitable for the Google OAuth consent screen."""
    return HTMLResponse(
        """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>Google Data Privacy</title></head>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:64px auto;padding:0 24px">
<h1>Google data privacy</h1>
<p>colehenry is a single-owner personal assistant. Google Calendar and Gmail access is optional,
read-only, and used solely to answer the owner's explicit questions.</p>
<p>Only bounded, relevant data is sent to OpenRouter and the selected model. Requests containing
Google data are restricted to zero-data-retention providers that do not collect prompts. Gmail
attachments are not accessed, high-risk secrets are redacted, and Gmail-derived assistant replies
are not retained in chat history. OAuth refresh tokens are encrypted with a dedicated server key.</p>
<p>No Google data is sold, used for advertising, credit decisions, or used to train or improve a
general-purpose AI model. The use of information received from Google Workspace APIs adheres to
the Google API Services User Data Policy, including the Limited Use requirements.</p>
<p>The owner can disconnect Calendar or Gmail from the application at any time, which deletes the
stored credential.</p></body></html>""",
        headers={
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    )


@router.get("/google/calendar/connect", response_class=HTMLResponse)
async def google_calendar_disclosure(request: Request, user: User = Depends(require_owner)):
    return _disclosure_page("calendar", _new_consent(request, "calendar"))


@router.post("/google/calendar/connect")
async def google_calendar_connect(
    request: Request,
    consent_token: str = Form(...),
    acknowledge: str = Form(...),
    user: User = Depends(require_owner),
):
    """One-time incremental consent for offline, read-only Calendar access."""
    _consume_consent(request, "calendar", consent_token, acknowledge)
    request.session.pop("google_gmail_connect", None)
    request.session["google_calendar_connect"] = True
    return await oauth.google.authorize_redirect(
        request,
        settings.oauth_redirect_uri,
        scope=f"openid email profile {CALENDAR_SCOPE}",
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        login_hint=user.email,
    )


@router.get("/google/gmail/connect", response_class=HTMLResponse)
async def google_gmail_disclosure(request: Request, user: User = Depends(require_owner)):
    return _disclosure_page("gmail", _new_consent(request, "gmail"))


@router.post("/google/gmail/connect")
async def google_gmail_connect(
    request: Request,
    consent_token: str = Form(...),
    acknowledge: str = Form(...),
    user: User = Depends(require_owner),
):
    """One-time offline consent for Gmail reads, isolated from Calendar."""
    _consume_consent(request, "gmail", consent_token, acknowledge)
    request.session.pop("google_calendar_connect", None)
    request.session["google_gmail_connect"] = True
    return await oauth.google.authorize_redirect(
        request,
        settings.oauth_redirect_uri,
        scope=f"openid email profile {GMAIL_SCOPE}",
        access_type="offline",
        prompt="consent",
        login_hint=user.email,
    )


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    calendar_connect = bool(request.session.pop("google_calendar_connect", False))
    gmail_connect = bool(request.session.pop("google_gmail_connect", False))
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        raise HTTPException(status_code=400, detail="OAuth flow failed")

    userinfo = token.get("userinfo") or {}
    email = (userinfo.get("email") or "").lower()

    # Ordinary sign-in permits the owner plus Cambio-only hosts. Incremental
    # Calendar/Gmail authorization always remains owner-only.
    is_owner = email == settings.owner_email.lower()
    is_cambio_host = email in settings.cambio_host_email_set
    owner_integration = calendar_connect or gmail_connect
    if not email or (owner_integration and not is_owner) or not (
        is_owner or is_cambio_host
    ):
        raise HTTPException(status_code=403, detail="Account not authorized")
    if userinfo.get("email_verified") is False:
        raise HTTPException(status_code=403, detail="Email not verified")

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None:
        user = User(email=email)
        db.add(user)
        db.commit()

    if calendar_connect:
        scopes = token.get("scope") or []
        if not calendar_scope_granted(scopes):
            raise HTTPException(status_code=400, detail="Calendar read access was not granted")
        refresh_token = str(token.get("refresh_token") or "")
        if refresh_token:
            save_calendar_credential(db, user, refresh_token, scopes)
        elif not calendar_connection_status(db)["connected"]:
            raise HTTPException(
                status_code=400,
                detail="Google did not return an offline Calendar token; reconnect and consent again",
            )

    if gmail_connect:
        scopes = token.get("scope") or []
        if not gmail_scope_granted(scopes):
            raise HTTPException(status_code=400, detail="Gmail read access was not granted")
        refresh_token = str(token.get("refresh_token") or "")
        if refresh_token:
            save_gmail_credential(db, user, refresh_token, scopes)
        elif not gmail_connection_status(db)["connected"]:
            raise HTTPException(
                status_code=400,
                detail="Google did not return an offline Gmail token; reconnect and consent again",
            )

    destination = (
        f"{settings.frontend_origin.rstrip('/')}/brain?calendar=connected"
        if calendar_connect
        else (
            f"{settings.frontend_origin.rstrip('/')}/brain?gmail=connected"
            if gmail_connect
            else (
                settings.frontend_origin
                if is_owner
                else f"{settings.frontend_origin.rstrip('/')}/cambio"
            )
        )
    )
    response = RedirectResponse(url=destination)
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


@router.get("/google/calendar/status")
async def google_calendar_status(
    user: User = Depends(require_owner), db: Session = Depends(get_db)
):
    return calendar_connection_status(db)


@router.delete("/google/calendar")
async def google_calendar_disconnect(
    user: User = Depends(require_owner), db: Session = Depends(get_db)
):
    return {"disconnected": delete_calendar_credential(db, user)}


@router.get("/google/gmail/status")
async def google_gmail_status(
    user: User = Depends(require_owner), db: Session = Depends(get_db)
):
    return gmail_connection_status(db)


@router.delete("/google/gmail")
async def google_gmail_disconnect(
    user: User = Depends(require_owner), db: Session = Depends(get_db)
):
    return {"disconnected": delete_gmail_credential(db, user)}
