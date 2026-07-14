import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# app.db constructs its engine at import time; no connection is opened here.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("OWNER_EMAIL", "owner@example.com")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test")
os.environ.setdefault("OAUTH_REDIRECT_URI", "http://localhost/callback")

from app.models import GoogleCalendarCredential, User  # noqa: E402
from app.services import brain, brain_calendar  # noqa: E402


class _Response:
    def __init__(self, payload, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class BrainCalendarToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = SimpleNamespace(
            google_client_id="google-client",
            google_client_secret="google-secret",
            google_token_encryption_key="STpOYzA6JojKcEJDrZp-qHHaR3XquZpJxkUY2AYGY-s=",
            owner_email="owner@example.com",
        )
        settings = patch.object(brain_calendar, "get_settings", return_value=self.settings)
        settings.start()
        self.addCleanup(settings.stop)

        engine = create_engine("sqlite+pysqlite:///:memory:")
        User.__table__.create(engine)
        GoogleCalendarCredential.__table__.create(engine)
        self.db = sessionmaker(bind=engine)()
        self.addCleanup(self.db.close)
        self.user = User(email="owner@example.com")
        self.db.add(self.user)
        self.db.commit()

    def connect(self) -> None:
        brain_calendar.save_credential(
            self.db,
            self.user,
            "refresh-token-value",
            f"openid email {brain_calendar.CALENDAR_SCOPE}",
        )

    @staticmethod
    def calendars_response() -> _Response:
        return _Response(
            {
                "items": [
                    {
                        "id": "owner@example.com",
                        "summary": "Personal",
                        "primary": True,
                        "selected": True,
                        "accessRole": "owner",
                        "timeZone": "America/Los_Angeles",
                    }
                ]
            }
        )

    def test_refresh_token_is_encrypted_at_rest_and_status_is_safe(self) -> None:
        self.connect()
        credential = self.db.query(GoogleCalendarCredential).one()

        self.assertNotIn("refresh-token-value", credential.refresh_token_encrypted)
        self.assertEqual(
            brain_calendar.decrypt_refresh_token(credential.refresh_token_encrypted),
            "refresh-token-value",
        )
        status = brain_calendar.connection_status(self.db)
        self.assertEqual(status["connected"], True)
        self.assertNotIn("token", str(status).lower())

    def test_encryption_fails_closed_without_dedicated_key(self) -> None:
        self.settings.google_token_encryption_key = ""
        self.assertFalse(brain_calendar.available())
        with self.assertRaisesRegex(ValueError, "not configured"):
            brain_calendar.encrypt_refresh_token("refresh-token")

    def test_scope_check_requires_exact_readonly_scope(self) -> None:
        self.assertTrue(
            brain_calendar.calendar_scope_granted(
                f"openid email {brain_calendar.CALENDAR_SCOPE}"
            )
        )
        self.assertFalse(
            brain_calendar.calendar_scope_granted("openid email calendar.readonly")
        )

    def test_time_range_requires_timezone_and_is_bounded(self) -> None:
        with self.assertRaisesRegex(ValueError, "timezone"):
            brain_calendar._parse_range("2026-07-12T09:00:00", "2026-07-12T10:00:00")
        with self.assertRaisesRegex(ValueError, "cannot exceed"):
            brain_calendar._parse_range(
                "2026-01-01T00:00:00-08:00", "2027-02-01T00:00:00-08:00"
            )

    def test_list_events_reads_selected_calendar_and_returns_bounded_details(self) -> None:
        self.connect()
        token = _Response({"access_token": "short-lived-access-token"})
        events = _Response(
            {
                "items": [
                    {
                        "id": "event-1",
                        "summary": "Dentist",
                        "description": "Routine cleaning",
                        "location": "Oakland",
                        "status": "confirmed",
                        "start": {"dateTime": "2026-07-13T10:00:00-07:00"},
                        "end": {"dateTime": "2026-07-13T11:00:00-07:00"},
                        "organizer": {"email": "owner@example.com", "self": True},
                        "attendees": [
                            {"email": "owner@example.com", "responseStatus": "accepted"}
                        ],
                        "htmlLink": "https://calendar.google.com/event?eid=event-1",
                    }
                ]
            }
        )
        with (
            patch.object(brain_calendar.httpx, "post", return_value=token) as post,
            patch.object(
                brain_calendar.httpx,
                "get",
                side_effect=[self.calendars_response(), events],
            ) as get,
        ):
            result = brain_calendar.list_events(
                self.db,
                "2026-07-13T00:00:00-07:00",
                "2026-07-14T00:00:00-07:00",
                limit=10,
            )

        self.assertEqual(result["events"][0]["summary"], "Dentist")
        self.assertEqual(result["events"][0]["calendar_name"], "Personal")
        self.assertEqual(post.call_count, 2)
        self.assertIn("owner%40example.com/events", get.call_args_list[1].args[0])
        self.assertEqual(get.call_args_list[1].kwargs["params"]["singleEvents"], True)

    def test_calendar_ids_must_come_from_connected_calendar_list(self) -> None:
        self.connect()
        with (
            patch.object(
                brain_calendar.httpx,
                "post",
                return_value=_Response({"access_token": "access"}),
            ),
            patch.object(
                brain_calendar.httpx, "get", return_value=self.calendars_response()
            ),
        ):
            with self.assertRaisesRegex(ValueError, "calendar IDs"):
                brain_calendar.list_events(
                    self.db,
                    "2026-07-13T00:00:00-07:00",
                    "2026-07-14T00:00:00-07:00",
                    ["someone-elses-calendar"],
                )

    def test_free_busy_uses_read_query_and_maps_calendar_names(self) -> None:
        self.connect()
        token = _Response({"access_token": "access"})
        free_busy = _Response(
            {
                "timeMin": "2026-07-13T16:00:00Z",
                "timeMax": "2026-07-14T00:00:00Z",
                "calendars": {
                    "owner@example.com": {
                        "busy": [
                            {
                                "start": "2026-07-13T17:00:00Z",
                                "end": "2026-07-13T18:00:00Z",
                            }
                        ]
                    }
                },
            }
        )
        with (
            patch.object(
                brain_calendar.httpx, "post", side_effect=[token, token, free_busy]
            ) as post,
            patch.object(
                brain_calendar.httpx, "get", return_value=self.calendars_response()
            ),
        ):
            result = brain_calendar.free_busy(
                self.db,
                "2026-07-13T09:00:00-07:00",
                "2026-07-13T17:00:00-07:00",
            )

        self.assertEqual(result["calendars"][0]["calendar_name"], "Personal")
        self.assertEqual(len(result["calendars"][0]["busy"]), 1)
        self.assertTrue(post.call_args_list[2].args[0].endswith("/freeBusy"))

    def test_brain_registry_exposes_only_read_calendar_tools(self) -> None:
        names = {schema["function"]["name"] for schema in brain._active_tools()}
        expected = {
            "get_google_calendar_status",
            "list_google_calendars",
            "list_google_calendar_events",
            "get_google_calendar_free_busy",
        }
        self.assertTrue(expected.issubset(names))
        self.assertFalse(any("create" in name or "update" in name for name in expected))


if __name__ == "__main__":
    unittest.main()
