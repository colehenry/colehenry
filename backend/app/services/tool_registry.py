"""Small registry for LLM-facing tools (Brain chat, the French tutor).

Keeping a tool's schema, handler, availability check, and activity label in one
place makes connectors independently configurable and avoids parallel dispatch
tables in the chat service.
"""

from dataclasses import dataclass
from typing import Any, Callable


ToolHandler = Callable[[Any, dict], Any]
ToolLabel = Callable[[Any, dict], str]
AvailabilityCheck = Callable[[], bool]


def _always_available() -> bool:
    return True


@dataclass(frozen=True)
class LLMTool:
    name: str
    description: str
    parameters: dict
    handler: ToolHandler
    label: ToolLabel
    available: AvailabilityCheck = _always_available

    def openai_schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    def __init__(self, tools: list[LLMTool]):
        names = [tool.name for tool in tools]
        if len(names) != len(set(names)):
            raise ValueError("tool names must be unique")
        self._tools = {tool.name: tool for tool in tools}

    def get(self, name: str) -> LLMTool | None:
        return self._tools.get(name)

    def active_schemas(self, names: set[str] | None = None) -> list[dict]:
        return [
            tool.openai_schema()
            for tool in self._tools.values()
            if (names is None or tool.name in names) and tool.available()
        ]


# Brain's original names, kept so its connector modules read naturally.
BrainTool = LLMTool
BrainToolRegistry = ToolRegistry
