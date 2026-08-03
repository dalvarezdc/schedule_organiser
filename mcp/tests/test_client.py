import pytest
import httpx
import respx
from client import ScheduleClient, ScheduleClientError

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
    # add_subtask first GETs the task to compute the next order index
    respx.get(f"{BASE}/api/tasks/abc").mock(return_value=httpx.Response(200, json={
        "id": "abc", "title": "Parent", "status": "pending", "priority": "medium",
        "description": "", "due_date": None, "scheduled_date": None,
        "subtasks": [{"id": "s0", "task_id": "abc", "title": "Existing", "done": False, "order": 0}],
        "google_event_id": None, "share_token": None,
        "created_at": "2026-08-03T00:00:00", "updated_at": "2026-08-03T00:00:00"
    }))
    route = respx.post(f"{BASE}/api/tasks/abc/subtasks").mock(return_value=httpx.Response(201, json={
        "id": "s1", "task_id": "abc", "title": "Sub", "done": False, "order": 1
    }))
    sub = client.add_subtask("abc", "Sub")
    assert sub["title"] == "Sub"
    # Verify the computed order (1, since one subtask already exists) was sent
    import json as _json
    sent_body = _json.loads(route.calls.last.request.content)
    assert sent_body["order"] == 1


@respx.mock
def test_get_task_non_json_error_body(client):
    """A non-JSON error body (e.g. HTML from a proxy) is handled gracefully."""
    respx.get(f"{BASE}/api/tasks/x").mock(
        return_value=httpx.Response(502, text="<html>Bad Gateway</html>")
    )
    with pytest.raises(ScheduleClientError, match="Bad Gateway"):
        client.get_task("x")


@respx.mock
def test_parse_and_create_missing_tasks_key(client):
    """If /api/parse returns a body without a 'tasks' key, raise a clear error."""
    respx.post(f"{BASE}/api/parse").mock(return_value=httpx.Response(200, json={"unexpected": []}))
    with pytest.raises(ScheduleClientError, match="missing 'tasks' key"):
        client.parse_and_create("some text")


@respx.mock
def test_parse_and_create_partial_failure(client):
    """If task creation fails midway, error reports how many were created."""
    respx.post(f"{BASE}/api/parse").mock(return_value=httpx.Response(200, json={
        "tasks": [
            {"title": "First", "description": "", "subtasks": [], "due_date": None,
             "scheduled_date": None, "priority": "low"},
            {"title": "Second", "description": "", "subtasks": [], "due_date": None,
             "scheduled_date": None, "priority": "low"},
        ]
    }))
    # First create succeeds, second returns 500
    responses = [
        httpx.Response(201, json={
            "id": "t1", "title": "First", "status": "pending", "priority": "low",
            "description": "", "due_date": None, "scheduled_date": None, "subtasks": [],
            "google_event_id": None, "share_token": None,
            "created_at": "2026-08-03T00:00:00", "updated_at": "2026-08-03T00:00:00"
        }),
        httpx.Response(500, json={"detail": "server blew up"}),
    ]
    respx.post(f"{BASE}/api/tasks").mock(side_effect=responses)
    with pytest.raises(ScheduleClientError, match="Created 1 of 2 tasks"):
        client.parse_and_create("make two tasks")


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


@respx.mock
def test_parse_and_create_empty_tasks(client):
    """parse_and_create returns empty list when backend returns no tasks."""
    respx.post(f"{BASE}/api/parse").mock(return_value=httpx.Response(200, json={"tasks": []}))
    tasks = client.parse_and_create("nothing useful")
    assert tasks == []


@respx.mock
def test_backend_transport_error_raises(client):
    """Non-connection transport errors (e.g. timeout) also raise ScheduleClientError."""
    respx.get(f"{BASE}/api/tasks").mock(side_effect=httpx.ReadTimeout("timed out"))
    with pytest.raises(ScheduleClientError, match="Cannot connect"):
        client.list_tasks()
