from datetime import datetime

from pydantic import BaseModel, Field


class WorkspaceOut(BaseModel):
    id: str
    name: str
    path_hint: str | None = None


class CodingDeviceOut(BaseModel):
    id: str
    name: str
    connected: bool
    capabilities: dict
    created_at: datetime
    last_seen_at: datetime | None


class PairingCodeOut(BaseModel):
    code: str
    expires_at: datetime


class PairDeviceIn(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=80)


class PairedDeviceOut(BaseModel):
    device_id: str
    device_token: str


class TaskCreate(BaseModel):
    device_id: str
    workspace_id: str
    workspace_name: str = Field(min_length=1, max_length=160)
    prompt: str = Field(default="", max_length=100_000)
    model: str
    isolated: bool = False


class TaskMessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=100_000)
    model: str | None = None


class TaskUpdate(BaseModel):
    model: str | None = Field(default=None, min_length=1, max_length=240)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    workspace_id: str | None = Field(default=None, min_length=1, max_length=240)
    workspace_name: str | None = Field(default=None, min_length=1, max_length=160)


class TaskActionIn(BaseModel):
    type: str
    payload: dict = Field(default_factory=dict)


class CodingEventOut(BaseModel):
    seq: int
    type: str
    payload: dict
    created_at: datetime


class CodingTaskOut(BaseModel):
    id: str
    device_id: str
    title: str
    workspace_id: str
    workspace_name: str
    model: str
    branch: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class CodingTaskDetail(CodingTaskOut):
    events: list[CodingEventOut]
