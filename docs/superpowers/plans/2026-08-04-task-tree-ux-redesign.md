# Task Tree UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat Subtask checklist with a recursive Task tree, unify the data model into a single self-referencing Task entity, add AI-assisted ticket improvement, expand writing space, and apply a professional readable color palette.

**Architecture:** Add `parent_id` and `order` to the `Task` model (self-referencing tree). Migrate existing `Subtask` rows to `Task` rows. Remove all Subtask code paths (model, router, schemas). Add a new `/api/tasks/{id}/improve` endpoint. Replace `SubtaskList` with a recursive `TaskNode` component. Overhaul CSS and Tailwind color tokens.

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy + SQLite (no Alembic — uses `create_all`). React 19 + TypeScript + Tailwind 3 + React Query + React Router.

---

## File Map

**Backend — modified:**
- `backend/models.py` — add `parent_id`, `order`, `children` to `Task`; remove `Subtask`
- `backend/schemas.py` — update `TaskOut` with `parent_id`, `order`, `children`; remove all `Subtask*` schemas
- `backend/routers/tasks.py` — update `list_tasks`, `create_task`, `update_task`; add cycle guard; add `/improve` endpoint
- `backend/services/ai_parser.py` — add `improve_task()` function
- `backend/main.py` — remove subtasks router import

**Backend — removed:**
- `backend/routers/subtasks.py`

**Backend — created:**
- `scripts/migrate_subtasks.py` — one-shot migration script

**Frontend — modified:**
- `frontend/src/types.ts` — update `Task`, remove `Subtask`
- `frontend/src/api/client.ts` — update task calls, remove subtask calls, add `improveTask`
- `frontend/src/index.css` — fix Tailwind directives, remove purple vars, remove bad `#root` rule
- `frontend/src/App.tsx` — minor (no subtask route needed)
- `frontend/src/pages/Dashboard.tsx` — use `TaskTree` instead of `TaskCard` list
- `frontend/src/pages/TaskDetail.tsx` — expand layout, add AI Improve panel, swap subtask form for `TaskTree`
- `frontend/src/components/TaskCard.tsx` — apply new color palette
- `frontend/src/pages/InputPanel.tsx` — expand textarea

**Frontend — created:**
- `frontend/src/components/TaskTree.tsx` — root wrapper
- `frontend/src/components/TaskNode.tsx` — recursive node component
- `frontend/src/components/ImprovePanel.tsx` — AI improve review UI
- `frontend/src/components/TaskPicker.tsx` — searchable picker for "Link existing task"

**Frontend — removed:**
- `frontend/src/components/SubtaskList.tsx`

---

## Task 1: Update Backend Model

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Replace the Subtask class and update Task in `backend/models.py`**

```python
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
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    children: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Task.order",
        foreign_keys="Task.parent_id",
    )
    parent: Mapped["Task | None"] = relationship(
        "Task",
        back_populates="children",
        remote_side="Task.id",
        foreign_keys="Task.parent_id",
    )


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
```

- [ ] **Step 2: Commit**

```bash
git add backend/models.py
git commit -m "feat: unify Task model with parent_id tree, remove Subtask model"
```

---

## Task 2: Write and Run the Migration Script

**Files:**
- Create: `scripts/migrate_subtasks.py`

- [ ] **Step 1: Create migration script**

```python
#!/usr/bin/env python3
"""
One-shot migration: convert existing Subtask rows into child Task rows,
then add parent_id/order columns to tasks if they don't exist yet.

Run from the repo root:
    python scripts/migrate_subtasks.py
"""
import sqlite3
import uuid
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "schedule.db"


def migrate(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. Add parent_id and order columns to tasks (idempotent)
    existing_cols = {row[1] for row in cur.execute("PRAGMA table_info(tasks)")}
    if "parent_id" not in existing_cols:
        cur.execute("ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE")
        print("Added parent_id column to tasks")
    if "order" not in existing_cols:
        cur.execute("ALTER TABLE tasks ADD COLUMN 'order' INTEGER DEFAULT 0")
        print("Added order column to tasks")

    # 2. Check if subtasks table exists
    tables = {row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "subtasks" not in tables:
        print("No subtasks table found — nothing to migrate.")
        conn.commit()
        conn.close()
        return

    # 3. Migrate each subtask row into a Task row
    subtasks = cur.execute("SELECT * FROM subtasks").fetchall()
    migrated = 0
    for sub in subtasks:
        new_id = str(uuid.uuid4())
        status = "done" if sub["done"] else "pending"
        cur.execute(
            """
            INSERT INTO tasks (id, title, description, status, priority,
                               parent_id, 'order', created_at, updated_at)
            VALUES (?, ?, '', ?, 'medium', ?, ?, datetime('now'), datetime('now'))
            """,
            (new_id, sub["title"], status, sub["task_id"], sub["order"]),
        )
        migrated += 1

    print(f"Migrated {migrated} subtask(s) to child Task rows")

    # 4. Drop the subtasks table
    cur.execute("DROP TABLE subtasks")
    print("Dropped subtasks table")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    migrate(DB_PATH)
```

- [ ] **Step 2: Run the migration**

```bash
mkdir -p scripts
python scripts/migrate_subtasks.py
```

Expected output (if subtasks existed):
```
Added parent_id column to tasks
Added order column to tasks
Migrated N subtask(s) to child Task rows
Dropped subtasks table
Migration complete.
```

If the DB is fresh (no subtasks table), output will be:
```
No subtasks table found — nothing to migrate.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate_subtasks.py
git commit -m "feat: migration script — subtasks → child Task rows"
```

---

## Task 3: Update Backend Schemas

**Files:**
- Modify: `backend/schemas.py`

- [ ] **Step 1: Rewrite `backend/schemas.py` — remove Subtask schemas, add tree to TaskOut**

```python
from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from backend.models import TaskStatus, TaskPriority


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


class SubtaskInput(BaseModel):
    """Lightweight subtask input used during task creation (becomes a child Task)."""
    title: str
    done: bool = False
    order: int = 0


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
```

- [ ] **Step 2: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: update schemas — TaskOut with children tree, remove Subtask schemas"
```

---

## Task 4: Update Tasks Router + Add Improve Endpoint

**Files:**
- Modify: `backend/routers/tasks.py`

- [ ] **Step 1: Rewrite `backend/routers/tasks.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, TaskStatus
from backend.schemas import TaskCreate, TaskUpdate, TaskOut, ImproveResponse
from backend.routers.settings import _get_or_create_settings
from backend.services.notifications import send_task_created, send_task_done
from backend.services.calendar import create_event, update_event, delete_event
from backend.services.ai_parser import improve_task
from backend.crypto import decrypt
from datetime import datetime

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_task_or_404(task_id: str, db: Session) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _collect_descendant_ids(task: Task) -> set[str]:
    """Return all descendant IDs of a task (not including the task itself)."""
    ids = set()
    for child in task.children:
        ids.add(child.id)
        ids |= _collect_descendant_ids(child)
    return ids


def _validate_parent(task_id: str, new_parent_id: str, db: Session) -> None:
    """Raise 400 if setting parent_id would create a cycle."""
    if new_parent_id == task_id:
        raise HTTPException(status_code=400, detail="A task cannot be its own parent.")
    task = _get_task_or_404(task_id, db)
    descendants = _collect_descendant_ids(task)
    if new_parent_id in descendants:
        raise HTTPException(status_code=400, detail="Cannot set a descendant as parent (cycle).")


async def _sync_create_calendar_event(
    task_id: str, token: str, calendar_id: str,
    title: str, description: str, date: datetime,
    db: Session,
) -> None:
    event_id = create_event(token, calendar_id, title, description, date)
    task = db.get(Task, task_id)
    if task:
        task.google_event_id = event_id
        db.commit()


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    """Return root tasks only; children are nested via the relationship."""
    return db.query(Task).filter(Task.parent_id.is_(None)).order_by(Task.created_at.desc()).all()


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    return _get_task_or_404(task_id, db)


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if payload.parent_id:
        _validate_parent("__new__", payload.parent_id, db)
        # Just verify parent exists
        _get_task_or_404(payload.parent_id, db)

    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        scheduled_date=payload.scheduled_date,
        parent_id=payload.parent_id,
        order=payload.order,
    )
    db.add(task)
    db.flush()

    # Create inline subtasks as child Tasks
    for i, sub in enumerate(payload.subtasks):
        child = Task(
            title=sub.title,
            status=TaskStatus.done if sub.done else TaskStatus.pending,
            priority=task.priority,
            parent_id=task.id,
            order=sub.order or i,
        )
        db.add(child)

    db.commit()
    db.refresh(task)

    s = _get_or_create_settings(db)
    if payload.notify_slack and s.slack_webhook_url:
        background_tasks.add_task(
            send_task_created,
            title=task.title, description=task.description,
            due_date=task.due_date, task_id=task.id,
            slack_url=s.slack_webhook_url, discord_url="",
        )
    if payload.notify_discord and s.discord_webhook_url:
        background_tasks.add_task(
            send_task_created,
            title=task.title, description=task.description,
            due_date=task.due_date, task_id=task.id,
            slack_url="", discord_url=s.discord_webhook_url,
        )
    if payload.sync_calendar and (task.due_date or task.scheduled_date) and s.google_oauth_token_encrypted:
        token = decrypt(s.google_oauth_token_encrypted)
        date = task.due_date or task.scheduled_date
        background_tasks.add_task(
            _sync_create_calendar_event,
            task_id=task.id, token=token, calendar_id=s.google_calendar_id,
            title=task.title, description=task.description, date=date, db=db,
        )
    return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)

    if payload.parent_id is not None:
        _validate_parent(task_id, payload.parent_id, db)
        _get_task_or_404(payload.parent_id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    # Notify if task moved to done
    s = _get_or_create_settings(db)
    if payload.status == "done" and s.slack_webhook_url:
        pass  # send_task_done could be called here if desired

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)
    db.delete(task)
    db.commit()


@router.post("/{task_id}/improve", response_model=ImproveResponse)
async def improve_task_endpoint(task_id: str, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)
    s = _get_or_create_settings(db)
    if not s.ai_api_key_encrypted:
        raise HTTPException(status_code=400, detail="AI API key not configured. Set it in Settings.")
    api_key = decrypt(s.ai_api_key_encrypted)
    try:
        result = await improve_task(
            title=task.title,
            description=task.description,
            provider=s.ai_provider,
            api_key=api_key,
            model=s.ai_model,
            base_url=s.ai_base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI improve failed: {e}")
    return result


@router.post("/{task_id}/share")
def generate_share_link(task_id: str, db: Session = Depends(get_db)):
    import secrets
    task = _get_task_or_404(task_id, db)
    if not task.share_token:
        task.share_token = secrets.token_urlsafe(16)
        db.commit()
        db.refresh(task)
    from fastapi import Request
    share_url = f"/share/{task.share_token}"
    return {"share_token": task.share_token, "share_url": share_url}


@router.delete("/{task_id}/share", status_code=204)
def revoke_share_link(task_id: str, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)
    task.share_token = None
    db.commit()
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/tasks.py
git commit -m "feat: update tasks router — tree list, re-parenting, cycle guard, /improve endpoint"
```

---

## Task 5: Add `improve_task()` to AI Parser

**Files:**
- Modify: `backend/services/ai_parser.py`

- [ ] **Step 1: Add `IMPROVE_SYSTEM_PROMPT` and `improve_task()` to the bottom of `backend/services/ai_parser.py`**

Add after the final `parse_text` function:

```python
IMPROVE_SYSTEM_PROMPT = """You are a project management assistant. The user will give you a task title and description.

Your job is to:
1. Rewrite the title to be clear and concise (action-oriented, under 80 chars)
2. Expand the description into a well-structured 2-5 sentence explanation of what needs to be done, why, and any key acceptance criteria
3. Suggest 2-5 concrete subtasks as an array

Return ONLY a valid JSON object (not an array). No markdown, no explanation. Example:
{
  "title": "Implement user authentication",
  "description": "Add JWT-based login and registration endpoints. Users should be able to sign up with email/password, receive a token, and use that token to access protected routes. Acceptance: all auth tests pass, tokens expire after 24h.",
  "suggested_subtasks": [
    {"title": "Create /auth/register endpoint"},
    {"title": "Create /auth/login endpoint"},
    {"title": "Add JWT middleware to protected routes"}
  ]
}"""


async def improve_task(
    title: str,
    description: str,
    provider: str,
    api_key: str,
    model: str,
    base_url: str,
) -> dict:
    """Call AI to improve a task's title, description, and suggest subtasks."""
    user_content = f"Title: {title}\n\nDescription: {description or '(none)'}"
    raw = await _call_ai(user_content, provider, api_key, model, base_url)
    # _call_ai returns list[dict] — but improve returns a single object.
    # We need a separate dispatch that returns a raw string instead.
    # Use the internal helpers directly.
    if provider == "anthropic":
        data_list = await _call_anthropic(user_content, api_key, model, base_url)
    elif provider == "gemini":
        data_list = await _call_gemini(user_content, api_key, model or "gemini-1.5-flash")
    elif provider == "grok":
        base = base_url or "https://api.x.ai"
        data_list = await _call_openai_compatible(user_content, api_key, model or "grok-4.5", base)
    else:
        base = base_url or "https://api.openai.com"
        data_list = await _call_openai_compatible(user_content, api_key, model, base)
    # _parse_json_response already handles dict with known keys — but those helpers
    # go through _parse_json_response which normalises to list. We need raw dict.
    # Re-implement a direct call that preserves the dict.
    return await _improve_call_ai(user_content, provider, api_key, model, base_url)


async def _improve_call_ai(text: str, provider: str, api_key: str, model: str, base_url: str) -> dict:
    """Call AI with IMPROVE_SYSTEM_PROMPT and return raw dict (not list)."""
    if provider == "anthropic":
        base = base_url or "https://api.anthropic.com"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": 1024,
            "system": IMPROVE_SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": text}],
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{base}/v1/messages", json=body, headers=headers, timeout=30)
            resp.raise_for_status()
            raw = resp.json()["content"][0]["text"]
        return _parse_improve_response(raw)

    if provider == "gemini":
        m = model or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"
        body = {
            "system_instruction": {"parts": [{"text": IMPROVE_SYSTEM_PROMPT}]},
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {"responseMimeType": "application/json"},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=body, headers={"Content-Type": "application/json"},
                                     params={"key": api_key}, timeout=30)
            resp.raise_for_status()
        raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        return _parse_improve_response(raw)

    # openai-compatible (openai, grok, custom)
    if provider == "grok":
        base = base_url or "https://api.x.ai"
        m = model or "grok-4.5"
    else:
        base = base_url or "https://api.openai.com"
        m = model
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": m,
        "messages": [
            {"role": "system", "content": IMPROVE_SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{base}/v1/chat/completions", json=body, headers=headers, timeout=30)
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
    return _parse_improve_response(raw)


def _parse_improve_response(raw: str) -> dict:
    """Parse a single-object JSON response from the improve prompt."""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}") from e
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got: {type(data)}")
    return {
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "suggested_subtasks": data.get("suggested_subtasks", []),
    }
```

Now simplify `improve_task()` — the above draft has redundant code. Replace the whole `improve_task` function with:

```python
async def improve_task(
    title: str,
    description: str,
    provider: str,
    api_key: str,
    model: str,
    base_url: str,
) -> dict:
    """Call AI to improve a task's title, description, and suggest subtasks."""
    user_content = f"Title: {title}\n\nDescription: {description or '(none)'}"
    return await _improve_call_ai(user_content, provider, api_key, model, base_url)
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/ai_parser.py
git commit -m "feat: add improve_task() to ai_parser — rewrites title/desc, suggests subtasks"
```

---

## Task 6: Update `main.py` — Remove Subtasks Router

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Remove subtasks router from `backend/main.py`**

Replace:
```python
from backend.routers import tasks, subtasks, settings, parse, share, integrations
```
with:
```python
from backend.routers import tasks, settings, parse, share, integrations
```

And remove:
```python
app.include_router(subtasks.router)
```

- [ ] **Step 2: Delete the subtasks router file**

```bash
rm backend/routers/subtasks.py
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git rm backend/routers/subtasks.py
git commit -m "feat: remove subtasks router — unified into Task tree"
```

---

## Task 7: Update Frontend Types and API Client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Rewrite `frontend/src/types.ts`**

```typescript
export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  scheduled_date: string | null
  google_event_id: string | null
  share_token: string | null
  parent_id: string | null
  order: number
  created_at: string
  updated_at: string
  children: Task[]
}

export interface ParsedSubtask {
  title: string
}

export interface ParsedTask {
  title: string
  description: string
  subtasks: ParsedSubtask[]
  due_date: string | null
  scheduled_date: string | null
  priority: TaskPriority
}

export interface ImproveResult {
  title: string
  description: string
  suggested_subtasks: ParsedSubtask[]
}

export interface Settings {
  ai_provider: string
  ai_model: string
  ai_base_url: string
  ai_api_key_set: boolean
  slack_webhook_url: string
  discord_webhook_url: string
  google_calendar_id: string
  google_connected: boolean
}
```

- [ ] **Step 2: Rewrite `frontend/src/api/client.ts`**

```typescript
import axios from 'axios'
import type { Task, ParsedTask, Settings, ImproveResult } from '../types'

const api = axios.create({ baseURL: '/api' })

// Tasks
export const getTasks = () => api.get<Task[]>('/tasks').then(r => r.data)
export const getTask = (id: string) => api.get<Task>(`/tasks/${id}`).then(r => r.data)
export const createTask = (payload: Partial<Task> & { subtasks?: { title: string; done?: boolean; order?: number }[], parent_id?: string | null, notify_slack?: boolean, notify_discord?: boolean, sync_calendar?: boolean }) =>
  api.post<Task>('/tasks', payload).then(r => r.data)
export const updateTask = (id: string, payload: Partial<Task>) =>
  api.put<Task>(`/tasks/${id}`, payload).then(r => r.data)
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`)

// Link an existing task as a child
export const linkAsChild = (childId: string, parentId: string) =>
  api.put<Task>(`/tasks/${childId}`, { parent_id: parentId }).then(r => r.data)

// Unlink a task (move to root)
export const unlinkTask = (taskId: string) =>
  api.put<Task>(`/tasks/${taskId}`, { parent_id: null }).then(r => r.data)

// AI Improve
export const improveTask = (id: string) =>
  api.post<ImproveResult>(`/tasks/${id}/improve`).then(r => r.data)

// Parse
export const parseText = (text: string) =>
  api.post<{ tasks: ParsedTask[] }>('/parse', { text }).then(r => r.data)

// Settings
export const getSettings = () => api.get<Settings>('/settings').then(r => r.data)
export const updateSettings = (payload: Partial<Settings> & { ai_api_key?: string }) =>
  api.put<Settings>('/settings', payload).then(r => r.data)

// Share
export const generateShareLink = (taskId: string) =>
  api.post<{ share_token: string; share_url: string }>(`/tasks/${taskId}/share`).then(r => r.data)
export const revokeShareLink = (taskId: string) => api.delete(`/tasks/${taskId}/share`)
export const getSharedTask = (token: string) => api.get<Task>(`/share/${token}`).then(r => r.data)
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts
git commit -m "feat: update frontend types and API client for task tree"
```

---

## Task 8: Fix `index.css`

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Rewrite `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --sans: system-ui, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, Consolas, monospace;

  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.5;
  color-scheme: light;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}

body {
  margin: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix: move tailwind directives to top, remove conflicting purple CSS vars"
```

---

## Task 9: Create `TaskNode` Component

**Files:**
- Create: `frontend/src/components/TaskNode.tsx`

- [ ] **Step 1: Create `frontend/src/components/TaskNode.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { Task } from '../types'
import { createTask, updateTask, deleteTask, linkAsChild } from '../api/client'
import TaskPicker from './TaskPicker'

const priorityBadge: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-medium',
  high: 'bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2 py-0.5 rounded-full font-medium',
}

const statusLabel: Record<string, string> = {
  pending: 'text-slate-500',
  in_progress: 'text-indigo-600',
  done: 'text-emerald-600',
}

interface Props {
  task: Task
  depth?: number
  onRefresh: () => void
  allRootTasks?: Task[]
}

export default function TaskNode({ task, depth = 0, onRefresh, allRootTasks = [] }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [showDesc, setShowDesc] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [newChildTitle, setNewChildTitle] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const qc = useQueryClient()

  const hasChildren = task.children.length > 0
  const indent = depth * 20

  const toggleDone = async () => {
    const next = task.status === 'done' ? 'pending' : 'done'
    await updateTask(task.id, { status: next })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['task', task.id] })
    onRefresh()
  }

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChildTitle.trim()) return
    await createTask({ title: newChildTitle.trim(), parent_id: task.id, order: task.children.length })
    setNewChildTitle('')
    setAddingChild(false)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    onRefresh()
  }

  const handleDelete = async () => {
    const hasKids = task.children.length > 0
    const msg = hasKids
      ? `Delete "${task.title}" and all ${task.children.length} subtask(s) under it?`
      : `Delete "${task.title}"?`
    if (!confirm(msg)) return
    await deleteTask(task.id)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    onRefresh()
  }

  const handleLink = async (selectedId: string) => {
    await linkAsChild(selectedId, task.id)
    setShowPicker(false)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    onRefresh()
  }

  return (
    <div style={{ marginLeft: indent }}>
      <div className="flex items-start gap-2 py-1.5 group">
        {/* Expand/collapse chevron */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-0.5 text-slate-400 hover:text-slate-600 w-4 shrink-0 text-xs"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (expanded ? '▼' : '▶') : '·'}
        </button>

        {/* Done checkbox */}
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onChange={toggleDone}
          className="mt-1 shrink-0 accent-indigo-600"
        />

        {/* Title + metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/tasks/${task.id}`}
              className={`font-medium hover:text-indigo-600 transition-colors ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}
            >
              {task.title}
            </Link>
            <span className={priorityBadge[task.priority]}>{task.priority}</span>
            <span className={`text-xs ${statusLabel[task.status]}`}>{task.status.replace('_', ' ')}</span>
          </div>

          {/* Description toggle */}
          {task.description && (
            <button
              onClick={() => setShowDesc(s => !s)}
              className="text-xs text-slate-400 hover:text-slate-600 mt-0.5"
            >
              {showDesc ? '▲ Hide description' : '▼ Show description'}
            </button>
          )}
          {showDesc && task.description && (
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{task.description}</p>
          )}
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setAddingChild(a => !a)}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
          >
            + Subtask
          </button>
          <button
            onClick={() => setShowPicker(s => !s)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Link
          </button>
          <button
            onClick={handleDelete}
            className="text-xs text-rose-400 hover:text-rose-600"
            aria-label="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Inline add child form */}
      {addingChild && (
        <form onSubmit={handleAddChild} className="flex gap-2 mt-1 mb-1" style={{ marginLeft: 24 }}>
          <input
            autoFocus
            value={newChildTitle}
            onChange={e => setNewChildTitle(e.target.value)}
            placeholder="New subtask title…"
            className="flex-1 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          />
          <button type="submit" className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700">
            Add
          </button>
          <button type="button" onClick={() => setAddingChild(false)} className="text-slate-400 text-sm px-2">
            Cancel
          </button>
        </form>
      )}

      {/* Link existing task picker */}
      {showPicker && (
        <div style={{ marginLeft: 24 }} className="mb-2">
          <TaskPicker
            excludeIds={new Set([task.id, ..._allIds(task)])}
            allTasks={allRootTasks}
            onSelect={handleLink}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div className="border-l border-slate-100 ml-2">
          {task.children.map(child => (
            <TaskNode
              key={child.id}
              task={child}
              depth={depth + 1}
              onRefresh={onRefresh}
              allRootTasks={allRootTasks}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Collect all descendant IDs of a task (to exclude from picker). */
function _allIds(task: Task): string[] {
  return task.children.flatMap(c => [c.id, ..._allIds(c)])
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TaskNode.tsx
git commit -m "feat: add recursive TaskNode component with expand/collapse, inline add, link, delete"
```

---

## Task 10: Create `TaskPicker` Component

**Files:**
- Create: `frontend/src/components/TaskPicker.tsx`

- [ ] **Step 1: Create `frontend/src/components/TaskPicker.tsx`**

```tsx
import { useState } from 'react'
import type { Task } from '../types'

interface Props {
  allTasks: Task[]
  excludeIds: Set<string>
  onSelect: (taskId: string) => void
  onClose: () => void
}

function flattenTasks(tasks: Task[], exclude: Set<string>): Task[] {
  const result: Task[] = []
  const walk = (list: Task[]) => {
    for (const t of list) {
      if (!exclude.has(t.id)) result.push(t)
      walk(t.children)
    }
  }
  walk(tasks)
  return result
}

export default function TaskPicker({ allTasks, excludeIds, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const candidates = flattenTasks(allTasks, excludeIds)
  const filtered = candidates.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="border border-slate-200 rounded-lg bg-white shadow-md p-3 w-80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600">Link existing task as subtask</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
      </div>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search tasks…"
        className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 mb-2"
      />
      <ul className="max-h-48 overflow-y-auto space-y-1">
        {filtered.length === 0 && (
          <li className="text-xs text-slate-400 px-2 py-1">No matching tasks</li>
        )}
        {filtered.map(t => (
          <li key={t.id}>
            <button
              onClick={() => onSelect(t.id)}
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors"
            >
              {t.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TaskPicker.tsx
git commit -m "feat: add TaskPicker component for linking existing tasks as children"
```

---

## Task 11: Create `TaskTree` Component

**Files:**
- Create: `frontend/src/components/TaskTree.tsx`

- [ ] **Step 1: Create `frontend/src/components/TaskTree.tsx`**

```tsx
import type { Task } from '../types'
import TaskNode from './TaskNode'

interface Props {
  tasks: Task[]
  onRefresh: () => void
}

export default function TaskTree({ tasks, onRefresh }: Props) {
  if (tasks.length === 0) return null
  return (
    <div className="space-y-1">
      {tasks.map(task => (
        <TaskNode
          key={task.id}
          task={task}
          depth={0}
          onRefresh={onRefresh}
          allRootTasks={tasks}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TaskTree.tsx
git commit -m "feat: add TaskTree root wrapper component"
```

---

## Task 12: Create `ImprovePanel` Component

**Files:**
- Create: `frontend/src/components/ImprovePanel.tsx`

- [ ] **Step 1: Create `frontend/src/components/ImprovePanel.tsx`**

```tsx
import { useState } from 'react'
import type { ImproveResult } from '../types'

interface Props {
  result: ImproveResult
  onApply: (title: string, description: string, acceptedSubtasks: string[]) => void
  onCancel: () => void
}

export default function ImprovePanel({ result, onApply, onCancel }: Props) {
  const [title, setTitle] = useState(result.title)
  const [description, setDescription] = useState(result.description)
  const [checked, setChecked] = useState<boolean[]>(result.suggested_subtasks.map(() => true))

  const toggle = (i: number) => setChecked(c => c.map((v, j) => (i === j ? !v : v)))

  const handleApply = () => {
    const accepted = result.suggested_subtasks
      .filter((_, i) => checked[i])
      .map(s => s.title)
    onApply(title, description, accepted)
  }

  return (
    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-4 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-indigo-800">AI suggestions — review before applying</h4>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xs">✕ Discard</button>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">Improved title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">Improved description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={5}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-vertical bg-white"
        />
      </div>

      {result.suggested_subtasks.length > 0 && (
        <div>
          <label className="block text-xs text-slate-500 mb-2">Suggested subtasks (uncheck to skip)</label>
          <ul className="space-y-1">
            {result.suggested_subtasks.map((sub, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  className="accent-indigo-600"
                />
                <span className={checked[i] ? 'text-slate-700' : 'text-slate-400 line-through'}>{sub.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={handleApply}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Apply changes
        </button>
        <button
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 text-sm px-2"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ImprovePanel.tsx
git commit -m "feat: add ImprovePanel component for AI ticket improvement review"
```

---

## Task 13: Update `TaskDetail` Page

**Files:**
- Modify: `frontend/src/pages/TaskDetail.tsx`

- [ ] **Step 1: Rewrite `frontend/src/pages/TaskDetail.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTask, updateTask, deleteTask, createTask, generateShareLink, revokeShareLink, improveTask } from '../api/client'
import TaskTree from '../components/TaskTree'
import ImprovePanel from '../components/ImprovePanel'
import { useState } from 'react'
import type { ImproveResult } from '../types'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: task, isLoading, refetch } = useQuery({ queryKey: ['task', id], queryFn: () => getTask(id!) })

  const [shareUrl, setShareUrl] = useState('')
  const [improving, setImproving] = useState(false)
  const [improveError, setImproveError] = useState('')
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null)

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>
  if (!task) return <div className="p-8 text-rose-500">Task not found.</div>

  const update = async (field: string, value: string | null) => {
    await updateTask(task.id, { [field]: value } as any)
    qc.invalidateQueries({ queryKey: ['task', id] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task and all its subtasks?')) return
    await deleteTask(task.id)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    navigate('/tasks')
  }

  const handleShare = async () => {
    const result = await generateShareLink(task.id)
    setShareUrl(result.share_url)
    qc.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleRevoke = async () => {
    await revokeShareLink(task.id)
    setShareUrl('')
    qc.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleImprove = async () => {
    setImproving(true)
    setImproveError('')
    setImproveResult(null)
    try {
      const result = await improveTask(task.id)
      setImproveResult(result)
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'AI improve failed.'
      setImproveError(detail)
    } finally {
      setImproving(false)
    }
  }

  const handleApplyImprove = async (newTitle: string, newDesc: string, subtaskTitles: string[]) => {
    await updateTask(task.id, { title: newTitle, description: newDesc })
    for (let i = 0; i < subtaskTitles.length; i++) {
      await createTask({ title: subtaskTitles[i], parent_id: task.id, order: task.children.length + i })
    }
    setImproveResult(null)
    qc.invalidateQueries({ queryKey: ['task', id] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    refetch()
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/tasks')} className="text-sm text-slate-400 hover:text-slate-600">← Back</button>
        <button onClick={handleDelete} className="text-sm text-rose-400 hover:text-rose-600">Delete task</button>
      </div>

      {/* Title */}
      <input
        defaultValue={task.title}
        onBlur={e => update('title', e.target.value)}
        className="w-full text-2xl font-bold text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none pb-1 bg-transparent"
      />

      {/* Status + Priority */}
      <div className="flex gap-3 flex-wrap">
        <select
          defaultValue={task.status}
          onChange={e => update('status', e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          defaultValue={task.priority}
          onChange={e => update('priority', e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-slate-500 font-medium">Description</label>
          <button
            onClick={handleImprove}
            disabled={improving}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 flex items-center gap-1"
          >
            {improving ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Improving…
              </>
            ) : (
              '✦ Improve with AI'
            )}
          </button>
        </div>
        <textarea
          defaultValue={task.description}
          onBlur={e => update('description', e.target.value)}
          rows={12}
          placeholder="Describe the task in detail…"
          className="w-full border border-slate-200 rounded-xl p-4 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 resize-vertical leading-relaxed"
          style={{ minHeight: '200px' }}
        />

        {improveError && (
          <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
            {improveError}
          </div>
        )}

        {improveResult && (
          <ImprovePanel
            result={improveResult}
            onApply={handleApplyImprove}
            onCancel={() => setImproveResult(null)}
          />
        )}
      </div>

      {/* Dates */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Due date</label>
          <input
            type="date"
            defaultValue={task.due_date ? task.due_date.split('T')[0] : ''}
            onBlur={e => update('due_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Scheduled date</label>
          <input
            type="date"
            defaultValue={task.scheduled_date ? task.scheduled_date.split('T')[0] : ''}
            onBlur={e => update('scheduled_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      {task.google_event_id && (
        <p className="text-xs text-indigo-500">Synced to Google Calendar</p>
      )}

      {/* Subtask tree */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Subtasks</h3>
        {task.children.length > 0 ? (
          <TaskTree tasks={task.children} onRefresh={() => refetch()} />
        ) : (
          <p className="text-sm text-slate-400">No subtasks yet.</p>
        )}
        {/* Quick add at root level of this task */}
        <QuickAddChild parentId={task.id} onAdded={() => { qc.invalidateQueries({ queryKey: ['task', id] }); refetch() }} />
      </div>

      {/* Share */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-2">Share</h3>
        {task.share_token ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 break-all">{shareUrl || `${window.location.origin}/share/${task.share_token}`}</p>
            <button onClick={handleRevoke} className="text-sm text-rose-400 hover:text-rose-600">Revoke link</button>
          </div>
        ) : (
          <button onClick={handleShare} className="text-sm text-indigo-600 hover:text-indigo-800">Generate share link</button>
        )}
      </div>
    </div>
  )
}

function QuickAddChild({ parentId, onAdded }: { parentId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await createTask({ title: title.trim(), parent_id: parentId })
    setTitle('')
    setOpen(false)
    qc.invalidateQueries({ queryKey: ['tasks'] })
    onAdded()
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-3 text-sm text-indigo-500 hover:text-indigo-700 font-medium">
      + Add subtask
    </button>
  )

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="New subtask title…"
        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
      />
      <button type="submit" className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700">Add</button>
      <button type="button" onClick={() => setOpen(false)} className="text-slate-400 text-sm px-2">Cancel</button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/TaskDetail.tsx
git commit -m "feat: TaskDetail — wider layout, larger textarea, AI improve, task tree"
```

---

## Task 14: Update `Dashboard` Page

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Rewrite `frontend/src/pages/Dashboard.tsx`**

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTasks } from '../api/client'
import TaskTree from '../components/TaskTree'
import { useState } from 'react'
import type { TaskStatus, TaskPriority, Task } from '../types'

export default function Dashboard() {
  const qc = useQueryClient()
  const { data: tasks = [], isLoading, refetch } = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')

  const filtered = tasks.filter((t: Task) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Tasks</h1>
        <Link
          to="/"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          + Add Tasks
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {isLoading && <p className="text-slate-400">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-slate-400 text-center py-16">
          No tasks yet.{' '}
          <Link to="/" className="text-indigo-500 hover:text-indigo-700">Add some!</Link>
        </p>
      )}

      <TaskTree
        tasks={filtered}
        onRefresh={() => {
          qc.invalidateQueries({ queryKey: ['tasks'] })
          refetch()
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: Dashboard uses TaskTree instead of flat TaskCard list"
```

---

## Task 15: Remove Old Components

**Files:**
- Remove: `frontend/src/components/SubtaskList.tsx`
- Remove: `frontend/src/components/TaskCard.tsx`

- [ ] **Step 1: Delete old components**

```bash
git rm frontend/src/components/SubtaskList.tsx
git rm frontend/src/components/TaskCard.tsx
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove SubtaskList and TaskCard — replaced by TaskTree/TaskNode"
```

---

## Task 16: Expand InputPanel Textarea

**Files:**
- Modify: `frontend/src/pages/InputPanel.tsx`

- [ ] **Step 1: Increase textarea rows and update button color**

In `frontend/src/pages/InputPanel.tsx`, change `rows={9}` to `rows={14}` and update the button class from `bg-blue-600 ... hover:bg-blue-700` to `bg-indigo-600 ... hover:bg-indigo-700`:

```tsx
<textarea
  value={text}
  onChange={e => setText(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="e.g. I need to finish the Q3 report by Friday. It needs a data section, an executive summary, and sign-off from the team. Also book a dentist and call the accountant about taxes before end of month..."
  rows={14}
  autoFocus
  className="w-full border border-slate-200 rounded-2xl p-5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none transition-all leading-relaxed"
/>
```

And the button:
```tsx
<button
  onClick={handleParse}
  disabled={parsing || !text.trim()}
  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-2"
>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/InputPanel.tsx
git commit -m "feat: expand InputPanel textarea, apply indigo button color"
```

---

## Task 17: Build and Verify

- [ ] **Step 1: Run the migration (if not already done)**

```bash
python scripts/migrate_subtasks.py
```

- [ ] **Step 2: Restart backend to apply model changes**

```bash
. .venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl -s http://localhost:8000/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 3: Test the API**

```bash
# Create a root task
curl -s -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Root task", "description": "Test root", "notify_slack": false, "notify_discord": false, "sync_calendar": false}' | python3 -m json.tool

# Note the id, then create a child
TASK_ID="<paste-id-here>"
curl -s -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Child task\", \"parent_id\": \"$TASK_ID\", \"notify_slack\": false, \"notify_discord\": false, \"sync_calendar\": false}" | python3 -m json.tool

# List root tasks — should show root with children nested
curl -s http://localhost:8000/api/tasks | python3 -m json.tool
```

- [ ] **Step 4: Build frontend**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Run existing tests**

```bash
. .venv/bin/activate && pytest tests/ -v
```

Fix any failing tests related to the removed Subtask model.

- [ ] **Step 6: Kill background server**

```bash
pkill -f "uvicorn backend.main" || true
```

- [ ] **Step 7: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: update tests for unified Task tree model"
```
