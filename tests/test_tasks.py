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
