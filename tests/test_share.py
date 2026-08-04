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
