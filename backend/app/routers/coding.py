import asyncio
import hashlib
import json
import secrets
import string
import uuid
from collections import defaultdict
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import SessionLocal, get_db
from app.deps import require_owner
from app.models import CodingDevice, CodingEvent, CodingPairingCode, CodingTask, User
from app.schemas.coding import (
    CodingDeviceOut,
    CodingEventOut,
    CodingTaskDetail,
    CodingTaskOut,
    PairDeviceIn,
    PairedDeviceOut,
    PairingCodeOut,
    TaskActionIn,
    TaskCreate,
    TaskMessageIn,
    TaskUpdate,
)

router = APIRouter(prefix="/coding", tags=["coding"])


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _title(prompt: str) -> str:
    normalized = " ".join(prompt.split())
    return (normalized[:52].rstrip() + ("…" if len(normalized) > 52 else "")) or "New chat"


def _device_out(device: CodingDevice, connected: bool) -> CodingDeviceOut:
    return CodingDeviceOut(
        id=device.id,
        name=device.name,
        connected=connected,
        capabilities=device.capabilities or {},
        created_at=device.created_at,
        last_seen_at=device.last_seen_at,
    )


def _event_out(event: CodingEvent) -> CodingEventOut:
    return CodingEventOut(
        seq=event.seq,
        type=event.type,
        payload=event.payload or {},
        created_at=event.created_at,
    )


def _task_out(task: CodingTask) -> CodingTaskOut:
    return CodingTaskOut(
        id=task.id,
        device_id=task.device_id,
        title=task.title,
        workspace_id=task.workspace_id,
        workspace_name=task.workspace_name,
        model=task.model,
        branch=task.branch,
        status=task.status,
        created_at=task.created_at,
        updated_at=task.updated_at,
        archived_at=task.archived_at,
    )


def _task_detail(task: CodingTask) -> CodingTaskDetail:
    return CodingTaskDetail(**_task_out(task).model_dump(), events=[_event_out(e) for e in task.events])


def _append_event(db: Session, task_id: str, event_type: str, payload: dict) -> CodingEvent:
    task = db.execute(
        select(CodingTask).where(CodingTask.id == task_id).with_for_update()
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    last_seq = db.execute(
        select(func.max(CodingEvent.seq)).where(CodingEvent.task_id == task_id)
    ).scalar_one()
    event = CodingEvent(
        task_id=task_id,
        seq=(last_seq or 0) + 1,
        type=event_type,
        payload=payload,
    )
    task.updated_at = _now()
    if event_type == "task_started":
        task.status = "running"
        task.branch = payload.get("branch") or task.branch
    elif event_type in {"attention", "approval_required"}:
        task.status = "attention"
    elif event_type == "task_completed":
        task.status = "completed"
    elif event_type == "task_failed":
        task.status = "failed"
    elif event_type == "task_cancelled":
        task.status = "cancelled"
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


class CodingHub:
    def __init__(self) -> None:
        self.connections: dict[str, WebSocket] = {}
        self.subscribers: dict[str, set[asyncio.Queue[dict]]] = defaultdict(set)
        self.lock = asyncio.Lock()

    async def attach(self, device_id: str, websocket: WebSocket) -> None:
        async with self.lock:
            old = self.connections.get(device_id)
            self.connections[device_id] = websocket
        if old and old is not websocket:
            await old.close(code=4001, reason="A newer agent connection replaced this one")

    async def detach(self, device_id: str, websocket: WebSocket) -> None:
        async with self.lock:
            if self.connections.get(device_id) is websocket:
                self.connections.pop(device_id, None)

    def connected(self, device_id: str) -> bool:
        return device_id in self.connections

    async def send(self, device_id: str, message: dict) -> bool:
        websocket = self.connections.get(device_id)
        if websocket is None:
            return False
        try:
            await websocket.send_json(message)
            return True
        except Exception:
            await self.detach(device_id, websocket)
            return False

    async def publish(self, task_id: str, event: CodingEvent) -> None:
        payload = {
            "seq": event.seq,
            "type": event.type,
            "payload": event.payload or {},
            "created_at": event.created_at.isoformat(),
        }
        for queue in list(self.subscribers.get(task_id, set())):
            queue.put_nowait(payload)

    @asynccontextmanager
    async def subscribe(self, task_id: str):
        queue: asyncio.Queue[dict] = asyncio.Queue()
        self.subscribers[task_id].add(queue)
        try:
            yield queue
        finally:
            self.subscribers[task_id].discard(queue)
            if not self.subscribers[task_id]:
                self.subscribers.pop(task_id, None)


hub = CodingHub()


@router.post("/pairing-codes", response_model=PairingCodeOut)
def create_pairing_code(
    _user: User = Depends(require_owner), db: Session = Depends(get_db)
):
    alphabet = string.ascii_uppercase.replace("I", "").replace("O", "") + "23456789"
    code = "".join(secrets.choice(alphabet) for _ in range(8))
    expires_at = _now() + timedelta(minutes=10)
    db.add(CodingPairingCode(code_hash=_digest(code), expires_at=expires_at))
    db.commit()
    return PairingCodeOut(code=code, expires_at=expires_at)


@router.post("/pair", response_model=PairedDeviceOut)
def pair_device(payload: PairDeviceIn, db: Session = Depends(get_db)):
    row = db.execute(
        select(CodingPairingCode).where(CodingPairingCode.code_hash == _digest(payload.code.upper()))
    ).scalar_one_or_none()
    now = _now()
    if row is None or row.claimed_at is not None or row.expires_at < now:
        raise HTTPException(status_code=400, detail="Pairing code is invalid or expired")
    device_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(48)
    row.claimed_at = now
    db.add(
        CodingDevice(
            id=device_id,
            name=payload.name.strip(),
            token_hash=_digest(token),
            capabilities={},
        )
    )
    db.commit()
    return PairedDeviceOut(device_id=device_id, device_token=token)


@router.get("/devices", response_model=list[CodingDeviceOut])
def list_devices(
    _user: User = Depends(require_owner), db: Session = Depends(get_db)
):
    devices = db.execute(
        select(CodingDevice)
        .where(CodingDevice.revoked_at.is_(None))
        .order_by(CodingDevice.created_at.desc())
    ).scalars()
    return [_device_out(device, hub.connected(device.id)) for device in devices]


@router.delete("/devices/{device_id}")
async def revoke_device(
    device_id: str,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    device = db.get(CodingDevice, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    device.revoked_at = _now()
    db.commit()
    websocket = hub.connections.get(device_id)
    if websocket:
        await websocket.close(code=4003, reason="Device revoked")
    return {"ok": True}


@router.get("/tasks", response_model=list[CodingTaskOut])
def list_tasks(
    archived: bool = False,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    archive_filter = (
        CodingTask.archived_at.is_not(None)
        if archived
        else CodingTask.archived_at.is_(None)
    )
    tasks = db.execute(
        select(CodingTask).where(archive_filter).order_by(CodingTask.updated_at.desc())
    ).scalars()
    return [_task_out(task) for task in tasks]


@router.get("/tasks/{task_id}", response_model=CodingTaskDetail)
def get_task(
    task_id: str,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    task = db.execute(
        select(CodingTask)
        .options(selectinload(CodingTask.events))
        .where(CodingTask.id == task_id)
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_detail(task)


@router.post("/tasks", response_model=CodingTaskOut)
async def create_task(
    payload: TaskCreate,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    device = db.get(CodingDevice, payload.device_id)
    if device is None or device.revoked_at is not None:
        raise HTTPException(status_code=404, detail="Device not found")
    prompt = payload.prompt.strip()
    task = CodingTask(
        id=str(uuid.uuid4()),
        device_id=device.id,
        title=_title(prompt),
        workspace_id=payload.workspace_id,
        workspace_name=payload.workspace_name,
        model=payload.model,
        status="queued" if prompt else "draft",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    if not prompt:
        _append_event(db, task.id, "task_created", {"isolated": payload.isolated})
        return _task_out(task)
    event = _append_event(db, task.id, "user_message", {"content": prompt})
    await hub.publish(task.id, event)
    await hub.send(
        task.device_id,
        {
            "type": "start_task",
            "task": _task_out(task).model_dump(mode="json"),
            "prompt": prompt,
            "isolated": payload.isolated,
        },
    )
    return _task_out(task)


@router.patch("/tasks/{task_id}", response_model=CodingTaskOut)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    task = db.get(CodingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if payload.model is not None:
        task.model = payload.model
    if payload.title is not None:
        task.title = " ".join(payload.title.split())[:120]
    if payload.workspace_id is not None:
        if task.status != "draft":
            raise HTTPException(
                status_code=409,
                detail="Workspace can only be changed before the first message",
            )
        device = db.get(CodingDevice, task.device_id)
        workspaces = (device.capabilities or {}).get("workspaces", []) if device else []
        workspace = next(
            (candidate for candidate in workspaces if candidate.get("id") == payload.workspace_id),
            None,
        )
        if workspace is None:
            raise HTTPException(status_code=422, detail="Workspace is not available on this device")
        task.workspace_id = workspace["id"]
        task.workspace_name = workspace.get("name") or payload.workspace_name or task.workspace_name
    db.commit()
    db.refresh(task)
    return _task_out(task)


@router.post("/tasks/{task_id}/archive")
async def archive_task(
    task_id: str,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    task = db.get(CodingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if hub.connected(task.device_id):
        await hub.send(task.device_id, {"type": "archive_task", "task_id": task.id})
    task.archived_at = _now()
    db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/restore", response_model=CodingTaskOut)
async def restore_task(
    task_id: str,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    task = db.get(CodingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task.archived_at = None
    db.commit()
    db.refresh(task)
    if hub.connected(task.device_id):
        await hub.send(task.device_id, {"type": "restore_task", "task_id": task.id})
    return _task_out(task)


@router.post("/tasks/{task_id}/messages", response_model=CodingEventOut)
async def send_task_message(
    task_id: str,
    payload: TaskMessageIn,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    task = db.get(CodingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.archived_at is not None:
        raise HTTPException(status_code=409, detail="Restore this task before sending a message")
    if not hub.connected(task.device_id):
        raise HTTPException(status_code=409, detail="Agent device is offline")
    starting_draft = task.status == "draft"
    if payload.model:
        task.model = payload.model
    if starting_draft:
        task.title = _title(payload.content)
        task.status = "queued"
    db.commit()
    event = _append_event(db, task.id, "user_message", {"content": payload.content})
    await hub.publish(task.id, event)
    if starting_draft:
        isolated = db.execute(
            select(CodingEvent.payload).where(
                CodingEvent.task_id == task.id,
                CodingEvent.type == "task_created",
            )
        ).scalar_one_or_none()
        sent = await hub.send(
            task.device_id,
            {
                "type": "start_task",
                "task": _task_out(task).model_dump(mode="json"),
                "prompt": payload.content,
                "isolated": (isolated or {}).get("isolated", False),
            },
        )
    else:
        sent = await hub.send(
            task.device_id,
            {
                "type": "task_message",
                "task_id": task.id,
                "content": payload.content,
                "model": task.model,
            },
        )
    if not sent:
        raise HTTPException(status_code=409, detail="Agent device disconnected before receiving the message")
    return _event_out(event)


@router.post("/tasks/{task_id}/actions", response_model=CodingEventOut)
async def send_task_action(
    task_id: str,
    payload: TaskActionIn,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    task = db.get(CodingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if not hub.connected(task.device_id):
        raise HTTPException(status_code=409, detail="Agent device is offline")
    event = _append_event(
        db, task.id, "user_action", {"type": payload.type, "payload": payload.payload}
    )
    await hub.publish(task.id, event)
    sent = await hub.send(
        task.device_id,
        {"type": "task_action", "task_id": task.id, "action": payload.model_dump()},
    )
    if not sent:
        raise HTTPException(status_code=409, detail="Agent device disconnected before receiving the action")
    return _event_out(event)


@router.delete("/tasks/{task_id}")
async def close_task(
    task_id: str,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    task = db.get(CodingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if hub.connected(task.device_id):
        await hub.send(task.device_id, {"type": "close_task", "task_id": task.id})
    db.delete(task)
    db.commit()
    return {"ok": True}


@router.get("/tasks/{task_id}/events")
async def stream_task_events(
    task_id: str,
    request: Request,
    after: int = 0,
    _user: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    if db.get(CodingTask, task_id) is None:
        raise HTTPException(status_code=404, detail="Task not found")

    async def generate() -> AsyncGenerator[str, None]:
        latest = after
        async with hub.subscribe(task_id) as queue:
            with SessionLocal() as stream_db:
                backlog = stream_db.execute(
                    select(CodingEvent)
                    .where(CodingEvent.task_id == task_id, CodingEvent.seq > after)
                    .order_by(CodingEvent.seq)
                ).scalars()
                for event in backlog:
                    latest = event.seq
                    data = json.dumps(event.payload or {}, separators=(",", ":"))
                    yield f"id: {event.seq}\nevent: {event.type}\ndata: {data}\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if event["seq"] <= latest:
                    continue
                latest = event["seq"]
                data = json.dumps(event["payload"], separators=(",", ":"))
                yield f"id: {event['seq']}\nevent: {event['type']}\ndata: {data}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.websocket("/agent/ws")
async def agent_socket(websocket: WebSocket):
    authorization = websocket.headers.get("authorization", "")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        await websocket.close(code=4003, reason="Missing device token")
        return
    with SessionLocal() as db:
        device = db.execute(
            select(CodingDevice).where(
                CodingDevice.token_hash == _digest(token), CodingDevice.revoked_at.is_(None)
            )
        ).scalar_one_or_none()
        if device is None:
            await websocket.close(code=4003, reason="Invalid device token")
            return
        device_id = device.id
    await websocket.accept()
    await hub.attach(device_id, websocket)
    await websocket.send_json({"type": "connected", "device_id": device_id})

    with SessionLocal() as db:
        queued = db.execute(
            select(CodingTask)
            .options(selectinload(CodingTask.events))
            .where(CodingTask.device_id == device_id, CodingTask.status == "queued")
            .order_by(CodingTask.created_at)
        ).scalars()
        for task in queued:
            first_prompt = next(
                (
                    event.payload.get("content", "")
                    for event in task.events
                    if event.type == "user_message"
                ),
                "",
            )
            await websocket.send_json(
                {
                    "type": "start_task",
                    "task": _task_out(task).model_dump(mode="json"),
                    "prompt": first_prompt,
                    "isolated": False,
                }
            )

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            with SessionLocal() as db:
                device = db.get(CodingDevice, device_id)
                if device is None or device.revoked_at is not None:
                    await websocket.close(code=4003, reason="Device revoked")
                    return
                device.last_seen_at = _now()
                if message_type == "hello":
                    device.capabilities = message.get("capabilities") or {}
                    db.commit()
                    continue
                if message_type == "heartbeat":
                    db.commit()
                    await websocket.send_json({"type": "heartbeat_ack"})
                    continue
                if message_type != "event":
                    db.commit()
                    continue
                task_id = str(message.get("task_id") or "")
                task = db.get(CodingTask, task_id)
                if task is None or task.device_id != device_id:
                    db.commit()
                    continue
                raw_event = message.get("event") or {}
                event_type = str(raw_event.get("type") or "activity")
                payload = raw_event.get("payload") or {}
                event = _append_event(db, task_id, event_type, payload)
            await hub.publish(task_id, event)
    except WebSocketDisconnect:
        pass
    finally:
        await hub.detach(device_id, websocket)
