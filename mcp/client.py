"""
HTTP client for the Schedule Organiser FastAPI backend.
All methods are synchronous (httpx sync client).
"""
import os
import httpx
from typing import Optional


class ScheduleClientError(Exception):
    """Raised when the backend returns an error or is unreachable."""


API_KEY_ERROR_SENTINEL = "AI API key not configured"


class ScheduleClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or os.environ.get("SCHEDULE_API_URL", "http://localhost:8000")).rstrip("/")

    def _request(self, method: str, path: str, json: Optional[dict] = None, params: Optional[dict] = None) -> httpx.Response:
        """Make an HTTP request to the backend, raising ScheduleClientError on failure."""
        try:
            r = httpx.request(method, f"{self.base_url}{path}", json=json, params=params, timeout=10)
        except httpx.TransportError as exc:
            raise ScheduleClientError(
                f"Cannot connect to Schedule Organiser backend at {self.base_url}. Is it running? ({exc})"
            ) from exc
        if not r.is_success:
            try:
                detail = r.json().get("detail", r.text)
            except Exception:
                detail = r.text or str(r.status_code)
            raise ScheduleClientError(str(detail))
        return r

    def _get(self, path: str, params: Optional[dict] = None) -> dict | list:
        return self._request("GET", path, params=params).json()

    def _post(self, path: str, json: dict) -> dict:
        return self._request("POST", path, json=json).json()

    def _put(self, path: str, json: dict) -> dict:
        return self._request("PUT", path, json=json).json()

    def _delete(self, path: str) -> None:
        try:
            r = httpx.request("DELETE", f"{self.base_url}{path}", timeout=10)
        except httpx.TransportError as exc:
            raise ScheduleClientError(
                f"Cannot connect to Schedule Organiser backend at {self.base_url}. Is it running? ({exc})"
            ) from exc
        if not r.is_success and r.status_code != 204:
            try:
                detail = r.json().get("detail", r.text)
            except Exception:
                detail = r.text or str(r.status_code)
            raise ScheduleClientError(str(detail))

    # --- Tasks ---

    def list_tasks(self, status: Optional[str] = None, priority: Optional[str] = None) -> list:
        # Pass filters as query params; backend may not support them yet, so also filter client-side
        params = {}
        if status:
            params["status"] = status
        if priority:
            params["priority"] = priority
        tasks = self._get("/api/tasks", params=params if params else None)
        # Client-side filter as fallback (backend may ignore unknown params)
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
        payload = {k: v for k, v in fields.items() if v is not None}
        return self._put(f"/api/tasks/{task_id}", payload)

    def delete_task(self, task_id: str) -> None:
        self._delete(f"/api/tasks/{task_id}")

    def parse_and_create(self, text: str) -> list[dict]:
        """
        Send narrative text to /api/parse, then create all returned tasks.
        If creation fails partway through, raises ScheduleClientError noting how
        many tasks were successfully created before the failure.
        """
        parsed = self._post("/api/parse", {"text": text})
        tasks = parsed.get("tasks")
        if tasks is None:
            raise ScheduleClientError(
                f"Unexpected response from /api/parse: missing 'tasks' key. Got keys: {list(parsed.keys())}"
            )
        created = []
        for t in tasks:
            try:
                task = self.create_task(
                    title=t["title"],
                    description=t.get("description", ""),
                    priority=t.get("priority", "medium"),
                    due_date=t.get("due_date"),
                    scheduled_date=t.get("scheduled_date"),
                    subtasks=[s["title"] for s in t.get("subtasks", [])],
                )
            except ScheduleClientError as exc:
                title = t.get("title", "<untitled>")
                raise ScheduleClientError(
                    f"Created {len(created)} of {len(tasks)} tasks, then failed "
                    f"creating '{title}': {exc}"
                ) from exc
            created.append(task)
        return created

    # --- Subtasks ---

    def add_subtask(self, task_id: str, title: str) -> dict:
        # Append after existing subtasks by computing the next order index.
        task = self.get_task(task_id)
        next_order = len(task.get("subtasks", []))
        return self._post(
            f"/api/tasks/{task_id}/subtasks",
            {"title": title, "done": False, "order": next_order},
        )

    def complete_subtask(self, task_id: str, subtask_id: str, done: bool = True) -> dict:
        return self._put(f"/api/tasks/{task_id}/subtasks/{subtask_id}", {"done": done})
