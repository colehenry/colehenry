"""Resumable practice attempts through the real API: create, save progress,
list for the dashboard, finish, discard. Results written mid-run move vocab
mastery immediately (no waiting for the completion row)."""

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

from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import LearningVocab, User  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.security import create_token  # noqa: E402

COOKIE = get_settings().cookie_name


class LearningAttemptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            user = db.query(User).filter_by(email="owner@example.com").first()
            if not user:
                user = User(email="owner@example.com")
                db.add(user)
                db.commit()
                db.refresh(user)
            cls.owner_id = user.id
        cls.client = TestClient(app)
        cls.client.cookies.set(COOKIE, create_token("owner@example.com"))
        cls.client.post("/language/learning/sync")

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        os.unlink(_DB_FILE.name)

    def test_attempt_lifecycle_and_live_mastery(self):
        built = self.client.post("/language/learning/exercises", json={"activity_id": "s1_vocab_lesson", "sprint": 1, "source": "deterministic"})
        self.assertEqual(built.status_code, 200, built.text)
        payload = built.json()
        graded_targets = [ex for ex in payload["exercises"] if ex["format"] == "fr_to_es"]
        self.assertTrue(graded_targets)
        # every noun in the lesson is shown with a gender-bearing article
        for ex in payload["exercises"]:
            if ex["kind"] == "intro" and ex["meta"].get("gender"):
                self.assertRegex(ex["prompt"], r"^(le|la|un|une|les|l')\b")

        created = self.client.post(
            "/language/learning/attempts",
            json={"activity_id": "s1_vocab_lesson", "title": "Learn 8 core words", "format": "vocab_lesson", "skill": "vocabulary", "sprint": 1, "payload": payload},
        )
        self.assertEqual(created.status_code, 201, created.text)
        attempt = created.json()
        self.assertEqual(attempt["graded"], [])
        self.assertEqual(attempt["total"], len(payload["exercises"]))

        # a graded item is written as a result right away and moves recognition mastery
        first = graded_targets[0]
        target = first["target_ids"][0]
        with SessionLocal() as db:
            before = db.query(LearningVocab).filter_by(curriculum_id=target).one().recognition
        posted = self.client.post(
            "/language/learning/results",
            json={"results": [{
                "sprint": 1, "activity_id": "s1_vocab_lesson", "format": first["format"], "source": "deterministic", "skill": first["skill"],
                "target_ids": first["target_ids"], "dims": first["dims"], "correct": True, "score": 1.0, "prompt": first["prompt"],
                "answer": "x", "expected": "x", "time_ms": 900, "meta": first["meta"],
            }]},
        )
        self.assertEqual(posted.status_code, 200, posted.text)
        with SessionLocal() as db:
            after = db.query(LearningVocab).filter_by(curriculum_id=target).one().recognition
        self.assertGreater(after, before)
        self.assertGreaterEqual(after, 0.75)

        saved = self.client.put(
            f"/language/learning/attempts/{attempt['id']}",
            json={"index": 9, "graded": [{"exercise_id": first["id"], "answer": "x", "correct": True, "score": 1.0, "time_ms": 900}]},
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["index"], 9)
        self.assertEqual(len(saved.json()["graded"]), 1)

        listed = self.client.get("/language/learning/attempts").json()
        self.assertEqual([a["id"] for a in listed], [attempt["id"]])

        # starting the same activity again replaces the stale open run
        again = self.client.post("/language/learning/attempts", json={"activity_id": "s1_vocab_lesson", "sprint": 1, "payload": payload})
        self.assertEqual(again.status_code, 201)
        listed = self.client.get("/language/learning/attempts").json()
        self.assertEqual([a["id"] for a in listed], [again.json()["id"]])

        finished = self.client.post(f"/language/learning/attempts/{again.json()['id']}/finish")
        self.assertEqual(finished.status_code, 200)
        self.assertIsNotNone(finished.json()["finished_at"])
        self.assertEqual(self.client.get("/language/learning/attempts").json(), [])

        other = self.client.post("/language/learning/attempts", json={"activity_id": "s1_fr_to_es", "sprint": 1, "payload": payload}).json()
        self.assertEqual(self.client.delete(f"/language/learning/attempts/{other['id']}").status_code, 204)
        self.assertEqual(self.client.get(f"/language/learning/attempts/{other['id']}").status_code, 404)

    def test_vocab_list_carries_display_form(self):
        rows = self.client.get("/language/learning/vocab", params={"sprint": 1}).json()
        maison = next(r for r in rows if r["curriculum_id"] == "fr_maison")
        self.assertEqual(maison["display"], "la maison")
        ami = next(r for r in rows if r["curriculum_id"] == "fr_ami")
        self.assertEqual(ami["display"], "un ami / une amie")


if __name__ == "__main__":
    unittest.main()
