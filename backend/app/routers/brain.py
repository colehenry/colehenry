import hashlib
import hmac

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import require_owner
from app.models import BrainConversation, BrainLink, BrainMessage, BrainNote, User
from app.schemas.brain import (
    ChatRequest,
    ConversationDetail,
    ConversationOut,
    GraphEdge,
    GraphNode,
    GraphOut,
    MessageIn,
    MessageOut,
    NoteLink,
    NoteOut,
    ReindexOut,
    SearchHit,
    TreeNode,
)
from app.services import brain as service

router = APIRouter(prefix="/brain", tags=["brain"])


# --------------------------------------------------------------------------- #
# Ingest webhook (GitHub → server). Not cookie-authed; HMAC-verified instead.
# --------------------------------------------------------------------------- #
@router.post("/ingest")
async def ingest(request: Request):
    settings = get_settings()
    secret = settings.brain_webhook_secret
    body = await request.body()

    if not secret:
        raise HTTPException(status_code=503, detail="Ingest not configured")
    sig = request.headers.get("X-Hub-Signature-256", "")
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=401, detail="Bad signature")

    payload = await request.json()
    if request.headers.get("X-GitHub-Event") == "ping":
        return {"ok": True, "pong": True}

    # Collect touched paths across all commits in the push.
    paths: set[str] = set()
    for commit in payload.get("commits", []):
        for key in ("added", "modified", "removed"):
            paths.update(commit.get(key, []))
    result = await run_in_threadpool(service.ingest, sorted(paths))
    return {"ok": True, **result}


# --------------------------------------------------------------------------- #
# Owner-only
# --------------------------------------------------------------------------- #
@router.post("/reindex", response_model=ReindexOut)
async def reindex(
    force: bool = Query(False, description="Re-parse even byte-identical files"),
    user: User = Depends(require_owner),
):
    if not service.available():
        raise HTTPException(status_code=503, detail="Vault repo not configured")
    result = await run_in_threadpool(service.reindex, force)
    return ReindexOut(**result)


def _build_tree(notes: list[BrainNote]) -> list[TreeNode]:
    root: dict = {}
    for n in sorted(notes, key=lambda x: x.path):
        parts = n.path.split("/")
        cursor = root
        for part in parts[:-1]:
            cursor = cursor.setdefault(("dir", part), {})
        cursor[("file", parts[-1])] = n

    def to_nodes(d: dict) -> list[TreeNode]:
        dirs, files = [], []
        for (kind, name), val in d.items():
            if kind == "dir":
                dirs.append(TreeNode(name=name, children=to_nodes(val)))
            else:
                files.append(TreeNode(name=name, path=val.path, title=val.title))
        dirs.sort(key=lambda x: x.name.lower())
        files.sort(key=lambda x: (x.title or x.name).lower())
        return dirs + files

    return to_nodes(root)


@router.get("/tree", response_model=list[TreeNode])
def tree(user: User = Depends(require_owner), db: Session = Depends(get_db)):
    notes = db.execute(select(BrainNote)).scalars().all()
    return _build_tree(notes)


@router.get("/note", response_model=NoteOut)
def note(
    path: str = Query(...),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    row = db.execute(select(BrainNote).where(BrainNote.path == path)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Note not found")
    links = db.execute(
        select(BrainLink).where(BrainLink.src_note_id == row.id)
    ).scalars().all()
    return NoteOut(
        path=row.path,
        title=row.title,
        body_md=row.body_md,
        frontmatter=row.frontmatter or {},
        links=[
            NoteLink(
                dst_path=l.dst_path,
                dst_note_id=l.dst_note_id,
                resolved=l.dst_note_id is not None,
            )
            for l in links
        ],
    )


@router.get("/search", response_model=list[SearchHit])
def search(
    q: str = Query(...),
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    return [SearchHit(**hit) for hit in service.search(db, q)]


@router.get("/graph", response_model=GraphOut)
def graph(user: User = Depends(require_owner), db: Session = Depends(get_db)):
    notes = db.execute(
        select(BrainNote).where(~BrainNote.path.like(service.PRIVATE_PREFIX + "%"))
    ).scalars().all()
    ids = {n.id for n in notes}
    nodes = [GraphNode(id=n.id, path=n.path, title=n.title) for n in notes]
    edges_rows = db.execute(
        select(BrainLink).where(BrainLink.dst_note_id.is_not(None))
    ).scalars().all()
    edges = [
        GraphEdge(source=e.src_note_id, target=e.dst_note_id)
        for e in edges_rows
        if e.src_note_id in ids and e.dst_note_id in ids
    ]
    return GraphOut(nodes=nodes, edges=edges)


@router.post("/chat")
def chat(payload: ChatRequest, user: User = Depends(require_owner)):
    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    return StreamingResponse(
        service.chat_stream(messages, payload.model),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --------------------------------------------------------------------------- #
# Conversations (chat history)
# --------------------------------------------------------------------------- #
@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(user: User = Depends(require_owner), db: Session = Depends(get_db)):
    rows = db.execute(
        select(BrainConversation).order_by(BrainConversation.updated_at.desc())
    ).scalars().all()
    return [ConversationOut(id=c.id, title=c.title or "New chat", updated_at=c.updated_at) for c in rows]


@router.post("/conversations", response_model=ConversationOut)
def create_conversation(user: User = Depends(require_owner), db: Session = Depends(get_db)):
    conv = BrainConversation(title="")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationOut(id=conv.id, title=conv.title or "New chat", updated_at=conv.updated_at)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    conv = db.get(BrainConversation, conversation_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = db.execute(
        select(BrainMessage)
        .where(BrainMessage.conversation_id == conv.id)
        .order_by(BrainMessage.id)
    ).scalars().all()
    return ConversationDetail(
        id=conv.id,
        title=conv.title or "New chat",
        messages=[
            MessageOut(
                id=m.id, role=m.role, content=m.content,
                tool_calls=m.tool_calls, created_at=m.created_at,
            )
            for m in msgs
        ],
    )


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    conv = db.get(BrainConversation, conversation_id)
    if conv is not None:
        db.delete(conv)
        db.commit()
    return {"ok": True}


@router.post("/conversations/{conversation_id}/messages")
def post_message(
    conversation_id: int,
    payload: MessageIn,
    user: User = Depends(require_owner),
):
    return StreamingResponse(
        service.converse(conversation_id, payload.content, payload.model),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
