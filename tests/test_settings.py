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
    assert data["ai_api_key_set"] is True


def test_api_key_not_exposed(client):
    client.put("/api/settings", json={"ai_api_key": "secret-key"})
    response = client.get("/api/settings")
    assert "secret-key" not in str(response.json())
