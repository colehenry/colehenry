import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch


os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("OWNER_EMAIL", "owner@example.com")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test")
os.environ.setdefault("OAUTH_REDIRECT_URI", "http://localhost/callback")

from app.services import brain  # noqa: E402


class _StreamResponse:
    def __init__(self, chunks: list[dict]):
        self.chunks = chunks

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def raise_for_status(self) -> None:
        return None

    def iter_lines(self):
        for chunk in self.chunks:
            yield f"data: {json.dumps(chunk)}"
        yield "data: [DONE]"


class BrainPromptTests(unittest.TestCase):
    def test_chat_style_requires_plain_evidence_calibrated_language(self) -> None:
        style = brain.CHAT_SYSTEM.split("Style:", 1)[1]

        self.assertIn("Never use the em dash character", style)
        self.assertIn("plain, direct language", style)
        self.assertIn("unless the available evidence directly supports", style)
        self.assertNotIn("—", style)

    def test_general_questions_start_without_connector_schemas(self) -> None:
        capabilities = brain._route_capabilities(
            [{"role": "user", "content": "Explain how compound interest works."}]
        )
        names = {
            schema["function"]["name"]
            for schema in brain._active_tools(capabilities)
        }

        self.assertEqual(capabilities, set())
        self.assertEqual(names, {"enable_capabilities"})

    def test_router_can_select_multiple_relevant_sources(self) -> None:
        capabilities = brain._route_capabilities(
            [
                {
                    "role": "user",
                    "content": "Check the latest production deployment and its GitHub commit.",
                }
            ]
        )

        self.assertEqual(capabilities, {"web", "code", "railway"})

    def test_router_keeps_personal_and_google_sources_distinct(self) -> None:
        personal = brain._route_capabilities(
            [{"role": "user", "content": "What career goals have I mentioned?"}]
        )
        google = brain._route_capabilities(
            [{"role": "user", "content": "Check my calendar and email for tomorrow."}]
        )

        self.assertEqual(personal, {"vault"})
        self.assertEqual(google, {"calendar", "gmail"})

    def test_vault_route_loads_only_vault_tools_plus_fallback(self) -> None:
        names = {
            schema["function"]["name"]
            for schema in brain._active_tools({"vault"})
        }

        self.assertEqual(names, {"enable_capabilities", "read_note", "neighbors"})

    def test_base_prompt_does_not_include_vault_index(self) -> None:
        prompt = brain._system_prompt(None, set())

        self.assertNotIn("FULL NOTE INDEX", prompt)
        self.assertIn("No private or live-source capability is enabled yet", prompt)

    def test_model_can_enable_a_missed_capability_during_the_turn(self) -> None:
        enable_vault = _StreamResponse(
            [
                {
                    "choices": [
                        {
                            "delta": {
                                "tool_calls": [
                                    {
                                        "index": 0,
                                        "id": "call-1",
                                        "function": {
                                            "name": "enable_capabilities",
                                            "arguments": '{"capabilities":["vault"]}',
                                        },
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        )
        answer = _StreamResponse(
            [{"choices": [{"delta": {"content": "Here is the answer."}}]}]
        )
        settings = SimpleNamespace(
            open_router_api_key="test",
            brain_chat_model="test/model",
            fallback_model="",
            llm_base_url="https://openrouter.test/api/v1",
        )

        with (
            patch.object(brain, "get_settings", return_value=settings),
            patch.object(brain, "main_doc", return_value="# Vault"),
            patch.object(brain, "vault_map", return_value="- Project (project.md)"),
            patch.object(brain.httpx, "stream", side_effect=[enable_vault, answer]) as stream,
        ):
            events = list(
                brain._chat_events(
                    None,
                    [{"role": "user", "content": "Tell me more about that."}],
                    None,
                )
            )

        first_payload = stream.call_args_list[0].kwargs["json"]
        second_payload = stream.call_args_list[1].kwargs["json"]
        first_tools = {tool["function"]["name"] for tool in first_payload["tools"]}
        second_tools = {tool["function"]["name"] for tool in second_payload["tools"]}

        self.assertEqual(first_tools, {"enable_capabilities"})
        self.assertEqual(
            second_tools,
            {"enable_capabilities", "read_note", "neighbors"},
        )
        self.assertIn("FULL NOTE INDEX", second_payload["messages"][0]["content"])
        self.assertIn(("token", {"text": "Here is the answer."}), events)


if __name__ == "__main__":
    unittest.main()
