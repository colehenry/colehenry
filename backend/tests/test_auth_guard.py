"""End-to-end auth checks through the real FastAPI app.

Protected endpoints must 401 for anonymous, forged, and non-owner requests,
and public showcase reads must not require a cookie. Runs against a temp-file
SQLite database (shared across connections, unlike :memory:).
"""

import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{_DB_FILE.name}")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("OWNER_EMAIL", "owner@example.com")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test")
os.environ.setdefault("OAUTH_REDIRECT_URI", "http://localhost/callback")

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.security import create_token  # noqa: E402

COOKIE = get_settings().cookie_name

# One representative owner-gated endpoint per router.
PROTECTED = [
    ("GET", "/auth/me"),
    ("GET", "/brain/tree"),
    ("GET", "/challenges/dashboard"),
    ("POST", "/language/decks"),
    ("POST", "/catan/games"),
    ("POST", "/coding/pairing-codes"),
]

# Reads deliberately exposed for the public showcase.
PUBLIC = [
    "/language/decks",
    "/language/texts",
    "/language/verb-sets",
    "/catan/dashboard",
    "/projects",
    "/recipes",
]


class AuthGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            if not db.query(User).filter_by(email="owner@example.com").first():
                db.add(User(email="owner@example.com"))
                db.commit()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        os.unlink(_DB_FILE.name)

    def request(self, method: str, path: str, token: str | None = None):
        cookies = {COOKIE: token} if token else None
        return self.client.request(method, path, cookies=cookies)

    def test_protected_endpoints_reject_anonymous(self):
        for method, path in PROTECTED:
            with self.subTest(path=path):
                self.assertEqual(self.request(method, path).status_code, 401)

    def test_protected_endpoints_reject_garbage_cookie(self):
        for method, path in PROTECTED:
            with self.subTest(path=path):
                res = self.request(method, path, token="not-a-jwt")
                self.assertEqual(res.status_code, 401)

    def test_protected_endpoints_reject_wrong_signing_key(self):
        forged = jwt.encode(
            {"sub": "owner@example.com"}, "wrong-secret", algorithm="HS256"
        )
        for method, path in PROTECTED:
            with self.subTest(path=path):
                self.assertEqual(self.request(method, path, token=forged).status_code, 401)

    def test_protected_endpoints_reject_valid_token_for_non_owner(self):
        intruder = create_token("intruder@example.com")  # real key, wrong subject
        for method, path in PROTECTED:
            with self.subTest(path=path):
                self.assertEqual(self.request(method, path, token=intruder).status_code, 401)

    def test_owner_token_is_accepted(self):
        res = self.request("GET", "/auth/me", token=create_token("owner@example.com"))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["email"], "owner@example.com")

    def test_owner_token_passes_guard_on_language_writes(self):
        res = self.client.post(
            "/language/decks",
            json={"name": "Guard check", "language": "fr"},
            cookies={COOKIE: create_token("owner@example.com")},
        )
        self.assertEqual(res.status_code, 201)

    def test_public_showcase_reads_need_no_cookie(self):
        for path in PUBLIC:
            with self.subTest(path=path):
                self.assertEqual(self.request("GET", path).status_code, 200)

    def test_health_is_open(self):
        self.assertEqual(self.client.get("/health").status_code, 200)

    def test_owner_can_pair_and_revoke_a_coding_device(self):
        cookies = {COOKIE: create_token("owner@example.com")}
        code_response = self.client.post("/coding/pairing-codes", cookies=cookies)
        self.assertEqual(code_response.status_code, 200)
        code = code_response.json()["code"]
        self.assertEqual(len(code), 8)

        pair_response = self.client.post(
            "/coding/pair", json={"code": code, "name": "Test Mac"}
        )
        self.assertEqual(pair_response.status_code, 200)
        device_id = pair_response.json()["device_id"]
        self.assertTrue(pair_response.json()["device_token"])

        devices_response = self.client.get("/coding/devices", cookies=cookies)
        self.assertEqual(devices_response.status_code, 200)
        self.assertTrue(
            any(device["id"] == device_id for device in devices_response.json())
        )

        revoke_response = self.client.delete(
            f"/coding/devices/{device_id}", cookies=cookies
        )
        self.assertEqual(revoke_response.status_code, 200)
