import base64
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("OWNER_EMAIL", "owner@example.com")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test")
os.environ.setdefault("OAUTH_REDIRECT_URI", "http://localhost/callback")

from app.models import GoogleGmailCredential, User  # noqa: E402
from app.services import brain, brain_calendar, brain_gmail  # noqa: E402


class _Response:
    def __init__(self, payload, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def _encoded(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")


class BrainGmailToolTests(unittest.TestCase):
    def setUp(self) -> None:
        brain_gmail._read_windows.clear()
        self.addCleanup(brain_gmail._read_windows.clear)
        self.settings = SimpleNamespace(
            google_client_id="google-client",
            google_client_secret="google-secret",
            google_token_encryption_key="STpOYzA6JojKcEJDrZp-qHHaR3XquZpJxkUY2AYGY-s=",
            owner_email="owner@example.com",
        )
        gmail_settings = patch.object(brain_gmail, "get_settings", return_value=self.settings)
        calendar_settings = patch.object(
            brain_calendar, "get_settings", return_value=self.settings
        )
        gmail_settings.start()
        calendar_settings.start()
        self.addCleanup(gmail_settings.stop)
        self.addCleanup(calendar_settings.stop)

        engine = create_engine("sqlite+pysqlite:///:memory:")
        User.__table__.create(engine)
        GoogleGmailCredential.__table__.create(engine)
        self.db = sessionmaker(bind=engine)()
        self.addCleanup(self.db.close)
        self.user = User(email="owner@example.com")
        self.db.add(self.user)
        self.db.commit()

    def connect(self) -> None:
        brain_gmail.save_credential(
            self.db,
            self.user,
            "gmail-refresh-token",
            f"openid email {brain_gmail.GMAIL_SCOPE}",
        )

    @staticmethod
    def metadata_message() -> dict:
        return {
            "id": "18fabc123",
            "threadId": "thread123",
            "labelIds": ["INBOX", "UNREAD"],
            "snippet": "Can we meet on Thursday?",
            "internalDate": "1783900800000",
            "sizeEstimate": 1200,
            "payload": {
                "headers": [
                    {"name": "From", "value": "A Person <person@example.com>"},
                    {"name": "To", "value": "owner@example.com"},
                    {"name": "Subject", "value": "Thursday meeting"},
                    {"name": "X-Secret", "value": "must-not-return"},
                ]
            },
        }

    def test_gmail_token_is_separate_encrypted_and_status_is_safe(self) -> None:
        self.connect()
        credential = self.db.query(GoogleGmailCredential).one()

        self.assertNotIn("gmail-refresh-token", credential.refresh_token_encrypted)
        self.assertTrue(brain_gmail.connection_status(self.db)["connected"])
        self.assertNotIn("gmail-refresh-token", str(brain_gmail.connection_status(self.db)))

    def test_scope_check_requires_exact_gmail_readonly_scope(self) -> None:
        self.assertTrue(
            brain_gmail.gmail_scope_granted(f"openid email {brain_gmail.GMAIL_SCOPE}")
        )
        self.assertFalse(brain_gmail.gmail_scope_granted("openid email gmail.readonly"))

    def test_search_returns_metadata_and_snippets_without_body(self) -> None:
        self.connect()
        with (
            patch.object(
                brain_gmail.httpx,
                "post",
                return_value=_Response({"access_token": "short-lived"}),
            ) as post,
            patch.object(
                brain_gmail.httpx,
                "get",
                side_effect=[
                    _Response(
                        {
                            "messages": [{"id": "18fabc123", "threadId": "thread123"}],
                            "resultSizeEstimate": 1,
                        }
                    ),
                    _Response(self.metadata_message()),
                ],
            ) as get,
        ):
            result = brain_gmail.search_messages(
                self.db, "from:person@example.com newer_than:30d", 5
            )

        message = result["messages"][0]
        self.assertEqual(message["headers"]["Subject"], "Thursday meeting")
        self.assertEqual(message["snippet"], "Can we meet on Thursday?")
        self.assertNotIn("body", message)
        self.assertNotIn("must-not-return", str(message))
        self.assertEqual(post.call_count, 1)
        self.assertEqual(get.call_args_list[1].kwargs["params"]["format"], "metadata")

    def test_full_message_extracts_text_but_never_attachment_data(self) -> None:
        self.connect()
        message = self.metadata_message()
        message["payload"].update(
            {
                "mimeType": "multipart/mixed",
                "parts": [
                    {
                        "mimeType": "text/plain",
                        "filename": "",
                        "body": {"data": _encoded("Meeting details and agenda")},
                    },
                    {
                        "mimeType": "text/plain",
                        "filename": "private.txt",
                        "body": {"data": _encoded("attachment secret")},
                    },
                    {
                        "mimeType": "application/pdf",
                        "filename": "invoice.pdf",
                        "body": {"attachmentId": "attachment-1"},
                    },
                ],
            }
        )
        with (
            patch.object(
                brain_gmail.httpx,
                "post",
                return_value=_Response({"access_token": "short-lived"}),
            ),
            patch.object(brain_gmail.httpx, "get", return_value=_Response(message)) as get,
        ):
            result = brain_gmail.get_message(self.db, "18fabc123")

        output = str(result)
        self.assertIn("Meeting details and agenda", output)
        self.assertNotIn("attachment secret", output)
        self.assertTrue(result["message"]["attachments_inaccessible"])
        self.assertEqual(get.call_args.kwargs["params"], {"format": "full"})

    def test_sensitive_email_values_are_redacted_before_model_context(self) -> None:
        original = (
            "Reset at https://example.com/reset?token=abc123. Verification code 654321. "
            "Authorization: Bearer this-is-a-secret-token. Account number 123456789. "
            "SSN 123-45-6789. github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"
        )
        redacted, categories = brain_gmail.redact_sensitive_text(original)

        self.assertNotIn("abc123", redacted)
        self.assertNotIn("654321", redacted)
        self.assertNotIn("this-is-a-secret-token", redacted)
        self.assertNotIn("123456789", redacted)
        self.assertNotIn("123-45-6789", redacted)
        self.assertNotIn("github_pat_", redacted)
        self.assertTrue(
            {
                "sensitive_link",
                "one_time_code",
                "authorization",
                "financial_identifier",
                "ssn",
                "api_token",
            }.issubset(categories)
        )

    def test_gmail_reads_have_bounded_in_process_rate_limits(self) -> None:
        for _ in range(brain_gmail.READ_RATE_LIMITS["message"]):
            brain_gmail._check_read_rate("message")
        with self.assertRaisesRegex(ValueError, "rate limit"):
            brain_gmail._check_read_rate("message")

    def test_google_data_forces_private_routing_and_gmail_history_redaction(self) -> None:
        self.assertIsNone(brain._provider_policy(False))
        self.assertEqual(
            brain._provider_policy(True), {"data_collection": "deny", "zdr": True}
        )
        self.assertIn("list_google_calendar_events", brain.GOOGLE_DATA_TOOLS)
        self.assertTrue(
            brain._used_gmail_data([{"name": "search_gmail_messages", "args": {}}])
        )
        self.assertFalse(brain._used_gmail_data([{"name": "search_code", "args": {}}]))
        content, calls = brain._assistant_history_payload(
            "sensitive answer text", [{"name": "get_gmail_message", "args": {}}]
        )
        self.assertNotIn("sensitive answer text", content)
        self.assertIn("not retained", content)
        self.assertIsNone(calls)

    def test_message_ids_and_queries_are_validated(self) -> None:
        with self.assertRaisesRegex(ValueError, "message ID"):
            brain_gmail._message_id("../../another-message")
        with self.assertRaisesRegex(ValueError, "query is required"):
            brain_gmail.search_messages(self.db, "")

    def test_brain_registry_exposes_no_gmail_write_tools(self) -> None:
        names = {schema["function"]["name"] for schema in brain._active_tools()}
        expected = {
            "get_gmail_status",
            "list_gmail_labels",
            "search_gmail_messages",
            "get_gmail_message",
        }
        self.assertTrue(expected.issubset(names))
        forbidden = ("send", "draft", "delete", "modify", "archive", "label_message")
        self.assertFalse(any(term in name for name in expected for term in forbidden))


if __name__ == "__main__":
    unittest.main()
