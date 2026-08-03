# Schedule Organiser — MCP Server Design Spec

**Date:** 2026-08-03
**Status:** Approved by user

---

## Overview

An MCP (Model Context Protocol) server that exposes the schedule organiser's task management capabilities to any MCP-compatible AI client — Claude Desktop, Cursor, OpenCode, and others. The server runs as a stdio subprocess, connects to the existing FastAPI backend over HTTP, and presents a set of tools the AI can call conversationally.

---

## Goals

- Allow AI assistants to create, read, update, and delete tasks via natural conversation
- Allow AI assistants to parse narrative text into tasks (using the backend's `/api/parse` endpoint)
- Zero extra infrastructure — runs as a subprocess via `uv run`, no daemon or ports
- Self-contained in `mcp/` with its own `pyproject.toml` managed by `uv`
- Easy to connect: one JSON snippet in the client's config file

---

## Non-Goals

- HTTP/SSE transport (stdio only for v1)
- Authentication or multi-user support (inherits from backend — none in v1)
- Exposing settings management or Google Calendar OAuth via MCP
- Notification triggering directly from MCP (notifications fire automatically when tasks are created/updated via the API)

---

## Architecture

```
AI Client (Claude Desktop / Cursor / OpenCode)
    │  stdio (MCP protocol over stdin/stdout)
    ▼
mcp/server.py          ← MCP server entry point (mcp[cli] library)
    │  HTTP (httpx)
    ▼
backend FastAPI        ← existing REST API at http://localhost:8000
    │
    ▼
SQLite schedule.db
```

The MCP server is a **thin adapter layer**:
- It knows the MCP protocol (via the `mcp` Python library)
- It knows the REST API shape (via `mcp/client.py`)
- It knows nothing about the database, models, or business logic

The FastAPI backend remains the single source of truth. All validation, encryption, notification dispatch, and calendar sync happen there as usual.

---

## Repository Structure

```
mcp/
├── pyproject.toml     # uv project: declares mcp[cli] and httpx as deps
├── server.py          # MCP server — registers all tools, handles requests
└── client.py          # HTTP client — wraps FastAPI REST endpoints with typed functions
```

Lives in the root of the monorepo alongside `backend/` and `frontend/`.

---

## Runtime: uv

The `mcp/` directory is a standalone `uv` project. `uv run` handles the virtual environment automatically — no pip install step needed.

```bash
# Run directly
uv run --project mcp python mcp/server.py

# Or from inside mcp/
cd mcp && uv run python server.py
```

`pyproject.toml` declares:
```toml
[project]
name = "schedule-organiser-mcp"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "mcp[cli]>=1.0.0",
    "httpx>=0.27.0",
]
```

---

## Tools

All tools are registered on the MCP server. The AI client can call any of them by name.

### `list_tasks`
List all tasks. Optionally filter by status or priority.

**Parameters:**
- `status` (optional): `pending` | `in_progress` | `done`
- `priority` (optional): `low` | `medium` | `high`

**Returns:** Array of task summaries (id, title, status, priority, due_date, subtask count).

---

### `get_task`
Get full details of a single task including all subtasks.

**Parameters:**
- `task_id` (required): UUID string

**Returns:** Full task object with subtasks array.

---

### `create_task`
Create a single task directly (without AI parsing).

**Parameters:**
- `title` (required): string
- `description` (optional): string — auto-filled with empty string if omitted
- `priority` (optional): `low` | `medium` | `high` — defaults to `medium`
- `due_date` (optional): ISO 8601 date string e.g. `2026-08-10`
- `scheduled_date` (optional): ISO 8601 date string
- `subtasks` (optional): array of strings (subtask titles)

**Returns:** Created task object with ID.

---

### `update_task`
Update any field on an existing task.

**Parameters:**
- `task_id` (required): UUID string
- `title` (optional): string
- `description` (optional): string
- `status` (optional): `pending` | `in_progress` | `done`
- `priority` (optional): `low` | `medium` | `high`
- `due_date` (optional): ISO 8601 date string or empty string to clear
- `scheduled_date` (optional): ISO 8601 date string or empty string to clear

**Returns:** Updated task object.

---

### `delete_task`
Permanently delete a task and all its subtasks.

**Parameters:**
- `task_id` (required): UUID string

**Returns:** Confirmation message.

---

### `parse_and_create`
Send narrative text to the backend AI parser, which extracts structured tasks, then immediately saves all of them. This is the primary "smart" tool — the AI client passes the user's free-form text and multiple tasks are created in one call.

**Parameters:**
- `text` (required): free-form narrative text describing tasks

**Returns:** Array of created task objects (with IDs).

**Notes:**
- Requires the backend to have an AI API key configured in Settings
- Returns a clear error if no API key is configured
- Tasks are saved directly (no preview step — the calling AI is the review layer)

---

### `add_subtask`
Add a subtask to an existing task.

**Parameters:**
- `task_id` (required): UUID string
- `title` (required): string

**Returns:** Created subtask object.

---

### `complete_subtask`
Mark a subtask as done (or undo it).

**Parameters:**
- `task_id` (required): UUID string
- `subtask_id` (required): UUID string
- `done` (optional): boolean — defaults to `true`

**Returns:** Updated subtask object.

---

## Configuration

The MCP server reads one environment variable:

| Variable | Default | Description |
|---|---|---|
| `SCHEDULE_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |

This is set in the AI client's MCP config — the user does not need to touch any file in the repo.

---

## Client Configuration Examples

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "schedule-organiser": {
      "command": "uv",
      "args": ["run", "--project", "/absolute/path/to/schedule_organiser/mcp", "python", "/absolute/path/to/schedule_organiser/mcp/server.py"],
      "env": {
        "SCHEDULE_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

### Cursor / OpenCode (`.cursor/mcp.json` or `opencode.json`)

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

---

## Error Handling

- If the backend is unreachable: tool returns a clear error string — `"Cannot connect to Schedule Organiser backend at http://localhost:8000. Is it running?"`
- If the backend returns a 4xx/5xx: tool surfaces the error detail from the JSON response
- If `parse_and_create` is called with no API key configured: returns `"AI API key not configured. Open the Schedule Organiser web UI and go to Settings to add your key."`
- All errors are returned as MCP tool result strings (not exceptions), so the AI client can relay them to the user gracefully

---

## Testing

- Unit tests for `client.py`: mock httpx, verify correct endpoints are called with correct payloads
- Integration smoke test: start the FastAPI test server, run the MCP server, call each tool, verify responses
- Test file: `mcp/tests/test_client.py`

---

## Out of Scope for v1

- HTTP/SSE transport
- MCP Resources (exposing tasks as readable resources, not just tool results)
- MCP Prompts (predefined prompt templates)
- Authentication between MCP server and backend
