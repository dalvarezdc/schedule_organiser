# Schedule Organiser — MCP Server

MCP server that connects Claude Desktop, Cursor, OpenCode, and other MCP-compatible AI clients to the Schedule Organiser.

## Status

⚠️ **The MCP server requires the backend REST API to be running and fully implemented.**

The MCP server is a thin client that talks to the Schedule Organiser FastAPI backend over HTTP. It does not access the database directly. Before the MCP tools will work end-to-end:

1. The backend must implement the task/subtask/parse endpoints (`/api/tasks`, `/api/parse`, `/api/tasks/{id}/subtasks`)
2. The backend must be running (`uvicorn backend.main:app`)
3. For `parse_and_create`, an AI API key must be configured in the web UI Settings page

If the backend is not running or an endpoint is missing, tools return a clear error message rather than crashing.

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

Replace `/ABSOLUTE/PATH/TO/schedule_organiser` with the actual path.

### Cursor

Edit `.cursor/mcp.json`:

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

Edit `opencode.json`:

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

## Usage

Once configured, restart your AI client so it picks up the MCP server. Make sure the backend is running (`uvicorn backend.main:app` from the repo root). Then talk to your AI assistant naturally — it will call the right tools automatically.

### Example conversations

**Capture tasks from a brain dump** (uses `parse_and_create`):
> "I need to finish the Q3 report by Friday, book a dentist appointment sometime next week, and call the accountant about tax returns. The report needs a data section and an executive summary."

The AI extracts multiple structured tasks with subtasks, due dates, and descriptions, and creates them all at once.

**See what's on your plate** (uses `list_tasks`):
> "What tasks do I have?"
> "Show me my high-priority tasks."
> "What's still pending?"

**Drill into a task** (uses `get_task`):
> "Tell me more about the Q3 report task."

**Create a single task** (uses `create_task`):
> "Add a task to renew my passport, high priority, due 2026-09-01."

**Update a task** (uses `update_task`):
> "Mark the dentist task as done."
> "Change the report deadline to next Monday."

**Manage subtasks** (uses `add_subtask`, `complete_subtask`):
> "Add a subtask to the report: 'proofread final draft'."
> "Check off the 'data section' subtask on the report."

**Delete a task** (uses `delete_task`):
> "Delete the passport renewal task."

### Notes

- Tasks with dates are automatically synced to Google Calendar (if connected in Settings)
- New tasks and completions trigger Slack/Discord notifications (if configured in Settings)
- `parse_and_create` saves tasks directly — the AI client is your review layer, so double-check what it created with "show me my tasks"

## Running Tests

```bash
cd mcp
uv run pytest tests/ -v
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SCHEDULE_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |
