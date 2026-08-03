"""
MCP server for Schedule Organiser.
Run with: uv run --project mcp python mcp/server.py
"""
import sys
import os
from typing import Optional

# Add this file's directory to sys.path so `from client import ...` works
# regardless of the working directory the server is launched from.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from mcp.server.fastmcp import FastMCP
from client import ScheduleClient, ScheduleClientError, API_KEY_ERROR_SENTINEL

mcp = FastMCP("Schedule Organiser")
_client = ScheduleClient()


def _fmt_task(task: dict) -> str:
    """Format a task dict as a readable summary string."""
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
    subtasks = task.get("subtasks", [])
    if subtasks:
        lines.append(f"Subtasks ({len(subtasks)}):")
        for s in subtasks:
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
    Update any fields on an existing task. Only provide fields you want to change.
    - status: pending / in_progress / done
    - priority: low / medium / high
    - due_date / scheduled_date: ISO 8601, or empty string to clear
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
    This creates multiple tasks with subtasks, descriptions, and dates extracted automatically.
    Requires an AI API key configured in Schedule Organiser Settings.
    """
    try:
        tasks = _client.parse_and_create(text)
    except ScheduleClientError as e:
        if API_KEY_ERROR_SENTINEL in str(e):
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
    """
    Add a new subtask to an existing task.
    Use get_task first to confirm the task exists and get its task_id.
    - task_id: the ID of the parent task
    - title: text of the new subtask item
    """
    try:
        sub = _client.add_subtask(task_id, title)
    except ScheduleClientError as e:
        return f"Error: {e}"
    return f"Subtask added: '{sub['title']}' (id: {sub['id']})"


@mcp.tool()
def complete_subtask(task_id: str, subtask_id: str, done: bool = True) -> str:
    """
    Mark a subtask as done or not-done.
    Use get_task to find both the task_id and the subtask_id from the subtasks list.
    - task_id: the ID of the parent task
    - subtask_id: the ID of the subtask (visible in get_task output)
    - done: true to mark complete, false to revert to incomplete
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
