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
    # Subtasks are now child Tasks, returned in the `children` array
    assert len(data["children"]) == 1
    assert data["children"][0]["title"] == "Milk"
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


def test_add_child_task(client):
    """A child task can be created by passing parent_id."""
    parent = client.post("/api/tasks", json={"title": "Parent"}).json()
    response = client.post("/api/tasks", json={
        "title": "Child task",
        "parent_id": parent["id"],
    })
    assert response.status_code == 201
    child = response.json()
    assert child["title"] == "Child task"
    assert child["parent_id"] == parent["id"]

    # Parent should now have this child in its children list
    parent_data = client.get(f"/api/tasks/{parent['id']}").json()
    assert len(parent_data["children"]) == 1
    assert parent_data["children"][0]["id"] == child["id"]


def test_update_child_task_done(client):
    """A child task's status can be toggled to done."""
    parent = client.post("/api/tasks", json={"title": "Parent"}).json()
    child = client.post("/api/tasks", json={
        "title": "Child",
        "parent_id": parent["id"],
    }).json()
    response = client.put(f"/api/tasks/{child['id']}", json={"status": "done"})
    assert response.status_code == 200
    assert response.json()["status"] == "done"


def test_delete_child_task(client):
    """Deleting a child task removes it; parent survives."""
    parent = client.post("/api/tasks", json={"title": "Parent"}).json()
    child = client.post("/api/tasks", json={
        "title": "Child to delete",
        "parent_id": parent["id"],
    }).json()
    response = client.delete(f"/api/tasks/{child['id']}")
    assert response.status_code == 204
    assert client.get(f"/api/tasks/{child['id']}").status_code == 404
    # Parent still exists
    assert client.get(f"/api/tasks/{parent['id']}").status_code == 200


def test_cycle_guard(client):
    """Setting a descendant as parent is rejected."""
    parent = client.post("/api/tasks", json={"title": "Parent"}).json()
    child = client.post("/api/tasks", json={
        "title": "Child",
        "parent_id": parent["id"],
    }).json()
    # Try to make parent a child of its own child
    response = client.put(f"/api/tasks/{parent['id']}", json={"parent_id": child["id"]})
    assert response.status_code == 400
    assert "cycle" in response.json()["detail"].lower()


def test_self_parent_guard(client):
    """A task cannot be its own parent."""
    task = client.post("/api/tasks", json={"title": "Task"}).json()
    response = client.put(f"/api/tasks/{task['id']}", json={"parent_id": task["id"]})
    assert response.status_code == 400
