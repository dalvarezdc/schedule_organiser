# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server in `mcp/` that exposes 8 tools for managing tasks in the schedule organiser, running as a stdio subprocess via `uv run`, connecting to the FastAPI backend over HTTP.

**Architecture:** Three files — `pyproject.toml` (uv project config), `client.py` (typed HTTP client wrapping the REST API), `server.py` (MCP server registering all tools). The MCP server is a thin adapter: it speaks MCP protocol via the `mcp[cli]` library and delegates all business logic to the FastAPI backend via HTTP.

**Tech Stack:** Python 3.11+, `mcp[cli]>=1.0.0`, `httpx>=0.27.0`, `uv` runtime, pytest for tests.

---

## File Map

```
mcp/
├── pyproject.toml          # uv project: mcp[cli], httpx deps
├── client.py               # HTTP client — typed wrappers for all REST endpoints used
├── server.py               # MCP server — tool registration and handlers
└── tests/
    ├── __init__.py
    └── test_client.py      # Unit tests for client.py with mocked httpx
```

---

## Task 1: uv Project Setup

**Files:**
- Create: `mcp/pyproject.toml`
- Create: `mcp/__init__.py`
- Create: `mcp/tests/__init__.py`

- [ ] **Step 1: Create `mcp/` directory structure**

```bash
mkdir -p /Users/administrator/repositories/schedule_organiser/mcp/tests
touch /Users/administrator/repositories/schedule_organiser/mcp/__init__.py
touch /Users/administrator/repositories/schedule_organiser/mcp/tests/__init__.py
```

- [ ] **Step 2: Create `mcp/pyproject.toml`**

```toml
[project]
name = "schedule-organiser-mcp"
version = "0.1.0"
description = "MCP server for Schedule Organiser"
requires-python = ">=3.11"
dependencies = [
    "mcp[cli]>=1.0.0",
    "httpx>=0.27.0",
]

[project.scripts]
schedule-mcp = "mcp.server:main"

[tool.uv]
dev-dependencies = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "respx>=0.21.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- [ ] **Step 3: Run `uv sync` to create lockfile and verify deps resolve**

```bash
cd /Users/administrator/repositories/schedule_organiser/mcp
uv sync
```

Expected: `uv.lock` created, no errors. The `mcp` and `httpx` packages resolve successfully.

- [ ] **Step 4: Verify uv can find Python**

```bash
cd /Users/administrator/repositories/schedule_organiser/mcp
uv run python --version
```

Expected: `Python 3.11.x` or higher.

- [ ] **Step 5: Stage files**

```bash
cd /Users/administrator/repositories/schedule_organiser
git add mcp/
```

---

## Task 2: HTTP Client (`client.py`)

**Files:**
- Create: `mcp/client.py`
- Create: `mcp/tests/test_client.py`

- [ ] **Step 1: Write failing tests first**

Create `mcp/tests/test_client.py`:

```python
import pytest
import httpx
import respx
from mcp.client import ScheduleClient, ScheduleClientError

BASE = "http://localhost:8000"


@pytest.fixture
def client():
    return ScheduleClient(base_url=BASE)


@respx.mock
def test_list_tasks_no_filter(client):
    respx.get(f"{BASE}/api/tasks").mock(return_value=httpx.Response(200, json=[
        {"id": "abc", "title": "Task 1", "status": "pending", "priority": "medium",
         "due_date": None, "subtasks": [], "description": "", "scheduled_date": None,
         "google_event_id": None, "share_token": None, "created_at": "2026-08-03T00:00:00",
         "updated_at": "2026-08-03T00:00:00"}
    ]))
    tasks = client.list_tasks()
    assert len(tasks) == 1
    assert tasks[0]["title"] == "Task 1"


@respx.mock
def test_list_tasks_with_status_filter(client):
    respx.get(f"{BASE}/api/tasks").mock(return_value=httpx.Response(200, json=[]))
    tasks = client.list_tasks(status="done")
    assert tasks == []


@respx.mock
def test_get_task(client):
    respx.get(f"{BASE}/api/tasks/abc-123").mock(return_value=httpx.Response(200, json={
        "id": "abc-123", "title": "My Task", "status": "pending", "priority": "high",
        "description": "Details", "due_date": None, "scheduled_date": None,
        "subtasks": [{"id": "s1", "task_id": "abc-123", "title": "Sub", "done": False, "order": 0}],
        "google_event_id": None, "share_token": None,
        "created_at": "2026-08-03T00:00:00", "updated_at": "2026-08-03T00:00:00"
    }))
    task = client.get_task("abc-123")
    assert task["title"] == "My Task"
    assert len(task["subtasks"]) == 1


@respx.mock
def test_get_task_not_found_raises(client):
    respx.get(f"{BASE}/api/tasks/bad-id").mock(return_value=httpx.Response(404, json={"detail": "Task not found"}))
    with pytest.raises(ScheduleClientError, match="Task not found"):
        client.get_task("bad-id")


@respx.mock
def test_create_task(client):
    respx.post(f"{BASE}/api/tasks").mock(return_value=httpx.Response(201, json={
        "id": "new-id", "title": "New Task", "status": "pending", "priority": "medium",
        "description": "", "due_date": None, "scheduled_date": None, "subtasks": [],
        "google_event_id": None, "share_token": None,
        "created_at": "2026-08-03T00:00:00", "updated_at": "2026-08-03T00:00:00"
    }))
    task = client.create_task(title="New Task")
    assert task["id"] == "new-id"


@respx.mock
def test_update_task(client):
    respx.put(f"{BASE}/api/tasks/abc").mock(return_value=httpx.Response(200, json={
        "id": "abc", "title": "Updated", "status": "done", "priority": "high",
        "description": "", "due_date": None, "scheduled_date": None, "subtasks": [],
        "google_event_id": None, "share_token": None,
        "created_at": "2026-08-03T00:00:00", "updated_at": "2026-08-03T00:00:00"
    }))
    task = client.update_task("abc", status="done", title="Updated")
    assert task["status"] == "done"


@respx.mock
def test_delete_task(client):
    respx.delete(f"{BASE}/api/tasks/abc").mock(return_value=httpx.Response(204))
    client.delete_task("abc")  # Should not raise


@respx.mock
def test_parse_and_create(client):
    respx.post(f"{BASE}/api/parse").mock(return_value=httpx.Response(200, json={
        "tasks": [{"title": "Buy milk", "description": "Get milk", "subtasks": [],
                   "due_date": None, "scheduled_date": None, "priority": "low"}]
    }))
    respx.post(f"{BASE}/api/tasks").mock(return_value=httpx.Response(201, json={
        "id": "t1", "title": "Buy milk", "status": "pending", "priority": "low",
        "description": "Get milk", "due_date": None, "scheduled_date": None, "subtasks": [],
        "google_event_id": None, "share_token": None,
        "created_at": "2026-08-03T00:00:00", "updated_at": "2026-08-03T00:00:00"
    }))
    tasks = client.parse_and_create("I need to buy milk")
    assert len(tasks) == 1
    assert tasks[0]["title"] == "Buy milk"


@respx.mock
def test_add_subtask(client):
    respx.post(f"{BASE}/api/tasks/abc/subtasks").mock(return_value=httpx.Response(201, json={
        "id": "s1", "task_id": "abc", "title": "Sub", "done": False, "order": 0
    }))
    sub = client.add_subtask("abc", "Sub")
    assert sub["title"] == "Sub"


@respx.mock
def test_complete_subtask(client):
    respx.put(f"{BASE}/api/tasks/abc/subtasks/s1").mock(return_value=httpx.Response(200, json={
        "id": "s1", "task_id": "abc", "title": "Sub", "done": True, "order": 0
    }))
    sub = client.complete_subtask("abc", "s1", done=True)
    assert sub["done"] is True


@respx.mock
def test_backend_unreachable_raises(client):
    respx.get(f"{BASE}/api/tasks").mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(ScheduleClientError, match="Cannot connect"):
        client.list_tasks()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/administrator/repositories/schedule_organiser/mcp
uv run pytest tests/test_client.py -v
```

Expected: `ImportError` — `mcp.client` does not exist yet.

- [ ] **Step 3: Create `mcp/client.py`**

```python
"""
HTTP client for the Schedule Organiser FastAPI backend.
All methods are synchronous (httpx sync client) — the MCP server calls them directly.
"""
import os
import httpx
from typing import Optional


class ScheduleClientError(Exception):
    """Raised when the backend returns an error or is unreachable."""


class ScheduleClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or os.environ.get("SCHEDULE_API_URL", "http://localhost:8000")).rstrip("/")

    def _get(self, path: str, params: Optional[dict] = None) -> dict | list:
        try:
            r = httpx.get(f"{self.base_url}{path}", params=params, timeout=10)
        except httpx.ConnectError:
            raise ScheduleClientError(
                f"Cannot connect to Schedule Organiser backend at {self.base_url}. Is it running?"
            )
        if not r.is_success:
            detail = r.json().get("detail", r.text) if r.content else r.status_code
            raise ScheduleClientError(str(detail))
        return r.json()

    def _post(self, path: str, json: dict) -> dict:
        try:
            r = httpx.post(f"{self.base_url}{path}", json=json, timeout=10)
        except httpx.ConnectError:
            raise ScheduleClientError(
                f"Cannot connect to Schedule Organiser backend at {self.base_url}. Is it running?"
            )
        if not r.is_success:
            detail = r.json().get("detail", r.text) if r.content else r.status_code
            raise ScheduleClientError(str(detail))
        return r.json()

    def _put(self, path: str, json: dict) -> dict:
        try:
            r = httpx.put(f"{self.base_url}{path}", json=json, timeout=10)
        except httpx.ConnectError:
            raise ScheduleClientError(
                f"Cannot connect to Schedule Organiser backend at {self.base_url}. Is it running?"
            )
        if not r.is_success:
            detail = r.json().get("detail", r.text) if r.content else r.status_code
            raise ScheduleClientError(str(detail))
        return r.json()

    def _delete(self, path: str) -> None:
        try:
            r = httpx.delete(f"{self.base_url}{path}", timeout=10)
        except httpx.ConnectError:
            raise ScheduleClientError(
                f"Cannot connect to Schedule Organiser backend at {self.base_url}. Is it running?"
            )
        if not r.is_success and r.status_code != 204:
            detail = r.json().get("detail", r.text) if r.content else r.status_code
            raise ScheduleClientError(str(detail))

    # --- Tasks ---

    def list_tasks(self, status: Optional[str] = None, priority: Optional[str] = None) -> list:
        tasks = self._get("/api/tasks")
        if status:
            tasks = [t for t in tasks if t["status"] == status]
        if priority:
            tasks = [t for t in tasks if t["priority"] == priority]
        return tasks

    def get_task(self, task_id: str) -> dict:
        return self._get(f"/api/tasks/{task_id}")

    def create_task(
        self,
        title: str,
        description: str = "",
        priority: str = "medium",
        due_date: Optional[str] = None,
        scheduled_date: Optional[str] = None,
        subtasks: Optional[list[str]] = None,
    ) -> dict:
        payload: dict = {
            "title": title,
            "description": description,
            "priority": priority,
            "subtasks": [{"title": s, "done": False, "order": i} for i, s in enumerate(subtasks or [])],
        }
        if due_date:
            payload["due_date"] = due_date
        if scheduled_date:
            payload["scheduled_date"] = scheduled_date
        return self._post("/api/tasks", payload)

    def update_task(self, task_id: str, **fields) -> dict:
        # Remove None values — only send fields the caller actually set
        payload = {k: v for k, v in fields.items() if v is not None}
        return self._put(f"/api/tasks/{task_id}", payload)

    def delete_task(self, task_id: str) -> None:
        self._delete(f"/api/tasks/{task_id}")

    def parse_and_create(self, text: str) -> list[dict]:
        """Send narrative text to /api/parse, then create all returned tasks."""
        parsed = self._post("/api/parse", {"text": text})
        created = []
        for t in parsed["tasks"]:
            task = self.create_task(
                title=t["title"],
                description=t.get("description", ""),
                priority=t.get("priority", "medium"),
                due_date=t.get("due_date"),
                scheduled_date=t.get("scheduled_date"),
                subtasks=[s["title"] for s in t.get("subtasks", [])],
            )
            created.append(task)
        return created

    # --- Subtasks ---

    def add_subtask(self, task_id: str, title: str) -> dict:
        return self._post(f"/api/tasks/{task_id}/subtasks", {"title": title, "done": False, "order": 0})

    def complete_subtask(self, task_id: str, subtask_id: str, done: bool = True) -> dict:
        return self._put(f"/api/tasks/{task_id}/subtasks/{subtask_id}", {"done": done})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/administrator/repositories/schedule_organiser/mcp
uv run pytest tests/test_client.py -v
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Stage**

```bash
cd /Users/administrator/repositories/schedule_organiser
git add mcp/client.py mcp/tests/test_client.py
```

---

## Task 3: MCP Server (`server.py`)

**Files:**
- Create: `mcp/server.py`

- [ ] **Step 1: Create `mcp/server.py`**

```python
"""
MCP server for Schedule Organiser.
Exposes task management as MCP tools, communicating with the FastAPI backend via HTTP.

Run with:
    uv run --project mcp python mcp/server.py
"""
import json
from typing import Optional
from mcp.server.fastmcp import FastMCP
from client import ScheduleClient, ScheduleClientError

mcp = FastMCP("Schedule Organiser")
_client = ScheduleClient()


def _fmt_task(task: dict) -> str:
    """Format a task dict as a readable summary string."""
    subtask_count = len(task.get("subtasks", []))
    lines = [
        f"ID: {task['id']}",
        f"Title: {task['title']}",
        f"Status: {task['status']}",
        f"Priority: {task['priority']}",
    ]
    if task.get("description"):
        lines.append(f"Description: {task['description']}")
    if task.get("due_date"):
        lines.append(f"Due: {task['due_date']}")
    if task.get("scheduled_date"):
        lines.append(f"Scheduled: {task['scheduled_date']}")
    if subtask_count:
        lines.append(f"Subtasks: {subtask_count}")
        for s in task.get("subtasks", []):
            check = "✓" if s["done"] else "○"
            lines.append(f"  {check} {s['title']} (id: {s['id']})")
    if task.get("google_event_id"):
        lines.append("📅 Synced to Google Calendar")
    return "\n".join(lines)


@mcp.tool()
def list_tasks(status: Optional[str] = None, priority: Optional[str] = None) -> str:
    """
    List all tasks. Optionally filter by status (pending/in_progress/done)
    or priority (low/medium/high).
    """
    try:
        tasks = _client.list_tasks(status=status, priority=priority)
    except ScheduleClientError as e:
        return f"Error: {e}"

    if not tasks:
        filters = []
        if status:
            filters.append(f"status={status}")
        if priority:
            filters.append(f"priority={priority}")
        qualifier = f" with {', '.join(filters)}" if filters else ""
        return f"No tasks found{qualifier}."

    parts = []
    for t in tasks:
        subtask_count = len(t.get("subtasks", []))
        due = f" | Due: {t['due_date']}" if t.get("due_date") else ""
        subs = f" | {subtask_count} subtask{'s' if subtask_count != 1 else ''}" if subtask_count else ""
        parts.append(f"[{t['priority'].upper()}] {t['title']} ({t['status']}){due}{subs} — id: {t['id']}")

    return f"Found {len(tasks)} task{'s' if len(tasks) != 1 else ''}:\n" + "\n".join(parts)


@mcp.tool()
def get_task(task_id: str) -> str:
    """Get full details of a task including all subtasks."""
    try:
        task = _client.get_task(task_id)
    except ScheduleClientError as e:
        return f"Error: {e}"
    return _fmt_task(task)


@mcp.tool()
def create_task(
    title: str,
    description: str = "",
    priority: str = "medium",
    due_date: Optional[str] = None,
    scheduled_date: Optional[str] = None,
    subtasks: Optional[list[str]] = None,
) -> str:
    """
    Create a new task directly.
    - title: required
    - priority: low / medium / high (default: medium)
    - due_date: ISO 8601 e.g. 2026-08-10 (optional)
    - scheduled_date: ISO 8601 (optional)
    - subtasks: list of subtask title strings (optional)
    """
    try:
        task = _client.create_task(
            title=title,
            description=description,
            priority=priority,
            due_date=due_date,
            scheduled_date=scheduled_date,
            subtasks=subtasks or [],
        )
    except ScheduleClientError as e:
        return f"Error: {e}"
    return f"Task created successfully.\n\n{_fmt_task(task)}"


@mcp.tool()
def update_task(
    task_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    due_date: Optional[str] = None,
    scheduled_date: Optional[str] = None,
) -> str:
    """
    Update any fields on an existing task.
    Only provide the fields you want to change.
    - status: pending / in_progress / done
    - priority: low / medium / high
    - due_date / scheduled_date: ISO 8601 date string, or empty string to clear
    """
    fields = {}
    if title is not None:
        fields["title"] = title
    if description is not None:
        fields["description"] = description
    if status is not None:
        fields["status"] = status
    if priority is not None:
        fields["priority"] = priority
    if due_date is not None:
        fields["due_date"] = due_date or None
    if scheduled_date is not None:
        fields["scheduled_date"] = scheduled_date or None

    if not fields:
        return "No fields provided to update."

    try:
        task = _client.update_task(task_id, **fields)
    except ScheduleClientError as e:
        return f"Error: {e}"
    return f"Task updated.\n\n{_fmt_task(task)}"


@mcp.tool()
def delete_task(task_id: str) -> str:
    """Permanently delete a task and all its subtasks."""
    try:
        _client.delete_task(task_id)
    except ScheduleClientError as e:
        return f"Error: {e}"
    return f"Task {task_id} deleted successfully."


@mcp.tool()
def parse_and_create(text: str) -> str:
    """
    Send narrative text to the AI parser and create all extracted tasks immediately.
    Example: "I need to finish the report by Friday and book a dentist appointment"
    This will create multiple tasks with subtasks, descriptions, and dates extracted.
    Requires an AI API key to be configured in the Schedule Organiser settings.
    """
    try:
        tasks = _client.parse_and_create(text)
    except ScheduleClientError as e:
        if "API key not configured" in str(e):
            return (
                "AI API key not configured. "
                "Open the Schedule Organiser web UI and go to Settings to add your key."
            )
        return f"Error: {e}"

    if not tasks:
        return "No tasks were extracted from the text."

    parts = [f"Created {len(tasks)} task{'s' if len(tasks) != 1 else ''} from your text:\n"]
    for task in tasks:
        parts.append(_fmt_task(task))
        parts.append("")
    return "\n".join(parts)


@mcp.tool()
def add_subtask(task_id: str, title: str) -> str:
    """Add a subtask to an existing task."""
    try:
        sub = _client.add_subtask(task_id, title)
    except ScheduleClientError as e:
        return f"Error: {e}"
    return f"Subtask added: '{sub['title']}' (id: {sub['id']})"


@mcp.tool()
def complete_subtask(task_id: str, subtask_id: str, done: bool = True) -> str:
    """
    Mark a subtask as done (or undo it by passing done=false).
    """
    try:
        sub = _client.complete_subtask(task_id, subtask_id, done=done)
    except ScheduleClientError as e:
        return f"Error: {e}"
    state = "completed" if sub["done"] else "marked incomplete"
    return f"Subtask '{sub['title']}' {state}."


def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify the server starts without error (dry run)**

```bash
cd /Users/administrator/repositories/schedule_organiser
uv run --project mcp python mcp/server.py --help 2>&1 | head -5 || true
```

The server starts and waits for stdio input — kill it with Ctrl-C or check that it at least imports without crashing:

```bash
cd /Users/administrator/repositories/schedule_organiser
uv run --project mcp python -c "from mcp.server import server; print('import ok')" 2>&1 || \
uv run --project mcp python -c "import sys; sys.path.insert(0, 'mcp'); from client import ScheduleClient; print('client import ok')"
```

Expected: `client import ok` (or equivalent — no ImportError).

- [ ] **Step 3: Stage**

```bash
cd /Users/administrator/repositories/schedule_organiser
git add mcp/server.py
```

---

## Task 4: Client Config Snippet + README Update

**Files:**
- Create: `mcp/README.md`
- Modify: root `README.md`

- [ ] **Step 1: Create `mcp/README.md`**

```markdown
# Schedule Organiser — MCP Server

MCP server that connects Claude Desktop, Cursor, OpenCode, and other MCP-compatible AI clients to the Schedule Organiser.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Schedule Organiser backend running (`uvicorn backend.main:app` from the repo root)

## Tools Available

| Tool | Description |
|---|---|
| `list_tasks` | List all tasks, optionally filtered by status or priority |
| `get_task` | Get full task details including subtasks |
| `create_task` | Create a task with title, description, dates, subtasks |
| `update_task` | Update any field on a task |
| `delete_task` | Delete a task permanently |
| `parse_and_create` | Send narrative text → AI extracts and creates tasks |
| `add_subtask` | Add a subtask to a task |
| `complete_subtask` | Mark a subtask done (or undo) |

## Configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "schedule-organiser": {
      "command": "uv",
      "args": [
        "run",
        "--project",
        "/ABSOLUTE/PATH/TO/schedule_organiser/mcp",
        "python",
        "/ABSOLUTE/PATH/TO/schedule_organiser/mcp/server.py"
      ],
      "env": {
        "SCHEDULE_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/schedule_organiser` with the actual path to this repo.

### Cursor

Edit `.cursor/mcp.json` in your project root (or global Cursor settings):

```json
{
  "mcpServers": {
    "schedule-organiser": {
      "command": "uv",
      "args": ["run", "--project", "mcp", "python", "mcp/server.py"],
      "env": {
        "SCHEDULE_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### OpenCode

Edit `opencode.json` or `.opencode/config.json`:

```json
{
  "mcp": {
    "schedule-organiser": {
      "command": "uv",
      "args": ["run", "--project", "mcp", "python", "mcp/server.py"],
      "env": {
        "SCHEDULE_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

## Running Tests

```bash
cd mcp
uv run pytest tests/ -v
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SCHEDULE_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |
```

- [ ] **Step 2: Add MCP section to root README.md**

Open `/Users/administrator/repositories/schedule_organiser/README.md` and append the following section before the final newline:

```markdown

---

## MCP Server (AI Assistant Integration)

Connect Claude Desktop, Cursor, OpenCode, or any MCP-compatible client to this app.

See [`mcp/README.md`](mcp/README.md) for full setup instructions.

**Quick start:**
1. Install [uv](https://docs.astral.sh/uv/) if you haven't already
2. Start the backend: `uvicorn backend.main:app`
3. Add the MCP server config to your AI client (see `mcp/README.md`)
4. Ask your AI: *"Show me my tasks"* or *"I need to book a dentist and finish the Q3 report by Friday"*
```

- [ ] **Step 3: Stage**

```bash
cd /Users/administrator/repositories/schedule_organiser
git add mcp/README.md README.md
```

---

## Task 5: Run All Tests and Verify

- [ ] **Step 1: Run MCP tests**

```bash
cd /Users/administrator/repositories/schedule_organiser/mcp
uv run pytest tests/ -v
```

Expected: all 11 tests in `test_client.py` PASS.

- [ ] **Step 2: Verify server.py imports cleanly**

```bash
cd /Users/administrator/repositories/schedule_organiser
uv run --project mcp python -c "
import sys
sys.path.insert(0, 'mcp')
from client import ScheduleClient, ScheduleClientError
from server import mcp
tools = [t.name for t in mcp._tool_manager.list_tools()]
print('Tools registered:', tools)
assert 'list_tasks' in tools
assert 'parse_and_create' in tools
assert len(tools) == 8
print('All 8 tools registered correctly.')
"
```

Expected output:
```
Tools registered: ['list_tasks', 'get_task', 'create_task', 'update_task', 'delete_task', 'parse_and_create', 'add_subtask', 'complete_subtask']
All 8 tools registered correctly.
```

- [ ] **Step 3: Final git status check**

```bash
cd /Users/administrator/repositories/schedule_organiser
git status
```

Expected: `mcp/` directory fully staged, no untracked surprises.

- [ ] **Step 4: Report back with test results and git status output**

---

## Self-Review Checklist

- **Spec coverage:** All 8 tools from spec implemented (list_tasks, get_task, create_task, update_task, delete_task, parse_and_create, add_subtask, complete_subtask) ✓
- **uv runtime:** pyproject.toml uses `mcp[cli]` and `httpx`, `uv run` is the entry point ✓
- **REST-only:** client.py has no direct DB access, only HTTP ✓
- **Error handling:** all tool handlers catch `ScheduleClientError` and return user-friendly strings ✓
- **Type consistency:** `ScheduleClient` method signatures match test expectations ✓
- **No placeholders:** all code blocks are complete ✓
