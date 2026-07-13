import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch


# app.db constructs its engine at import time; no connection is opened here.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("OWNER_EMAIL", "owner@example.com")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test")
os.environ.setdefault("OAUTH_REDIRECT_URI", "http://localhost/callback")

from app.services import brain, brain_railway  # noqa: E402


class _Response:
    def __init__(self, payload, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class BrainRailwayToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = SimpleNamespace(
            brain_railway_colehenry_token="colehenry-project-token",
            brain_railway_colehenry_service_id="service-colehenry",
            brain_railway_lapwise_token="lapwise-project-token",
            brain_railway_lapwise_service_id="service-lapwise",
        )
        settings = patch.object(brain_railway, "get_settings", return_value=self.settings)
        settings.start()
        self.addCleanup(settings.stop)

    @staticmethod
    def _scope(project: str = "project-lapwise", environment: str = "production") -> _Response:
        return _Response(
            {"data": {"projectToken": {"projectId": project, "environmentId": environment}}}
        )

    def test_targets_require_complete_configuration_and_never_return_tokens(self) -> None:
        self.settings.brain_railway_colehenry_service_id = ""
        result = brain_railway.list_targets()

        self.assertEqual(result, {"targets": ["lapwise"], "access": "read-only"})
        self.assertNotIn("lapwise-project-token", str(result))

    def test_graphql_uses_project_access_token_header(self) -> None:
        with patch.object(
            brain_railway.httpx,
            "post",
            return_value=_Response({"data": {"projectToken": {"projectId": "p", "environmentId": "e"}}}),
        ) as post:
            brain_railway._scope(brain_railway._target("lapwise"))

        self.assertEqual(
            post.call_args.kwargs["headers"]["Project-Access-Token"],
            "lapwise-project-token",
        )
        self.assertNotIn("Authorization", post.call_args.kwargs["headers"])

    def test_list_deployments_uses_token_scope_and_only_safe_metadata(self) -> None:
        deployments = _Response(
            {
                "data": {
                    "deployments": {
                        "edges": [
                            {
                                "node": {
                                    "id": "deployment-1",
                                    "status": "SUCCESS",
                                    "createdAt": "2026-07-12T12:00:00Z",
                                    "statusUpdatedAt": "2026-07-12T12:01:00Z",
                                    "url": "lapwise-production.up.railway.app",
                                    "meta": {
                                        "commitHash": "abc123",
                                        "commitMessage": "Add Railway tools",
                                        "repo": "colehenry/lapwise.dev",
                                        "unknownPotentialSecret": "do-not-return",
                                    },
                                }
                            }
                        ]
                    }
                }
            }
        )
        with patch.object(
            brain_railway.httpx, "post", side_effect=[self._scope(), deployments]
        ) as post:
            result = brain_railway.list_deployments("lapwise", 5)

        self.assertEqual(result["deployments"][0]["commit_hash"], "abc123")
        self.assertEqual(result["deployments"][0]["repository"], "colehenry/lapwise.dev")
        self.assertNotIn("do-not-return", str(result))
        variables = post.call_args_list[1].kwargs["json"]["variables"]
        self.assertEqual(
            variables["input"],
            {
                "projectId": "project-lapwise",
                "environmentId": "production",
                "serviceId": "service-lapwise",
            },
        )

    def test_deployment_detail_rejects_other_service(self) -> None:
        other_service = _Response(
            {
                "data": {
                    "deployment": {
                        "id": "deployment-1",
                        "projectId": "project-lapwise",
                        "environmentId": "production",
                        "serviceId": "service-other",
                        "status": "SUCCESS",
                    }
                }
            }
        )
        with patch.object(
            brain_railway.httpx, "post", side_effect=[self._scope(), other_service]
        ):
            with self.assertRaisesRegex(ValueError, "outside"):
                brain_railway.get_deployment("lapwise", "deployment-1")

    def test_logs_are_verified_bounded_and_redacted(self) -> None:
        detail = _Response(
            {
                "data": {
                    "deployment": {
                        "id": "deployment-1",
                        "projectId": "project-lapwise",
                        "environmentId": "production",
                        "serviceId": "service-lapwise",
                        "status": "SUCCESS",
                    }
                }
            }
        )
        logs = _Response(
            {
                "data": {
                    "deploymentLogs": [
                        {
                            "timestamp": "2026-07-12T12:02:00Z",
                            "severity": "info",
                            "message": (
                                "DATABASE_URL=postgresql://user:pass@host/db "
                                "Authorization: Bearer abc.def.ghi "
                                "token=github_pat_abcdefghijklmnopqrstuvwxyz"
                            ),
                        }
                    ]
                }
            }
        )
        with patch.object(
            brain_railway.httpx,
            "post",
            side_effect=[self._scope(), detail, logs],
        ):
            result = brain_railway.get_logs("lapwise", "deployment-1", "runtime", 1)

        output = str(result)
        self.assertIn("[REDACTED]", output)
        self.assertNotIn("user:pass", output)
        self.assertNotIn("abc.def.ghi", output)
        self.assertNotIn("github_pat_", output)

    def test_brain_registry_exposes_configured_railway_connector(self) -> None:
        names = {schema["function"]["name"] for schema in brain._active_tools()}
        self.assertTrue(
            {
                "list_railway_targets",
                "list_railway_deployments",
                "get_railway_deployment",
                "get_railway_logs",
            }.issubset(names)
        )


if __name__ == "__main__":
    unittest.main()
