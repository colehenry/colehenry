import base64
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

from app.services import brain, brain_code  # noqa: E402
from app.services.brain_tool_registry import (  # noqa: E402
    BrainTool,
    BrainToolRegistry,
)


class _Response:
    def __init__(self, payload, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class BrainCodeToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = SimpleNamespace(
            brain_code_repos="colehenry/colehenry, colehenry/lapwise.dev",
            brain_code_github_token="github_pat_test",
            brain_tavily_key="",
        )
        settings = patch.object(brain_code, "get_settings", return_value=self.settings)
        settings.start()
        self.addCleanup(settings.stop)

    def test_repository_allowlist_is_canonical_and_enforced(self) -> None:
        self.settings.brain_code_repos = (
            "colehenry/colehenry,invalid,COLEHENRY/COLEHENRY,colehenry/lapwise.dev"
        )
        self.assertEqual(
            brain_code.code_repositories(),
            ("colehenry/colehenry", "colehenry/lapwise.dev"),
        )
        self.assertEqual(
            brain_code._allowed_repo("COLEHENRY/LAPWISE.DEV"),
            "colehenry/lapwise.dev",
        )
        with self.assertRaisesRegex(ValueError, "allowlist"):
            brain_code._allowed_repo("someone/public-repo")

    def test_secret_generated_and_dependency_paths_are_excluded(self) -> None:
        allowed = ["backend/app/config.py", ".env.example", ".github/workflows/test.yml"]
        excluded = [
            ".env",
            ".env.production",
            "credentials.json",
            "certs/app.pem",
            "node_modules/pkg/index.js",
            "frontend/.next/server.js",
            "package-lock.json",
        ]
        self.assertTrue(all(brain_code.path_allowed(path) for path in allowed))
        self.assertTrue(all(not brain_code.path_allowed(path) for path in excluded))

    def test_tree_uses_default_branch_and_filters_excluded_files(self) -> None:
        metadata = _Response({"default_branch": "main", "private": True})
        tree = _Response(
            {
                "sha": "tree-sha",
                "tree": [
                    {"path": "backend/app/main.py", "type": "blob", "size": 120, "sha": "a"},
                    {"path": ".env", "type": "blob", "size": 30, "sha": "b"},
                    {"path": "node_modules/pkg/index.js", "type": "blob", "size": 40, "sha": "c"},
                ],
            }
        )
        with patch.object(brain_code.httpx, "get", side_effect=[metadata, tree]) as get:
            result = brain_code.list_tree("colehenry/colehenry", "backend")

        self.assertEqual(result["ref"], "main")
        self.assertEqual([entry["path"] for entry in result["entries"]], ["backend/app/main.py"])
        self.assertIn("/git/trees/main", get.call_args_list[1].args[0])

    def test_read_code_returns_numbered_bounded_lines(self) -> None:
        content = "\n".join(f"line {number}" for number in range(1, 501))
        response = _Response(
            {
                "type": "file",
                "size": len(content),
                "encoding": "base64",
                "content": base64.b64encode(content.encode()).decode(),
                "sha": "file-sha",
            }
        )
        with patch.object(brain_code.httpx, "get", return_value=response):
            result = brain_code.read(
                "colehenry/lapwise.dev",
                "backend/app/main.py",
                ref="feature/test",
                start_line=10,
                end_line=499,
            )

        self.assertEqual(result["start_line"], 10)
        self.assertEqual(result["end_line"], 409)
        self.assertTrue(result["content"].startswith("10: line 10"))
        self.assertTrue(result["content"].endswith("409: line 409"))
        self.assertTrue(result["truncated"])

    def test_search_filters_results_outside_allowlist_and_secret_paths(self) -> None:
        response = _Response(
            {
                "total_count": 3,
                "items": [
                    {
                        "path": "backend/app/main.py",
                        "sha": "a",
                        "html_url": "https://github.com/example",
                        "repository": {"full_name": "colehenry/colehenry"},
                        "text_matches": [{"fragment": "include_router(brain.router)"}],
                    },
                    {
                        "path": ".env.production",
                        "sha": "b",
                        "repository": {"full_name": "colehenry/colehenry"},
                    },
                    {
                        "path": "main.py",
                        "sha": "c",
                        "repository": {"full_name": "someone/else"},
                    },
                ],
            }
        )
        with patch.object(brain_code.httpx, "get", return_value=response):
            result = brain_code.search("colehenry/colehenry", "include_router")

        self.assertEqual([match["path"] for match in result["matches"]], ["backend/app/main.py"])

    def test_registry_only_exposes_available_tools(self) -> None:
        tool = BrainTool(
            name="sometimes",
            description="test",
            parameters={"type": "object", "properties": {}},
            handler=lambda db, args: {},
            label=lambda db, args: "test",
            available=lambda: False,
        )
        registry = BrainToolRegistry([tool])
        self.assertEqual(registry.active_schemas(), [])

    def test_brain_registry_exposes_configured_code_connector(self) -> None:
        names = {
            schema["function"]["name"]
            for schema in brain._active_tools()
        }
        self.assertTrue(
            {
                "list_code_repositories",
                "list_code_tree",
                "search_code",
                "read_code",
                "list_commits",
                "get_commit",
                "compare_refs",
                "list_pull_requests",
                "list_recent_merges",
                "get_pull_request",
            }.issubset(names)
        )

    def test_list_commits_uses_branch_and_returns_compact_history(self) -> None:
        response = _Response(
            [
                {
                    "sha": "abc123",
                    "html_url": "https://github.com/colehenry/lapwise.dev/commit/abc123",
                    "commit": {
                        "message": "Add race comparison",
                        "author": {"name": "Cole", "date": "2026-07-12T10:00:00Z"},
                        "committer": {"date": "2026-07-12T10:01:00Z"},
                    },
                    "parents": [{"sha": "parent"}],
                }
            ]
        )
        with patch.object(brain_code.httpx, "get", return_value=response) as get:
            result = brain_code.list_commits("colehenry/lapwise.dev", "main", 5)

        self.assertEqual(result["branch"], "main")
        self.assertEqual(result["commits"][0]["sha"], "abc123")
        self.assertEqual(get.call_args.kwargs["params"], {"sha": "main", "per_page": 5})

    def test_get_commit_returns_diff_and_filters_secret_paths(self) -> None:
        long_patch = "+" * (brain_code.MAX_PATCH_CHARS + 20)
        response = _Response(
            {
                "sha": "abc123",
                "commit": {"message": "Change auth", "author": {}, "committer": {}},
                "parents": [],
                "stats": {"additions": 10, "deletions": 2, "total": 12},
                "files": [
                    {
                        "filename": "backend/app/auth.py",
                        "status": "modified",
                        "additions": 10,
                        "deletions": 2,
                        "changes": 12,
                        "patch": long_patch,
                    },
                    {"filename": ".env.production", "status": "modified", "patch": "+SECRET=x"},
                ],
            }
        )
        with patch.object(brain_code.httpx, "get", return_value=response):
            result = brain_code.get_commit("colehenry/lapwise.dev", "abc123")

        self.assertEqual([item["path"] for item in result["files"]], ["backend/app/auth.py"])
        self.assertEqual(len(result["files"][0]["patch"]), brain_code.MAX_PATCH_CHARS)
        self.assertTrue(result["files"][0]["patch_truncated"])

    def test_compare_refs_returns_commits_and_filtered_file_changes(self) -> None:
        response = _Response(
            {
                "status": "ahead",
                "ahead_by": 2,
                "behind_by": 0,
                "total_commits": 2,
                "html_url": "https://github.com/compare",
                "commits": [
                    {"sha": "one", "commit": {"message": "One", "author": {}, "committer": {}}},
                    {"sha": "two", "commit": {"message": "Two", "author": {}, "committer": {}}},
                ],
                "files": [
                    {"filename": "frontend/app/page.tsx", "status": "modified", "patch": "@@"},
                    {"filename": "credentials.json", "status": "added", "patch": "+token"},
                ],
            }
        )
        with patch.object(brain_code.httpx, "get", return_value=response) as get:
            result = brain_code.compare_refs("colehenry/colehenry", "main", "feature/brain")

        self.assertEqual(result["ahead_by"], 2)
        self.assertEqual([item["sha"] for item in result["commits"]], ["one", "two"])
        self.assertEqual([item["path"] for item in result["files"]], ["frontend/app/page.tsx"])
        self.assertIn("main...feature%2Fbrain", get.call_args.args[0])

    def test_recent_merges_are_sorted_by_merged_time(self) -> None:
        response = _Response(
            [
                {
                    "number": 8,
                    "title": "Older merge",
                    "merged_at": "2026-07-10T10:00:00Z",
                    "base": {"ref": "main"},
                    "head": {"ref": "older"},
                },
                {"number": 99, "title": "Closed only", "merged_at": None},
                {
                    "number": 9,
                    "title": "Newest merge",
                    "merged_at": "2026-07-12T10:00:00Z",
                    "base": {"ref": "main"},
                    "head": {"ref": "newer"},
                },
            ]
        )
        with patch.object(brain_code.httpx, "get", return_value=response):
            result = brain_code.list_recent_merges("colehenry/lapwise.dev", "main", 2)

        self.assertEqual([item["number"] for item in result["merges"]], [9, 8])

    def test_get_pull_request_combines_details_and_safe_files(self) -> None:
        detail = _Response(
            {
                "number": 42,
                "title": "Brain history tools",
                "state": "closed",
                "merged_at": "2026-07-12T10:00:00Z",
                "body": "Summary and test plan",
                "base": {"ref": "main"},
                "head": {"ref": "brain/history"},
                "additions": 50,
                "deletions": 5,
                "changed_files": 2,
                "commits": 1,
            }
        )
        files = _Response(
            [
                {"filename": "backend/app/services/brain_code.py", "status": "modified", "patch": "@@"},
                {"filename": "secrets.json", "status": "added", "patch": "+secret"},
            ]
        )
        with patch.object(brain_code.httpx, "get", side_effect=[detail, files]) as get:
            result = brain_code.get_pull_request("colehenry/colehenry", 42)

        self.assertEqual(result["pull_request"]["number"], 42)
        self.assertEqual(
            [item["path"] for item in result["files"]],
            ["backend/app/services/brain_code.py"],
        )
        self.assertIn("/pulls/42/files", get.call_args_list[1].args[0])


if __name__ == "__main__":
    unittest.main()
