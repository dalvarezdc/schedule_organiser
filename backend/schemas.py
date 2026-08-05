from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from backend.models import TaskStatus, TaskPriority


class SubtaskInput(BaseModel):
    """Lightweight subtask input used during task creation (becomes a child Task)."""
    title: str
    done: bool = False
    order: int = 0


class TaskBase(BaseModel):
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.pending
    priority: TaskPriority = TaskPriority.medium
    due_date: Optional[datetime] = None
    scheduled_date: Optional[datetime] = None


class TaskCreate(TaskBase):
    parent_id: Optional[str] = None
    order: int = 0
    subtasks: list[SubtaskInput] = []
    notify_slack: bool = True
    notify_discord: bool = True
    sync_calendar: bool = True


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    scheduled_date: Optional[datetime] = None
    parent_id: Optional[str] = None
    order: Optional[int] = None


class TaskOut(TaskBase):
    id: str
    parent_id: Optional[str] = None
    order: int = 0
    google_event_id: Optional[str] = None
    share_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    children: list[TaskOut] = []

    class Config:
        from_attributes = True


TaskOut.model_rebuild()  # required for self-referential model


class ParsedSubtask(BaseModel):
    title: str


class ParsedTask(BaseModel):
    title: str
    description: str
    subtasks: list[ParsedSubtask] = []
    due_date: Optional[datetime] = None
    scheduled_date: Optional[datetime] = None
    priority: TaskPriority = TaskPriority.medium


class ParseRequest(BaseModel):
    text: str


class ParseResponse(BaseModel):
    tasks: list[ParsedTask]


class ImproveResponse(BaseModel):
    title: str
    description: str
    suggested_subtasks: list[ParsedSubtask] = []


class SettingsOut(BaseModel):
    ai_provider: str
    ai_model: str
    ai_base_url: str
    ai_api_key_set: bool
    slack_webhook_url: str
    discord_webhook_url: str
    google_calendar_id: str
    google_connected: bool

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    discord_webhook_url: Optional[str] = None
    google_calendar_id: Optional[str] = None


class SlackBulkNotifyRequest(BaseModel):
    task_ids: list[str]
    slack_webhook_url: Optional[str] = None


class SlackBulkNotifyResponse(BaseModel):
    success: bool
    sent_count: int
    message: str

