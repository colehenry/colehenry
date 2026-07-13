from datetime import datetime

from pydantic import BaseModel


class NoteLink(BaseModel):
    dst_path: str
    dst_note_id: int | None
    resolved: bool


class NoteOut(BaseModel):
    path: str
    title: str
    body_md: str
    frontmatter: dict
    links: list[NoteLink]


class TreeNode(BaseModel):
    """A file or folder in the vault tree. Folders carry children; files carry
    a path + title."""

    name: str
    path: str | None = None  # set for files, None for folders
    title: str | None = None
    children: list["TreeNode"] = []


class SearchHit(BaseModel):
    path: str
    title: str
    snippet: str


class GraphNode(BaseModel):
    id: int
    path: str
    title: str


class GraphEdge(BaseModel):
    source: int
    target: int


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None  # OpenRouter slug; falls back to settings.brain_chat_model


class ReindexOut(BaseModel):
    notes: int
    links: int


class ConversationOut(BaseModel):
    id: int
    title: str
    updated_at: datetime


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    tool_calls: list | None = None
    created_at: datetime


class ConversationDetail(BaseModel):
    id: int
    title: str
    messages: list[MessageOut]


class MessageIn(BaseModel):
    content: str
    model: str | None = None


TreeNode.model_rebuild()
