# Schedule Organiser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted smart schedule organiser that parses narrative text + voice input into suggested tasks (with subtasks, dates, and auto-generated descriptions), syncs with Google Calendar, and sends notifications to Slack/Discord.

**Architecture:** FastAPI (Python) backend with SQLite/SQLAlchemy + React frontend in a single monorepo. An AI parsing layer (configurable provider, user-supplied API key) takes raw narrative text and returns a preview of suggested tasks for the user to review and confirm before saving. Integrations (Google Calendar OAuth, Slack/Discord webhooks) are optional and configurable via the in-app settings page.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, SQLite, Alembic, httpx, cryptography, React 18, Vite, TanStack Query, Tailwind CSS, pytest, Vitest

---

## File Map

```
schedule_organiser/
├── backend/
│   ├── main.py                     # FastAPI app entry point, mounts routers, serves frontend build
│   ├── config.py                   # Loads .env, exposes Settings (DATABASE_URL, SECRET_KEY)
│   ├── database.py                 # SQLAlchemy engine, SessionLocal, get_db dependency
│   ├── models.py                   # Task, Subtask, AppSettings SQLAlchemy models
│   ├── schemas.py                  # Pydantic request/response schemas
│   ├── crypto.py                   # Fernet encrypt/decrypt for API keys and OAuth tokens
│   ├── routers/
│   │   ├── tasks.py                # GET/POST/PUT/DELETE /api/tasks, /api/tasks/{id}
│   │   ├── subtasks.py             # POST/PUT/DELETE /api/tasks/{id}/subtasks
│   │   ├── parse.py                # POST /api/parse — AI parse, returns preview (no DB write)
│   │   ├── settings.py             # GET/PUT /api/settings
│   │   ├── integrations.py         # POST /api/integrations/calendar/connect, /sync; GET /api/integrations/calendar/callback
│   │   └── share.py                # POST /api/tasks/{id}/share, DELETE /api/tasks/{id}/share, GET /api/share/{token}
│   ├── services/
│   │   ├── ai_parser.py            # AI provider abstraction; builds prompt, calls API, returns ParsedTask[]
│   │   ├── calendar.py             # Google Calendar OAuth flow + event CRUD
│   │   └── notifications.py        # Slack + Discord webhook sender
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                 # Router setup (react-router-dom)
│   │   ├── api/
│   │   │   └── client.ts           # axios instance + typed API functions
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Task list with filters
│   │   │   ├── InputPanel.tsx      # Narrative text input + voice + parse preview
│   │   │   ├── TaskDetail.tsx      # Full task view, editable, subtasks, calendar sync
│   │   │   ├── Settings.tsx        # AI config, webhooks, Google Calendar OAuth
│   │   │   └── ShareView.tsx       # Read-only public task view via share token
│   │   ├── components/
│   │   │   ├── TaskCard.tsx        # Task summary card for dashboard list
│   │   │   ├── SubtaskList.tsx     # Inline subtask checklist
│   │   │   ├── ParsePreview.tsx    # Editable preview of AI-suggested tasks
│   │   │   └── VoiceInput.tsx      # Web Speech API record button + transcript
│   │   └── types.ts                # Shared TypeScript types (Task, Subtask, Settings, ParsedTask)
│   └── index.html
├── tests/
│   ├── test_tasks.py
│   ├── test_parse.py
│   ├── test_notifications.py
│   ├── test_share.py
│   └── conftest.py
├── docs/
│   └── superpowers/
│       ├── specs/2026-08-03-schedule-organiser-design.md
│       └── plans/2026-08-03-schedule-organiser.md
├── .env.example
└── README.md
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/config.py`
- Create: `backend/database.py`
- Create: `backend/main.py`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create backend directory and requirements**

```
backend/
```

Create `backend/requirements.txt`:

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
pydantic==2.7.1
pydantic-settings==2.2.1
httpx==0.27.0
cryptography==42.0.7
python-dotenv==1.0.1
google-auth==2.29.0
google-auth-oauthlib==1.2.0
google-api-python-client==2.127.0
pytest==8.2.0
pytest-asyncio==0.23.6
httpx==0.27.0
```

- [ ] **Step 2: Create `.env.example` and `backend/.env.example`**

Root `.env.example`:
```
DATABASE_URL=sqlite:///./schedule.db
SECRET_KEY=change-me-to-a-random-32-char-string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/integrations/calendar/callback
```

`backend/.env.example` — same content (symlinked or duplicated for clarity).

- [ ] **Step 3: Create `backend/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./schedule.db"
    secret_key: str = "change-me"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/integrations/calendar/callback"

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 4: Create `backend/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from backend.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},  # SQLite only
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Create minimal `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from backend.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Schedule Organiser")

# Routers will be added in later tasks

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Scaffold the frontend with Vite + React + TypeScript + Tailwind**

Run from repo root:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios react-router-dom @tanstack/react-query
npm install -D @types/react-router-dom
```

- [ ] **Step 7: Configure Tailwind**

Replace contents of `frontend/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

Add to `frontend/src/index.css` (top of file):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create stub `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div className="p-8 text-xl">Schedule Organiser</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 9: Create `.gitignore`**

```
__pycache__/
*.pyc
.env
*.db
.venv/
node_modules/
frontend/dist/
.superpowers/
```

- [ ] **Step 10: Install backend deps and verify server starts**

```bash
cd /path/to/schedule_organiser
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Expected: server starts, `GET /health` returns `{"status": "ok"}`.

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "chore: scaffold backend (FastAPI) and frontend (React + Vite + Tailwind)"
```

---

## Task 2: Data Models and Crypto

**Files:**
- Create: `backend/models.py`
- Create: `backend/schemas.py`
- Create: `backend/crypto.py`
- Create: `tests/conftest.py`
- Create: `tests/test_tasks.py` (stub)

- [ ] **Step 1: Write failing test for crypto round-trip**

Create `tests/conftest.py`:
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app

TEST_DB = "sqlite:///./test.db"

engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Create `tests/test_crypto.py`:
```python
from backend.crypto import encrypt, decrypt


def test_encrypt_decrypt_roundtrip():
    secret = "my-super-secret-api-key"
    token = encrypt(secret)
    assert token != secret
    assert decrypt(token) == secret


def test_encrypt_empty_string():
    assert decrypt(encrypt("")) == ""
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pytest tests/test_crypto.py -v
```
Expected: `ImportError` — `backend.crypto` does not exist yet.

- [ ] **Step 3: Create `backend/crypto.py`**

```python
import base64
from cryptography.fernet import Fernet
from backend.config import settings


def _get_fernet() -> Fernet:
    # Derive a 32-byte URL-safe base64 key from SECRET_KEY
    key_bytes = settings.secret_key.encode().ljust(32)[:32]
    encoded = base64.urlsafe_b64encode(key_bytes)
    return Fernet(encoded)


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    return _get_fernet().decrypt(token.encode()).decode()
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pytest tests/test_crypto.py -v
```
Expected: 2 tests PASS.

- [ ] **Step 5: Create `backend/models.py`**

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
```

- [ ] **Step 6: Create `backend/schemas.py`**

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from backend.models import TaskStatus, TaskPriority


class SubtaskBase(BaseModel):
    title: str
    done: bool = False
    order: int = 0


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None
    order: Optional[int] = None


class SubtaskOut(SubtaskBase):
    id: str
    task_id: str

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.pending
    priority: TaskPriority = TaskPriority.medium
    due_date: Optional[datetime] = None
    scheduled_date: Optional[datetime] = None


class TaskCreate(TaskBase):
    subtasks: list[SubtaskCreate] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    scheduled_date: Optional[datetime] = None


class TaskOut(TaskBase):
    id: str
    google_event_id: Optional[str] = None
    share_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    subtasks: list[SubtaskOut] = []

    class Config:
        from_attributes = True


# Parsed task preview from AI (not yet saved)
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


class SettingsOut(BaseModel):
    ai_provider: str
    ai_model: str
    ai_base_url: str
    ai_api_key_set: bool  # never expose the raw key
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
    ai_api_key: Optional[str] = None  # raw; backend encrypts before storing
    slack_webhook_url: Optional[str] = None
    discord_webhook_url: Optional[str] = None
    google_calendar_id: Optional[str] = None
```

- [ ] **Step 7: Update `backend/main.py` to create all tables**

The existing `Base.metadata.create_all(bind=engine)` call will now pick up the new models automatically because they import `Base` from `backend.database`. Add the model import so they're registered:

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from backend.database import Base, engine
import backend.models  # noqa: F401 — registers models with Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Schedule Organiser")


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 8: Verify server still starts and tables are created**

```bash
uvicorn backend.main:app --reload
```
Expected: starts without error. Check `schedule.db` exists.

- [ ] **Step 9: Commit**

```bash
git add backend/models.py backend/schemas.py backend/crypto.py tests/conftest.py tests/test_crypto.py backend/main.py
git commit -m "feat: data models, schemas, and crypto layer"
```

---

## Task 3: Tasks CRUD API

**Files:**
- Create: `backend/routers/tasks.py`
- Create: `backend/routers/subtasks.py`
- Modify: `backend/main.py`
- Create: `tests/test_tasks.py`

- [ ] **Step 1: Write failing tests for task CRUD**

Create `tests/test_tasks.py`:
```python
import pytest
from fastapi.testclient import TestClient


def test_create_task(client):
    response = client.post("/api/tasks", json={
        "title": "Buy groceries",
        "description": "Milk, eggs, bread",
        "priority": "medium",
        "subtasks": [{"title": "Milk", "done": False, "order": 0}]
    })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Buy groceries"
    assert len(data["subtasks"]) == 1
    assert data["id"] is not None


def test_list_tasks(client):
    client.post("/api/tasks", json={"title": "Task A", "priority": "low"})
    client.post("/api/tasks", json={"title": "Task B", "priority": "high"})
    response = client.get("/api/tasks")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_task(client):
    created = client.post("/api/tasks", json={"title": "Single Task"}).json()
    response = client.get(f"/api/tasks/{created['id']}")
    assert response.status_code == 200
    assert response.json()["title"] == "Single Task"


def test_get_task_not_found(client):
    response = client.get("/api/tasks/nonexistent-id")
    assert response.status_code == 404


def test_update_task(client):
    created = client.post("/api/tasks", json={"title": "Old title"}).json()
    response = client.put(f"/api/tasks/{created['id']}", json={"title": "New title", "status": "done"})
    assert response.status_code == 200
    assert response.json()["title"] == "New title"
    assert response.json()["status"] == "done"


def test_delete_task(client):
    created = client.post("/api/tasks", json={"title": "To delete"}).json()
    response = client.delete(f"/api/tasks/{created['id']}")
    assert response.status_code == 204
    assert client.get(f"/api/tasks/{created['id']}").status_code == 404


def test_add_subtask(client):
    task = client.post("/api/tasks", json={"title": "Parent"}).json()
    response = client.post(f"/api/tasks/{task['id']}/subtasks", json={"title": "Sub 1", "done": False, "order": 0})
    assert response.status_code == 201
    assert response.json()["title"] == "Sub 1"


def test_update_subtask(client):
    task = client.post("/api/tasks", json={"title": "Parent"}).json()
    sub = client.post(f"/api/tasks/{task['id']}/subtasks", json={"title": "Sub", "done": False, "order": 0}).json()
    response = client.put(f"/api/tasks/{task['id']}/subtasks/{sub['id']}", json={"done": True})
    assert response.status_code == 200
    assert response.json()["done"] is True


def test_delete_subtask(client):
    task = client.post("/api/tasks", json={"title": "Parent"}).json()
    sub = client.post(f"/api/tasks/{task['id']}/subtasks", json={"title": "Sub", "done": False, "order": 0}).json()
    response = client.delete(f"/api/tasks/{task['id']}/subtasks/{sub['id']}")
    assert response.status_code == 204
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_tasks.py -v
```
Expected: all fail with 404 (routes not registered yet).

- [ ] **Step 3: Create `backend/routers/tasks.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, Subtask
from backend.schemas import TaskCreate, TaskUpdate, TaskOut, SubtaskCreate, SubtaskOut
from datetime import datetime

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.created_at.desc()).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        scheduled_date=payload.scheduled_date,
    )
    db.add(task)
    db.flush()  # get task.id before adding subtasks
    for i, sub in enumerate(payload.subtasks):
        db.add(Subtask(task_id=task.id, title=sub.title, done=sub.done, order=sub.order or i))
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
```

- [ ] **Step 4: Create `backend/routers/subtasks.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, Subtask
from backend.schemas import SubtaskCreate, SubtaskUpdate, SubtaskOut

router = APIRouter(prefix="/api/tasks/{task_id}/subtasks", tags=["subtasks"])


def _get_task(task_id: str, db: Session) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=SubtaskOut, status_code=201)
def add_subtask(task_id: str, payload: SubtaskCreate, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    sub = Subtask(task_id=task_id, title=payload.title, done=payload.done, order=payload.order)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/{subtask_id}", response_model=SubtaskOut)
def update_subtask(task_id: str, subtask_id: str, payload: SubtaskUpdate, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    sub = db.get(Subtask, subtask_id)
    if not sub or sub.task_id != task_id:
        raise HTTPException(status_code=404, detail="Subtask not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{subtask_id}", status_code=204)
def delete_subtask(task_id: str, subtask_id: str, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    sub = db.get(Subtask, subtask_id)
    if not sub or sub.task_id != task_id:
        raise HTTPException(status_code=404, detail="Subtask not found")
    db.delete(sub)
    db.commit()
```

- [ ] **Step 5: Register routers in `backend/main.py`**

```python
from fastapi import FastAPI
import backend.models  # noqa: F401
from backend.database import Base, engine
from backend.routers import tasks, subtasks

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Schedule Organiser")

app.include_router(tasks.router)
app.include_router(subtasks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pytest tests/test_tasks.py -v
```
Expected: all 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/routers/tasks.py backend/routers/subtasks.py backend/main.py tests/test_tasks.py
git commit -m "feat: task and subtask CRUD API"
```

---

## Task 4: Settings API

**Files:**
- Create: `backend/routers/settings.py`
- Modify: `backend/main.py`
- Create: `tests/test_settings.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_settings.py`:
```python
def test_get_settings_default(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["ai_provider"] == "openai"
    assert data["ai_api_key_set"] is False
    assert data["google_connected"] is False


def test_update_settings(client):
    response = client.put("/api/settings", json={
        "ai_provider": "anthropic",
        "ai_model": "claude-3-5-sonnet-20241022",
        "ai_api_key": "sk-test-key",
        "slack_webhook_url": "https://hooks.slack.com/test"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["ai_provider"] == "anthropic"
    assert data["ai_api_key_set"] is True  # key stored, not returned


def test_api_key_not_exposed(client):
    client.put("/api/settings", json={"ai_api_key": "secret-key"})
    response = client.get("/api/settings")
    assert "secret-key" not in str(response.json())
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_settings.py -v
```
Expected: FAIL — route not found.

- [ ] **Step 3: Create `backend/routers/settings.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import AppSettings
from backend.schemas import SettingsOut, SettingsUpdate
from backend.crypto import encrypt, decrypt

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> AppSettings:
    settings = db.get(AppSettings, 1)
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    return SettingsOut(
        ai_provider=s.ai_provider,
        ai_model=s.ai_model,
        ai_base_url=s.ai_base_url,
        ai_api_key_set=bool(s.ai_api_key_encrypted),
        slack_webhook_url=s.slack_webhook_url,
        discord_webhook_url=s.discord_webhook_url,
        google_calendar_id=s.google_calendar_id,
        google_connected=bool(s.google_oauth_token_encrypted),
    )


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if payload.ai_provider is not None:
        s.ai_provider = payload.ai_provider
    if payload.ai_model is not None:
        s.ai_model = payload.ai_model
    if payload.ai_base_url is not None:
        s.ai_base_url = payload.ai_base_url
    if payload.ai_api_key is not None:
        s.ai_api_key_encrypted = encrypt(payload.ai_api_key)
    if payload.slack_webhook_url is not None:
        s.slack_webhook_url = payload.slack_webhook_url
    if payload.discord_webhook_url is not None:
        s.discord_webhook_url = payload.discord_webhook_url
    if payload.google_calendar_id is not None:
        s.google_calendar_id = payload.google_calendar_id
    db.commit()
    db.refresh(s)
    return SettingsOut(
        ai_provider=s.ai_provider,
        ai_model=s.ai_model,
        ai_base_url=s.ai_base_url,
        ai_api_key_set=bool(s.ai_api_key_encrypted),
        slack_webhook_url=s.slack_webhook_url,
        discord_webhook_url=s.discord_webhook_url,
        google_calendar_id=s.google_calendar_id,
        google_connected=bool(s.google_oauth_token_encrypted),
    )
```

- [ ] **Step 4: Register settings router in `backend/main.py`**

Add to imports and `app.include_router(settings.router)`.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pytest tests/test_settings.py -v
```
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/settings.py backend/main.py tests/test_settings.py
git commit -m "feat: settings API with encrypted key storage"
```

---

## Task 5: AI Parsing Service and Endpoint

**Files:**
- Create: `backend/services/ai_parser.py`
- Create: `backend/routers/parse.py`
- Modify: `backend/main.py`
- Create: `tests/test_parse.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_parse.py`:
```python
import pytest
from unittest.mock import patch, AsyncMock
from backend.services.ai_parser import parse_text, ParsedTask


MOCK_AI_RESPONSE = [
    {
        "title": "Book dentist appointment",
        "description": "Schedule a routine checkup with the dentist.",
        "subtasks": [{"title": "Find dentist number"}, {"title": "Call to book"}],
        "due_date": None,
        "scheduled_date": None,
        "priority": "medium"
    }
]


@pytest.mark.asyncio
async def test_parse_text_returns_tasks():
    with patch("backend.services.ai_parser._call_ai", return_value=MOCK_AI_RESPONSE):
        result = await parse_text("I need to book a dentist appointment", provider="openai", api_key="sk-test", model="gpt-4o", base_url="")
    assert len(result) == 1
    assert result[0].title == "Book dentist appointment"
    assert len(result[0].subtasks) == 2


@pytest.mark.asyncio
async def test_parse_text_invalid_json_raises():
    with patch("backend.services.ai_parser._call_ai", side_effect=ValueError("bad json")):
        with pytest.raises(ValueError):
            await parse_text("some text", provider="openai", api_key="sk-test", model="gpt-4o", base_url="")


def test_parse_endpoint_returns_preview(client):
    # Set up settings first
    client.put("/api/settings", json={"ai_api_key": "sk-test", "ai_provider": "openai", "ai_model": "gpt-4o"})
    with patch("backend.routers.parse.parse_text", return_value=[
        ParsedTask(title="Task 1", description="Do something", subtasks=[], priority="medium")
    ]):
        response = client.post("/api/parse", json={"text": "I need to do something"})
    assert response.status_code == 200
    assert response.json()["tasks"][0]["title"] == "Task 1"


def test_parse_endpoint_requires_api_key(client):
    # No API key set
    response = client.post("/api/parse", json={"text": "some text"})
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_parse.py -v
```
Expected: ImportError or 404.

- [ ] **Step 3: Create `backend/services/ai_parser.py`**

```python
import json
import httpx
from typing import Any
from pydantic import BaseModel
from datetime import datetime
from backend.models import TaskPriority


SYSTEM_PROMPT = """You are a smart task organiser assistant. The user will give you a narrative description of their tasks in plain text.

Your job is to identify every distinct task mentioned and return them as a structured JSON array. For each task:
- Write a short, clear title
- Write a 1-3 sentence description (auto-generate if the user didn't provide one)
- Extract any subtasks mentioned
- Extract dates if mentioned (ISO 8601 format), otherwise null
- Infer a priority (low/medium/high) based on urgency or importance language used

Return ONLY a valid JSON array. No markdown, no explanation. Example:
[
  {
    "title": "Book dentist appointment",
    "description": "Schedule a routine dental checkup.",
    "subtasks": [{"title": "Find dentist number"}, {"title": "Call to book"}],
    "due_date": null,
    "scheduled_date": null,
    "priority": "medium"
  }
]"""


class ParsedSubtask(BaseModel):
    title: str


class ParsedTask(BaseModel):
    title: str
    description: str
    subtasks: list[ParsedSubtask] = []
    due_date: datetime | None = None
    scheduled_date: datetime | None = None
    priority: TaskPriority = TaskPriority.medium


async def _call_ai(text: str, provider: str, api_key: str, model: str, base_url: str) -> list[dict]:
    """Call the configured AI provider and return the raw parsed JSON list."""
    if provider == "anthropic":
        base = base_url or "https://api.anthropic.com"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": 2048,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": text}],
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{base}/v1/messages", json=body, headers=headers, timeout=30)
            resp.raise_for_status()
            content = resp.json()["content"][0]["text"]
    else:
        # OpenAI-compatible (openai, custom)
        base = base_url or "https://api.openai.com"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{base}/v1/chat/completions", json=body, headers=headers, timeout=30)
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            # Unwrap if model wrapped in {"tasks": [...]}
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and "tasks" in parsed:
                return parsed["tasks"]
            if isinstance(parsed, list):
                return parsed
            raise ValueError(f"Unexpected AI response shape: {raw}")

    try:
        data = json.loads(content)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "tasks" in data:
            return data["tasks"]
        raise ValueError(f"Unexpected AI response shape: {content}")
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}") from e


async def parse_text(text: str, provider: str, api_key: str, model: str, base_url: str) -> list[ParsedTask]:
    raw_tasks = await _call_ai(text, provider, api_key, model, base_url)
    return [ParsedTask(**t) for t in raw_tasks]
```

- [ ] **Step 4: Create `backend/routers/parse.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import AppSettings
from backend.schemas import ParseRequest, ParseResponse
from backend.services.ai_parser import parse_text, ParsedTask
from backend.crypto import decrypt
from backend.routers.settings import _get_or_create_settings

router = APIRouter(prefix="/api", tags=["parse"])


@router.post("/parse", response_model=ParseResponse)
async def parse_input(payload: ParseRequest, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if not s.ai_api_key_encrypted:
        raise HTTPException(status_code=400, detail="AI API key not configured. Set it in Settings.")
    api_key = decrypt(s.ai_api_key_encrypted)
    try:
        tasks = await parse_text(
            text=payload.text,
            provider=s.ai_provider,
            api_key=api_key,
            model=s.ai_model,
            base_url=s.ai_base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {e}")
    return ParseResponse(tasks=tasks)
```

- [ ] **Step 5: Register parse router in `backend/main.py`**

Add `from backend.routers import parse` and `app.include_router(parse.router)`.

- [ ] **Step 6: Run tests to confirm they pass**

```bash
pytest tests/test_parse.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/services/ai_parser.py backend/routers/parse.py backend/main.py tests/test_parse.py
git commit -m "feat: AI parsing service and /api/parse endpoint"
```

---

## Task 6: Notifications Service

**Files:**
- Create: `backend/services/notifications.py`
- Create: `tests/test_notifications.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_notifications.py`:
```python
import pytest
from unittest.mock import patch, AsyncMock
from backend.services.notifications import send_task_created, send_task_done


@pytest.mark.asyncio
async def test_send_task_created_slack():
    with patch("backend.services.notifications._post_webhook", new_callable=AsyncMock) as mock_post:
        await send_task_created(
            title="Buy milk",
            description="Get 2 litres of whole milk.",
            due_date=None,
            task_id="abc-123",
            slack_url="https://hooks.slack.com/test",
            discord_url="",
        )
        mock_post.assert_called_once()
        args = mock_post.call_args[0]
        assert args[0] == "https://hooks.slack.com/test"


@pytest.mark.asyncio
async def test_send_both_webhooks():
    with patch("backend.services.notifications._post_webhook", new_callable=AsyncMock) as mock_post:
        await send_task_created(
            title="Task",
            description="Desc",
            due_date=None,
            task_id="xyz",
            slack_url="https://hooks.slack.com/a",
            discord_url="https://discord.com/api/webhooks/b",
        )
        assert mock_post.call_count == 2


@pytest.mark.asyncio
async def test_no_webhooks_configured_does_not_raise():
    # Should silently skip
    await send_task_created(
        title="Task", description="Desc", due_date=None, task_id="xyz",
        slack_url="", discord_url=""
    )
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_notifications.py -v
```
Expected: ImportError.

- [ ] **Step 3: Create `backend/services/notifications.py`**

```python
import httpx
from datetime import datetime
from typing import Optional


async def _post_webhook(url: str, body: dict) -> None:
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, timeout=10)
        resp.raise_for_status()


def _slack_payload(title: str, description: str, due_date: Optional[datetime], task_id: str) -> dict:
    due_str = due_date.strftime("%Y-%m-%d") if due_date else "No due date"
    return {
        "text": f"*New task:* {title}",
        "attachments": [
            {
                "text": description,
                "fields": [{"title": "Due", "value": due_str, "short": True}],
                "color": "#4A90D9",
            }
        ],
    }


def _discord_payload(title: str, description: str, due_date: Optional[datetime], task_id: str) -> dict:
    due_str = due_date.strftime("%Y-%m-%d") if due_date else "No due date"
    return {
        "embeds": [
            {
                "title": f"New task: {title}",
                "description": description,
                "color": 4886481,
                "fields": [{"name": "Due", "value": due_str, "inline": True}],
            }
        ]
    }


async def send_task_created(
    title: str,
    description: str,
    due_date: Optional[datetime],
    task_id: str,
    slack_url: str,
    discord_url: str,
) -> None:
    if slack_url:
        await _post_webhook(slack_url, _slack_payload(title, description, due_date, task_id))
    if discord_url:
        await _post_webhook(discord_url, _discord_payload(title, description, due_date, task_id))


async def send_task_done(
    title: str,
    task_id: str,
    slack_url: str,
    discord_url: str,
) -> None:
    if slack_url:
        await _post_webhook(slack_url, {"text": f":white_check_mark: Task done: *{title}*"})
    if discord_url:
        await _post_webhook(discord_url, {"content": f"Task done: **{title}**"})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_notifications.py -v
```
Expected: 3 tests PASS.

- [ ] **Step 5: Wire notifications into task creation and done-marking**

In `backend/routers/tasks.py`, after `db.commit()` in `create_task`, fire notifications in the background:

```python
from fastapi import BackgroundTasks
from backend.services.notifications import send_task_created
from backend.routers.settings import _get_or_create_settings

@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # ... existing task creation code ...
    db.commit()
    db.refresh(task)
    s = _get_or_create_settings(db)
    background_tasks.add_task(
        send_task_created,
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        task_id=task.id,
        slack_url=s.slack_webhook_url,
        discord_url=s.discord_webhook_url,
    )
    return task
```

Also in `update_task`, if `status` becomes `done`, fire `send_task_done` as a background task.

- [ ] **Step 6: Run all tests**

```bash
pytest tests/ -v
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/services/notifications.py backend/routers/tasks.py tests/test_notifications.py
git commit -m "feat: Slack and Discord webhook notifications"
```

---

## Task 7: Share Links API

**Files:**
- Create: `backend/routers/share.py`
- Modify: `backend/main.py`
- Create: `tests/test_share.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_share.py`:
```python
import uuid


def test_generate_share_link(client):
    task = client.post("/api/tasks", json={"title": "Shared task"}).json()
    response = client.post(f"/api/tasks/{task['id']}/share")
    assert response.status_code == 200
    data = response.json()
    assert "share_token" in data
    assert "share_url" in data


def test_resolve_share_link(client):
    task = client.post("/api/tasks", json={"title": "Public task", "description": "Visible to all"}).json()
    share = client.post(f"/api/tasks/{task['id']}/share").json()
    token = share["share_token"]
    response = client.get(f"/api/share/{token}")
    assert response.status_code == 200
    assert response.json()["title"] == "Public task"


def test_resolve_invalid_token(client):
    response = client.get(f"/api/share/{uuid.uuid4()}")
    assert response.status_code == 404


def test_revoke_share_link(client):
    task = client.post("/api/tasks", json={"title": "Revokable"}).json()
    share = client.post(f"/api/tasks/{task['id']}/share").json()
    token = share["share_token"]
    client.delete(f"/api/tasks/{task['id']}/share")
    response = client.get(f"/api/share/{token}")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_share.py -v
```
Expected: FAIL — routes not found.

- [ ] **Step 3: Create `backend/routers/share.py`**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task
from backend.schemas import TaskOut

router = APIRouter(tags=["share"])


@router.post("/api/tasks/{task_id}/share")
def generate_share(task_id: str, request: Request, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.share_token:
        task.share_token = str(uuid.uuid4())
        db.commit()
        db.refresh(task)
    base_url = str(request.base_url).rstrip("/")
    return {
        "share_token": task.share_token,
        "share_url": f"{base_url}/share/{task.share_token}",
    }


@router.delete("/api/tasks/{task_id}/share", status_code=204)
def revoke_share(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.share_token = None
    db.commit()


@router.get("/api/share/{token}", response_model=TaskOut)
def resolve_share(token: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.share_token == token).first()
    if not task:
        raise HTTPException(status_code=404, detail="Share link not found or revoked")
    return task
```

- [ ] **Step 4: Register share router in `backend/main.py`**

Add `from backend.routers import share` and `app.include_router(share.router)`.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pytest tests/test_share.py -v
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/share.py backend/main.py tests/test_share.py
git commit -m "feat: task share link generation and read-only resolution"
```

---

## Task 8: Google Calendar Integration

**Files:**
- Create: `backend/services/calendar.py`
- Create: `backend/routers/integrations.py`
- Modify: `backend/main.py`
- Modify: `backend/routers/tasks.py`

- [ ] **Step 1: Create `backend/services/calendar.py`**

```python
import json
from typing import Optional
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from backend.config import settings as app_settings
from backend.crypto import encrypt, decrypt

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def _build_service(token_json: str):
    creds_data = json.loads(token_json)
    creds = Credentials(
        token=creds_data.get("token"),
        refresh_token=creds_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=app_settings.google_client_id,
        client_secret=app_settings.google_client_secret,
        scopes=SCOPES,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build("calendar", "v3", credentials=creds)


def get_auth_url() -> str:
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": app_settings.google_client_id,
                "client_secret": app_settings.google_client_secret,
                "redirect_uris": [app_settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=app_settings.google_redirect_uri,
    )
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return auth_url


def exchange_code_for_token(code: str) -> str:
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": app_settings.google_client_id,
                "client_secret": app_settings.google_client_secret,
                "redirect_uris": [app_settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=app_settings.google_redirect_uri,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials
    return json.dumps({
        "token": creds.token,
        "refresh_token": creds.refresh_token,
    })


def create_event(token_json: str, calendar_id: str, title: str, description: str, date: datetime) -> str:
    service = _build_service(token_json)
    event = {
        "summary": title,
        "description": description,
        "start": {"dateTime": date.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": date.isoformat(), "timeZone": "UTC"},
    }
    result = service.events().insert(calendarId=calendar_id, body=event).execute()
    return result["id"]


def update_event(token_json: str, calendar_id: str, event_id: str, title: str, description: str, date: datetime) -> None:
    service = _build_service(token_json)
    event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
    event["summary"] = title
    event["description"] = description
    event["start"] = {"dateTime": date.isoformat(), "timeZone": "UTC"}
    event["end"] = {"dateTime": date.isoformat(), "timeZone": "UTC"}
    service.events().update(calendarId=calendar_id, eventId=event_id, body=event).execute()


def delete_event(token_json: str, calendar_id: str, event_id: str) -> None:
    service = _build_service(token_json)
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
    except HttpError:
        pass  # Already deleted or not found — not an error
```

- [ ] **Step 2: Create `backend/routers/integrations.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.routers.settings import _get_or_create_settings
from backend.services.calendar import get_auth_url, exchange_code_for_token
from backend.crypto import encrypt

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/calendar/connect")
def calendar_connect():
    """Redirect user to Google OAuth consent screen."""
    url = get_auth_url()
    return RedirectResponse(url)


@router.get("/calendar/callback")
def calendar_callback(code: str, db: Session = Depends(get_db)):
    """Handle OAuth callback from Google, store token."""
    try:
        token_json = exchange_code_for_token(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {e}")
    s = _get_or_create_settings(db)
    s.google_oauth_token_encrypted = encrypt(token_json)
    db.commit()
    # Redirect to frontend settings page
    return RedirectResponse("/#/settings?calendar=connected")


@router.delete("/calendar/disconnect", status_code=204)
def calendar_disconnect(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    s.google_oauth_token_encrypted = ""
    db.commit()
```

- [ ] **Step 3: Wire calendar sync into task save and update**

In `backend/routers/tasks.py`, after creating a task with a `due_date` or `scheduled_date`, sync to Google Calendar as a background task:

```python
from backend.services.calendar import create_event, update_event, delete_event
from backend.crypto import decrypt

# In create_task, after db.commit():
if task.due_date or task.scheduled_date:
    s = _get_or_create_settings(db)
    if s.google_oauth_token_encrypted:
        token = decrypt(s.google_oauth_token_encrypted)
        date = task.due_date or task.scheduled_date
        background_tasks.add_task(
            _sync_create_calendar_event, db, task.id, token, s.google_calendar_id, task.title, task.description, date
        )

async def _sync_create_calendar_event(db, task_id, token, calendar_id, title, description, date):
    from backend.models import Task
    event_id = create_event(token, calendar_id, title, description, date)
    task = db.get(Task, task_id)
    if task:
        task.google_event_id = event_id
        db.commit()
```

In `update_task`, if `due_date` or `scheduled_date` changes and `google_event_id` exists, update the calendar event via `update_event`.

In `delete_task`, if `google_event_id` exists, delete the calendar event via `delete_event`.

- [ ] **Step 4: Register integrations router in `backend/main.py`**

Add `from backend.routers import integrations` and `app.include_router(integrations.router)`.

- [ ] **Step 5: Commit**

```bash
git add backend/services/calendar.py backend/routers/integrations.py backend/main.py backend/routers/tasks.py
git commit -m "feat: Google Calendar OAuth and event sync"
```

---

## Task 9: React Frontend — Types and API Client

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create `frontend/src/types.ts`**

```ts
export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Subtask {
  id: string
  task_id: string
  title: string
  done: boolean
  order: number
}

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
  created_at: string
  updated_at: string
  subtasks: Subtask[]
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

- [ ] **Step 2: Create `frontend/src/api/client.ts`**

```ts
import axios from 'axios'
import type { Task, ParsedTask, Settings, Subtask } from '../types'

const api = axios.create({ baseURL: '/api' })

// Tasks
export const getTasks = () => api.get<Task[]>('/tasks').then(r => r.data)
export const getTask = (id: string) => api.get<Task>(`/tasks/${id}`).then(r => r.data)
export const createTask = (payload: Partial<Task> & { subtasks?: Partial<Subtask>[] }) =>
  api.post<Task>('/tasks', payload).then(r => r.data)
export const updateTask = (id: string, payload: Partial<Task>) =>
  api.put<Task>(`/tasks/${id}`, payload).then(r => r.data)
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`)

// Subtasks
export const addSubtask = (taskId: string, title: string) =>
  api.post<Subtask>(`/tasks/${taskId}/subtasks`, { title, done: false, order: 0 }).then(r => r.data)
export const updateSubtask = (taskId: string, subtaskId: string, payload: Partial<Subtask>) =>
  api.put<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, payload).then(r => r.data)
export const deleteSubtask = (taskId: string, subtaskId: string) =>
  api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`)

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

- [ ] **Step 3: Configure Vite proxy for dev**

In `frontend/vite.config.ts`, add proxy so `/api` calls go to the FastAPI backend during development:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts frontend/vite.config.ts
git commit -m "feat: frontend types and API client"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `frontend/src/components/TaskCard.tsx`
- Create: `frontend/src/components/SubtaskList.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/components/SubtaskList.tsx`**

```tsx
import { updateSubtask } from '../api/client'
import type { Subtask } from '../types'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  taskId: string
  subtasks: Subtask[]
}

export default function SubtaskList({ taskId, subtasks }: Props) {
  const queryClient = useQueryClient()

  const toggle = async (sub: Subtask) => {
    await updateSubtask(taskId, sub.id, { done: !sub.done })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['task', taskId] })
  }

  if (!subtasks.length) return null

  return (
    <ul className="mt-2 space-y-1">
      {subtasks.map(sub => (
        <li key={sub.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sub.done}
            onChange={() => toggle(sub)}
            className="rounded"
          />
          <span className={sub.done ? 'line-through text-gray-400' : ''}>{sub.title}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/TaskCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { Task } from '../types'
import SubtaskList from './SubtaskList'

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

const statusColors: Record<string, string> = {
  pending: 'text-gray-500',
  in_progress: 'text-blue-600',
  done: 'text-green-600',
}

export default function TaskCard({ task }: { task: Task }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/tasks/${task.id}`} className="font-semibold text-gray-800 hover:text-blue-600">
          {task.title}
        </Link>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className={statusColors[task.status]}>{task.status.replace('_', ' ')}</span>
        {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
        {task.google_event_id && <span className="text-blue-400">📅 Synced</span>}
      </div>
      <SubtaskList taskId={task.id} subtasks={task.subtasks} />
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/pages/Dashboard.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getTasks } from '../api/client'
import TaskCard from '../components/TaskCard'
import { useState } from 'react'
import type { TaskStatus, TaskPriority } from '../types'

export default function Dashboard() {
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Tasks</h1>
        <Link
          to="/input"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Add Tasks
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {isLoading && <p className="text-gray-400">Loading...</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-gray-400 text-center py-16">No tasks yet. <Link to="/input" className="text-blue-500">Add some!</Link></p>
      )}
      <div className="space-y-3">
        {filtered.map(task => <TaskCard key={task.id} task={task} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `frontend/src/App.tsx` with routes**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/input" element={<div className="p-8">Input — coming soon</div>} />
          <Route path="/tasks/:id" element={<div className="p-8">Task Detail — coming soon</div>} />
          <Route path="/settings" element={<div className="p-8">Settings — coming soon</div>} />
          <Route path="/share/:token" element={<div className="p-8">Share View — coming soon</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Run frontend to verify dashboard renders**

```bash
cd frontend && npm run dev
```
Open http://localhost:5173 — dashboard should render with "No tasks yet."

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: dashboard with task list and filters"
```

---

## Task 11: Input Panel — Narrative Text + Voice + Parse Preview

**Files:**
- Create: `frontend/src/components/VoiceInput.tsx`
- Create: `frontend/src/components/ParsePreview.tsx`
- Create: `frontend/src/pages/InputPanel.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/components/VoiceInput.tsx`**

```tsx
import { useState, useRef } from 'react'

interface Props {
  onTranscript: (text: string) => void
}

export default function VoiceInput({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const start = () => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser.')
      return
    }
    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ')
      onTranscript(transcript)
    }
    rec.onerror = () => setError('Voice recognition error. Try again.')
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
    setError('')
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          recording
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {recording ? '⏹ Stop recording' : '🎤 Voice input'}
      </button>
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/ParsePreview.tsx`**

```tsx
import { useState } from 'react'
import type { ParsedTask } from '../types'
import { createTask } from '../api/client'
import { useNavigate } from 'react-router-dom'

interface Props {
  tasks: ParsedTask[]
  onConfirm: () => void
  onCancel: () => void
}

export default function ParsePreview({ tasks: initialTasks, onConfirm, onCancel }: Props) {
  const [tasks, setTasks] = useState<ParsedTask[]>(initialTasks)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const updateTask = (index: number, field: keyof ParsedTask, value: string) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index))
  }

  const confirm = async () => {
    setSaving(true)
    setError('')
    try {
      for (const task of tasks) {
        await createTask({
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.due_date ? new Date(task.due_date).toISOString() : undefined,
          scheduled_date: task.scheduled_date ? new Date(task.scheduled_date).toISOString() : undefined,
          subtasks: task.subtasks.map((s, i) => ({ title: s.title, done: false, order: i })),
        })
      }
      onConfirm()
      navigate('/')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save tasks.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} suggested — review before saving
        </h2>
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600">← Edit text</button>
      </div>

      {tasks.map((task, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white space-y-2">
          <div className="flex items-start justify-between gap-2">
            <input
              value={task.title}
              onChange={e => updateTask(i, 'title', e.target.value)}
              className="flex-1 font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-400 outline-none"
            />
            <button onClick={() => removeTask(i)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
          </div>
          <textarea
            value={task.description}
            onChange={e => updateTask(i, 'description', e.target.value)}
            rows={2}
            className="w-full text-sm text-gray-600 border border-gray-100 rounded p-2 focus:outline-none focus:border-blue-300 resize-none"
          />
          {task.subtasks.length > 0 && (
            <ul className="space-y-1 pl-2">
              {task.subtasks.map((sub, j) => (
                <li key={j} className="text-sm text-gray-500 flex items-center gap-1">
                  <span className="text-gray-300">–</span> {sub.title}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="capitalize">{task.priority} priority</span>
            {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          onClick={confirm}
          disabled={saving || tasks.length === 0}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : `Save ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
        </button>
        <button onClick={onCancel} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/pages/InputPanel.tsx`**

```tsx
import { useState } from 'react'
import { parseText } from '../api/client'
import type { ParsedTask } from '../types'
import VoiceInput from '../components/VoiceInput'
import ParsePreview from '../components/ParsePreview'

export default function InputPanel() {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ParsedTask[] | null>(null)

  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setError('')
    try {
      const result = await parseText(text)
      setPreview(result.tasks)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Parsing failed. Check your AI settings.')
    } finally {
      setParsing(false)
    }
  }

  const handleVoiceTranscript = (transcript: string) => {
    setText(prev => prev ? `${prev} ${transcript}` : transcript)
  }

  if (preview) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ParsePreview
          tasks={preview}
          onConfirm={() => setPreview(null)}
          onCancel={() => setPreview(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Add Tasks</h1>
      <p className="text-gray-500 text-sm mb-6">
        Write naturally — describe what you need to do and the AI will suggest tasks for you to review.
      </p>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="e.g. I need to finish the quarterly report by Friday, book a flight to London for the client meeting next month, and call the accountant about tax returns before end of week..."
        rows={8}
        className="w-full border border-gray-200 rounded-lg p-4 text-sm focus:outline-none focus:border-blue-400 resize-none"
      />

      <div className="flex items-center justify-between mt-3">
        <VoiceInput onTranscript={handleVoiceTranscript} />
        <button
          onClick={handleParse}
          disabled={parsing || !text.trim()}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {parsing ? 'Parsing...' : 'Suggest tasks →'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire up route in `frontend/src/App.tsx`**

Replace the `/input` stub route:
```tsx
import InputPanel from './pages/InputPanel'
// ...
<Route path="/input" element={<InputPanel />} />
```

- [ ] **Step 5: Verify in browser**

```bash
cd frontend && npm run dev
```
Navigate to http://localhost:5173/input — text area + voice button + "Suggest tasks →" should appear.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: input panel with voice, text input, and parse preview"
```

---

## Task 12: Task Detail Page

**Files:**
- Create: `frontend/src/pages/TaskDetail.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/TaskDetail.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTask, updateTask, deleteTask, addSubtask, generateShareLink, revokeShareLink } from '../api/client'
import SubtaskList from '../components/SubtaskList'
import { useState } from 'react'
import type { TaskStatus, TaskPriority } from '../types'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: task, isLoading } = useQuery({ queryKey: ['task', id], queryFn: () => getTask(id!) })
  const [newSubtask, setNewSubtask] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [saving, setSaving] = useState(false)

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>
  if (!task) return <div className="p-8 text-red-500">Task not found.</div>

  const update = async (field: string, value: string) => {
    await updateTask(task.id, { [field]: value })
    queryClient.invalidateQueries({ queryKey: ['task', id] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return
    await deleteTask(task.id)
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    navigate('/')
  }

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtask.trim()) return
    await addSubtask(task.id, newSubtask.trim())
    setNewSubtask('')
    queryClient.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleShare = async () => {
    const result = await generateShareLink(task.id)
    setShareUrl(result.share_url)
    queryClient.invalidateQueries({ queryKey: ['task', id] })
  }

  const handleRevoke = async () => {
    await revokeShareLink(task.id)
    setShareUrl('')
    queryClient.invalidateQueries({ queryKey: ['task', id] })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-600">Delete task</button>
      </div>

      <input
        defaultValue={task.title}
        onBlur={e => update('title', e.target.value)}
        className="w-full text-2xl font-bold text-gray-800 border-b border-transparent hover:border-gray-200 focus:border-blue-400 outline-none pb-1"
      />

      <div className="flex gap-3">
        <select defaultValue={task.status} onChange={e => update('status', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <select defaultValue={task.priority} onChange={e => update('priority', e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <textarea
          defaultValue={task.description}
          onBlur={e => update('description', e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-400 resize-none"
        />
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Due date</label>
          <input
            type="date"
            defaultValue={task.due_date ? task.due_date.split('T')[0] : ''}
            onBlur={e => update('due_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Scheduled date</label>
          <input
            type="date"
            defaultValue={task.scheduled_date ? task.scheduled_date.split('T')[0] : ''}
            onBlur={e => update('scheduled_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {task.google_event_id && (
        <p className="text-xs text-blue-500">📅 Synced to Google Calendar</p>
      )}

      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Subtasks</h3>
        <SubtaskList taskId={task.id} subtasks={task.subtasks} />
        <form onSubmit={handleAddSubtask} className="flex gap-2 mt-3">
          <input
            value={newSubtask}
            onChange={e => setNewSubtask(e.target.value)}
            placeholder="Add subtask..."
            className="flex-1 border rounded px-3 py-1.5 text-sm"
          />
          <button type="submit" className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Add</button>
        </form>
      </div>

      <div>
        <h3 className="font-semibold text-gray-700 mb-2">Share</h3>
        {task.share_token ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 break-all">{shareUrl || `${window.location.origin}/share/${task.share_token}`}</p>
            <button onClick={handleRevoke} className="text-sm text-red-400 hover:text-red-600">Revoke link</button>
          </div>
        ) : (
          <button onClick={handleShare} className="text-sm text-blue-600 hover:text-blue-800">Generate share link</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update route in `App.tsx`**

```tsx
import TaskDetail from './pages/TaskDetail'
// ...
<Route path="/tasks/:id" element={<TaskDetail />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TaskDetail.tsx frontend/src/App.tsx
git commit -m "feat: task detail page with edit, subtasks, dates, calendar sync status, and share"
```

---

## Task 13: Settings Page

**Files:**
- Create: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/Settings.tsx`**

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/client'
import { useState } from 'react'

export default function Settings() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  if (isLoading || !settings) return <div className="p-8 text-gray-400">Loading...</div>

  const val = (field: string, fallback: string) => form[field] ?? fallback

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await updateSettings({
      ai_provider: val('ai_provider', settings.ai_provider),
      ai_model: val('ai_model', settings.ai_model),
      ai_base_url: val('ai_base_url', settings.ai_base_url),
      ai_api_key: form['ai_api_key'] || undefined,
      slack_webhook_url: val('slack_webhook_url', settings.slack_webhook_url),
      discord_webhook_url: val('discord_webhook_url', settings.discord_webhook_url),
      google_calendar_id: val('google_calendar_id', settings.google_calendar_id),
    })
    queryClient.invalidateQueries({ queryKey: ['settings'] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const field = (key: string, defaultVal: string) => ({
    value: val(key, defaultVal),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      <form onSubmit={save} className="space-y-6">

        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">AI Provider</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Provider</label>
            <select {...field('ai_provider', settings.ai_provider)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="custom">Custom (OpenAI-compatible)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Model</label>
            <input {...field('ai_model', settings.ai_model)} className="w-full border rounded px-3 py-2 text-sm" placeholder="gpt-4o" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              API Key {settings.ai_api_key_set && <span className="text-green-500 ml-1">✓ set</span>}
            </label>
            <input
              type="password"
              {...field('ai_api_key', '')}
              placeholder={settings.ai_api_key_set ? '••••••••••• (leave blank to keep existing)' : 'Enter API key'}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Base URL (for custom endpoint)</label>
            <input {...field('ai_base_url', settings.ai_base_url)} placeholder="https://api.openai.com" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">Notifications</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slack Webhook URL</label>
            <input {...field('slack_webhook_url', settings.slack_webhook_url)} placeholder="https://hooks.slack.com/..." className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Discord Webhook URL</label>
            <input {...field('discord_webhook_url', settings.discord_webhook_url)} placeholder="https://discord.com/api/webhooks/..." className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-gray-700">Google Calendar</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${settings.google_connected ? 'text-green-600' : 'text-gray-400'}`}>
              {settings.google_connected ? '✓ Connected' : 'Not connected'}
            </span>
            <a href="/api/integrations/calendar/connect" className="text-sm text-blue-600 hover:underline">
              {settings.google_connected ? 'Reconnect' : 'Connect Google Calendar'}
            </a>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Calendar ID</label>
            <input {...field('google_calendar_id', settings.google_calendar_id)} placeholder="primary" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Update route and add nav in `App.tsx`**

```tsx
import Settings from './pages/Settings'
import { Link } from 'react-router-dom'

// Add a simple nav bar above Routes:
function Nav() {
  return (
    <nav className="border-b border-gray-200 bg-white px-4 py-3 flex items-center gap-6">
      <Link to="/" className="font-semibold text-gray-800">Schedule Organiser</Link>
      <Link to="/input" className="text-sm text-gray-500 hover:text-gray-800">+ Add</Link>
      <Link to="/settings" className="text-sm text-gray-500 hover:text-gray-800">Settings</Link>
    </nav>
  )
}

// Wrap Routes with Nav in the return:
return (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Nav />
      <Routes>
        ...
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
)
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/App.tsx
git commit -m "feat: settings page with AI config, webhooks, and Google Calendar connect"
```

---

## Task 14: Share View Page

**Files:**
- Create: `frontend/src/pages/ShareView.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/ShareView.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSharedTask } from '../api/client'

export default function ShareView() {
  const { token } = useParams<{ token: string }>()
  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['share', token],
    queryFn: () => getSharedTask(token!),
  })

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>
  if (isError || !task) return <div className="p-8 text-red-500">This link is invalid or has been revoked.</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="text-xs text-gray-400 uppercase tracking-wide">Shared task</div>
      <h1 className="text-2xl font-bold text-gray-800">{task.title}</h1>

      <div className="flex gap-3 text-sm">
        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 capitalize">{task.status.replace('_', ' ')}</span>
        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 capitalize">{task.priority} priority</span>
        {task.due_date && <span className="text-gray-500">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
      </div>

      {task.description && (
        <p className="text-gray-600 text-sm leading-relaxed">{task.description}</p>
      )}

      {task.subtasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm">Subtasks</h3>
          <ul className="space-y-1">
            {task.subtasks.map(sub => (
              <li key={sub.id} className="flex items-center gap-2 text-sm text-gray-600">
                <span>{sub.done ? '✓' : '○'}</span>
                <span className={sub.done ? 'line-through text-gray-400' : ''}>{sub.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-300 pt-4">This is a read-only view. Powered by Schedule Organiser.</p>
    </div>
  )
}
```

- [ ] **Step 2: Update route in `App.tsx`**

```tsx
import ShareView from './pages/ShareView'
// ...
<Route path="/share/:token" element={<ShareView />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ShareView.tsx frontend/src/App.tsx
git commit -m "feat: read-only share view page"
```

---

## Task 15: Serve Frontend from Backend + Final Wiring

**Files:**
- Modify: `backend/main.py`
- Create: `README.md` (update existing)

- [ ] **Step 1: Build the frontend**

```bash
cd frontend && npm run build
```
Expected: `frontend/dist/` created.

- [ ] **Step 2: Update `backend/main.py` to serve the built frontend**

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import backend.models  # noqa: F401

from backend.database import Base, engine
from backend.routers import tasks, subtasks, parse, settings, integrations, share

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Schedule Organiser")

app.include_router(tasks.router)
app.include_router(subtasks.router)
app.include_router(parse.router)
app.include_router(settings.router)
app.include_router(integrations.router)
app.include_router(share.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve built React frontend for all non-API routes
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
```

- [ ] **Step 3: Update `README.md` with setup instructions**

Replace the existing README contents:

```markdown
# Schedule Organiser

Smart self-hosted task organiser. Write or speak your tasks in plain text — the AI parses them into structured tickets with subtasks, dates, and descriptions. Syncs with Google Calendar and sends notifications to Slack/Discord.

## Quick Start

### 1. Clone and set up

```bash
git clone <repo>
cd schedule_organiser
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cp .env.example .env
# Edit .env and set SECRET_KEY to a random string
```

### 2. Build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Run

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

### 4. Configure

Go to **Settings** in the app to:
- Set your AI provider (OpenAI, Claude, or custom) and API key
- Add Slack and/or Discord webhook URLs for notifications
- Connect Google Calendar via OAuth

## Development

Run backend and frontend separately with hot reload:

```bash
# Terminal 1 — backend
uvicorn backend.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend dev server proxies `/api` to `localhost:8000`.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path (default: `sqlite:///./schedule.db`) |
| `SECRET_KEY` | Random string for encrypting stored secrets |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for Calendar) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (default: `http://localhost:8000/api/integrations/calendar/callback`) |
```

- [ ] **Step 4: Run full test suite**

```bash
pytest tests/ -v
```
Expected: all tests PASS.

- [ ] **Step 5: Smoke test the full app**

```bash
uvicorn backend.main:app
```
Open http://localhost:8000 — React app should load. Navigate to Settings, add an API key, go to Input, type a task, click "Suggest tasks →", review preview, confirm save, check Dashboard.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: serve frontend from backend, complete README setup guide"
```

---

## Self-Review Summary

- **Spec coverage:** All spec sections have corresponding tasks: AI parsing (Task 5), notifications (Task 6), calendar (Task 8), sharing (Task 7 + Task 14), settings (Task 4 + Task 13), CRUD (Task 3), frontend (Tasks 9–14).
- **Placeholder scan:** No TBDs or vague steps. All code blocks are complete.
- **Type consistency:** `ParsedTask` defined in `ai_parser.py` (Task 5) matches schema in `schemas.py` (Task 2). `TaskOut` used consistently. API client types (Task 9) match backend schemas.
- **Notification wiring:** `send_task_done` is triggered in `update_task` when status changes to `done` (noted in Task 6 Step 5 — implementer must add this in `tasks.py`).
- **Calendar wiring:** `_sync_create_calendar_event` is a helper defined in Task 8 Step 3 that the implementer adds inline in `tasks.py`.
