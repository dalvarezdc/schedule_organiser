import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base
import enum


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[TaskStatus] = mapped_column(SAEnum(TaskStatus), default=TaskStatus.pending)
    priority: Mapped[TaskPriority] = mapped_column(SAEnum(TaskPriority), default=TaskPriority.medium)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scheduled_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    google_event_id: Mapped[str | None] = mapped_column(String, nullable=True)
    share_token: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subtasks: Mapped[list["Subtask"]] = relationship("Subtask", back_populates="task", cascade="all, delete-orphan", order_by="Subtask.order")


class Subtask(Base):
    __tablename__ = "subtasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)

    task: Mapped["Task"] = relationship("Task", back_populates="subtasks")


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    ai_provider: Mapped[str] = mapped_column(String, default="openai")
    ai_api_key_encrypted: Mapped[str] = mapped_column(Text, default="")
    ai_model: Mapped[str] = mapped_column(String, default="gpt-4o")
    ai_base_url: Mapped[str] = mapped_column(String, default="")
    slack_webhook_url: Mapped[str] = mapped_column(String, default="")
    discord_webhook_url: Mapped[str] = mapped_column(String, default="")
    google_calendar_id: Mapped[str] = mapped_column(String, default="primary")
    google_oauth_token_encrypted: Mapped[str] = mapped_column(Text, default="")
