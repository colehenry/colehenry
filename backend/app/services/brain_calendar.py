"""Read-only Google Calendar tools for Brain.

The connector stores only an encrypted refresh token, exchanges it for short-
lived access tokens server-side, bounds all reads, and calls no Calendar write
endpoints. OAuth consent is handled by ``app.routers.auth``.
"""

from datetime import datetime
from urllib.parse import quote

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select

from app.config import get_settings
from app.models import GoogleCalendarCredential, User
from app.services.brain_tool_registry import BrainTool

CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
MAX_CALENDARS = 20
MAX_EVENTS = 50
MAX_EVENT_TEXT_CHARS = 4_000
MAX_ATTENDEES = 20
MAX_RANGE_DAYS = 366


def available() -> bool:
    settings = get_settings()
    return bool(
        settings.google_client_id
        and settings.google_client_secret
        and encryption_configured()
    )


def encryption_configured() -> bool:
    try:
        _fernet()
        return True
    except ValueError:
        return False


def _fernet() -> Fernet:
    key = get_settings().google_token_encryption_key.strip()
    if not key:
        raise ValueError("Google token encryption is not configured")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeError) as exc:
        raise ValueError("GOOGLE_TOKEN_ENCRYPTION_KEY must be a valid Fernet key") from exc


def encrypt_refresh_token(token: str) -> str:
    if not token:
        raise ValueError("Google did not return a refresh token")
    return _fernet().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_refresh_token(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError) as exc:
        raise ValueError("stored Google authorization cannot be decrypted") from exc


def calendar_scope_granted(scopes: object) -> bool:
    if isinstance(scopes, str):
        granted = set(scopes.split())
    elif isinstance(scopes, (list, tuple, set)):
        granted = {str(scope) for scope in scopes}
    else:
        granted = set()
    return CALENDAR_SCOPE in granted


def save_credential(db, user: User, refresh_token: str, scopes: object) -> None:
    credential = db.execute(
        select(GoogleCalendarCredential).where(GoogleCalendarCredential.user_id == user.id)
    ).scalar_one_or_none()
    scope_text = " ".join(scopes) if isinstance(scopes, (list, tuple, set)) else str(scopes or "")
    if credential is None:
        credential = GoogleCalendarCredential(
            user_id=user.id,
            refresh_token_encrypted=encrypt_refresh_token(refresh_token),
            scopes=scope_text,
        )
        db.add(credential)
    else:
        credential.refresh_token_encrypted = encrypt_refresh_token(refresh_token)
        credential.scopes = scope_text
    db.commit()


def delete_credential(db, user: User) -> bool:
    credential = db.execute(
        select(GoogleCalendarCredential).where(GoogleCalendarCredential.user_id == user.id)
    ).scalar_one_or_none()
    if credential is None:
        return False
    db.delete(credential)
    db.commit()
    return True


def connection_status(db) -> dict:
    settings = get_settings()
    user = db.execute(select(User).where(User.email == settings.owner_email.lower())).scalar_one_or_none()
    connected = False
    if user is not None:
        credential = db.execute(
            select(GoogleCalendarCredential).where(GoogleCalendarCredential.user_id == user.id)
        ).scalar_one_or_none()
        connected = credential is not None and calendar_scope_granted(credential.scopes)
    return {
        "connected": connected,
        "access": "read-only",
        "connect_path": "/auth/google/calendar/connect",
    }


def _credential(db) -> GoogleCalendarCredential:
    settings = get_settings()
    credential = db.execute(
        select(GoogleCalendarCredential)
        .join(User)
        .where(User.email == settings.owner_email.lower())
    ).scalar_one_or_none()
    if credential is None:
        raise ValueError("Google Calendar is not connected; visit /auth/google/calendar/connect")
    if not calendar_scope_granted(credential.scopes):
        raise ValueError("stored Google authorization does not include Calendar read access")
    return credential


def _access_token(db) -> str:
    settings = get_settings()
    refresh_token = decrypt_refresh_token(_credential(db).refresh_token_encrypted)
    try:
        response = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=20,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ValueError(
            "Google Calendar authorization expired; reconnect at /auth/google/calendar/connect"
        ) from exc
    token = str(response.json().get("access_token") or "")
    if not token:
        raise ValueError("Google did not return a Calendar access token")
    return token


def _headers(db) -> dict:
    return {"Authorization": f"Bearer {_access_token(db)}", "Accept": "application/json"}


def _google_get(db, path: str, params: dict | None = None) -> dict:
    try:
        response = httpx.get(
            f"{CALENDAR_API}{path}", headers=_headers(db), params=params or {}, timeout=30
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ValueError("Google Calendar request failed") from exc
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("Google Calendar returned an invalid response")
    return payload


def _google_post(db, path: str, body: dict) -> dict:
    try:
        response = httpx.post(
            f"{CALENDAR_API}{path}", headers=_headers(db), json=body, timeout=30
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ValueError("Google Calendar request failed") from exc
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("Google Calendar returned an invalid response")
    return payload


def _bounded_limit(value: int | None, maximum: int, default: int) -> int:
    return max(1, min(int(value or default), maximum))


def _parse_range(time_min: str, time_max: str) -> tuple[str, str]:
    def parse(value: str, field: str) -> datetime:
        normalized = (value or "").strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValueError(f"{field} must be an RFC3339 datetime") from exc
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError(f"{field} must include a timezone offset")
        return parsed

    start = parse(time_min, "time_min")
    end = parse(time_max, "time_max")
    if end <= start:
        raise ValueError("time_max must be after time_min")
    if (end - start).total_seconds() > MAX_RANGE_DAYS * 24 * 3600:
        raise ValueError(f"Calendar range cannot exceed {MAX_RANGE_DAYS} days")
    return start.isoformat(), end.isoformat()


def _calendar_summary(item: dict) -> dict:
    return {
        "id": item.get("id"),
        "name": item.get("summaryOverride") or item.get("summary"),
        "description": str(item.get("description") or "")[:MAX_EVENT_TEXT_CHARS],
        "primary": bool(item.get("primary")),
        "selected": bool(item.get("selected")),
        "access_role": item.get("accessRole"),
        "time_zone": item.get("timeZone"),
    }


def list_calendars(db) -> dict:
    payload = _google_get(
        db,
        "/users/me/calendarList",
        {"maxResults": MAX_CALENDARS, "minAccessRole": "reader", "showHidden": False},
    )
    items = payload.get("items") or []
    return {
        "calendars": [_calendar_summary(item) for item in items[:MAX_CALENDARS]],
        "truncated": bool(payload.get("nextPageToken")),
        "access": "read-only",
    }


def _readable_calendars(db) -> list[dict]:
    return list_calendars(db)["calendars"]


def _selected_calendars(db, calendar_ids: list[str] | None) -> list[dict]:
    calendars = _readable_calendars(db)
    if not calendar_ids:
        selected = [calendar for calendar in calendars if calendar.get("selected")]
        return (selected or calendars)[:MAX_CALENDARS]
    requested = {str(identifier) for identifier in calendar_ids[:MAX_CALENDARS]}
    matched = [calendar for calendar in calendars if calendar.get("id") in requested]
    if len(matched) != len(requested):
        raise ValueError("one or more calendar IDs are not in the connected calendar list")
    return matched


def _event_summary(item: dict, calendar: dict) -> dict:
    attendees = []
    for attendee in (item.get("attendees") or [])[:MAX_ATTENDEES]:
        attendees.append(
            {
                "name": attendee.get("displayName"),
                "email": attendee.get("email"),
                "response": attendee.get("responseStatus"),
                "self": bool(attendee.get("self")),
            }
        )
    organizer = item.get("organizer") or {}
    return {
        "id": item.get("id"),
        "calendar_id": calendar.get("id"),
        "calendar_name": calendar.get("name"),
        "summary": item.get("summary") or "(busy)",
        "description": str(item.get("description") or "")[:MAX_EVENT_TEXT_CHARS],
        "location": str(item.get("location") or "")[:1_000],
        "status": item.get("status"),
        "start": item.get("start"),
        "end": item.get("end"),
        "organizer": {
            "name": organizer.get("displayName"),
            "email": organizer.get("email"),
            "self": bool(organizer.get("self")),
        },
        "attendees": attendees,
        "attendees_truncated": len(item.get("attendees") or []) > MAX_ATTENDEES,
        "recurring_event_id": item.get("recurringEventId"),
        "url": item.get("htmlLink"),
    }


def _event_sort_key(event: dict) -> str:
    start = event.get("start") or {}
    return str(start.get("dateTime") or start.get("date") or "")


def list_events(
    db,
    time_min: str,
    time_max: str,
    calendar_ids: list[str] | None = None,
    query: str = "",
    limit: int = 30,
) -> dict:
    start, end = _parse_range(time_min, time_max)
    bounded = _bounded_limit(limit, MAX_EVENTS, 30)
    calendars = _selected_calendars(db, calendar_ids)
    events: list[dict] = []
    for calendar in calendars:
        params = {
            "timeMin": start,
            "timeMax": end,
            "singleEvents": True,
            "orderBy": "startTime",
            "showDeleted": False,
            "maxResults": bounded,
        }
        if query:
            params["q"] = str(query)[:200]
        payload = _google_get(
            db,
            f"/calendars/{quote(str(calendar['id']), safe='')}/events",
            params,
        )
        events.extend(_event_summary(item, calendar) for item in payload.get("items") or [])
    events.sort(key=_event_sort_key)
    truncated = len(events) > bounded
    return {
        "time_min": start,
        "time_max": end,
        "events": events[:bounded],
        "truncated": truncated,
        "access": "read-only",
    }


def free_busy(
    db,
    time_min: str,
    time_max: str,
    calendar_ids: list[str] | None = None,
    time_zone: str = "America/Los_Angeles",
) -> dict:
    start, end = _parse_range(time_min, time_max)
    calendars = _selected_calendars(db, calendar_ids)
    payload = _google_post(
        db,
        "/freeBusy",
        {
            "timeMin": start,
            "timeMax": end,
            "timeZone": str(time_zone or "America/Los_Angeles")[:100],
            "items": [{"id": calendar["id"]} for calendar in calendars],
        },
    )
    response_calendars = payload.get("calendars") or {}
    availability = []
    for calendar in calendars:
        result = response_calendars.get(calendar["id"]) or {}
        availability.append(
            {
                "calendar_id": calendar["id"],
                "calendar_name": calendar.get("name"),
                "busy": result.get("busy") or [],
                "errors": result.get("errors") or [],
            }
        )
    return {
        "time_min": payload.get("timeMin") or start,
        "time_max": payload.get("timeMax") or end,
        "time_zone": str(time_zone or "America/Los_Angeles")[:100],
        "calendars": availability,
        "access": "read-only",
    }


def _object_schema(properties: dict, required: tuple[str, ...] = ()) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": list(required),
        "additionalProperties": False,
    }


def tools() -> list[BrainTool]:
    calendar_ids = {
        "type": "array",
        "items": {"type": "string"},
        "maxItems": MAX_CALENDARS,
        "description": "Optional exact IDs from list_google_calendars; defaults to selected calendars.",
    }
    return [
        BrainTool(
            name="get_google_calendar_status",
            description="Check whether the owner's read-only Google Calendar connection is ready.",
            parameters=_object_schema({}),
            handler=lambda db, args: connection_status(db),
            label=lambda db, args: "checking Google Calendar connection",
            available=available,
        ),
        BrainTool(
            name="list_google_calendars",
            description="List readable Google calendars and their IDs. This tool is read-only.",
            parameters=_object_schema({}),
            handler=lambda db, args: list_calendars(db),
            label=lambda db, args: "listing Google calendars",
            available=available,
        ),
        BrainTool(
            name="list_google_calendar_events",
            description=(
                "List or search events across selected readable Google calendars in an explicit "
                "RFC3339 time range. Use this for schedules, upcoming events, and event searches."
            ),
            parameters=_object_schema(
                {
                    "time_min": {"type": "string", "description": "RFC3339 inclusive start."},
                    "time_max": {"type": "string", "description": "RFC3339 exclusive end."},
                    "calendar_ids": calendar_ids,
                    "query": {"type": "string", "maxLength": 200},
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_EVENTS},
                },
                ("time_min", "time_max"),
            ),
            handler=lambda db, args: list_events(
                db,
                args.get("time_min", ""),
                args.get("time_max", ""),
                args.get("calendar_ids"),
                args.get("query", ""),
                args.get("limit", 30),
            ),
            label=lambda db, args: "reading Google Calendar events",
            available=available,
        ),
        BrainTool(
            name="get_google_calendar_free_busy",
            description=(
                "Read busy intervals across selected Google calendars for an explicit RFC3339 "
                "time range. Use this to answer availability questions; it does not create events."
            ),
            parameters=_object_schema(
                {
                    "time_min": {"type": "string", "description": "RFC3339 inclusive start."},
                    "time_max": {"type": "string", "description": "RFC3339 exclusive end."},
                    "calendar_ids": calendar_ids,
                    "time_zone": {
                        "type": "string",
                        "description": "IANA time zone; defaults to America/Los_Angeles.",
                    },
                },
                ("time_min", "time_max"),
            ),
            handler=lambda db, args: free_busy(
                db,
                args.get("time_min", ""),
                args.get("time_max", ""),
                args.get("calendar_ids"),
                args.get("time_zone", "America/Los_Angeles"),
            ),
            label=lambda db, args: "checking Google Calendar availability",
            available=available,
        ),
    ]
