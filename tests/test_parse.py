import pytest
from unittest.mock import patch
from backend.services.ai_parser import parse_text, ParsedTask


MOCK_AI_RESPONSE = [
    {
        "title": "Book dentist appointment",
        "description": "Schedule a routine checkup with the dentist.",
        "subtasks": [{"title": "Find dentist number"}, {"title": "Call to book"}],
        "due_date": None,
        "scheduled_date": None,
        "priority": "medium"
    }
]


@pytest.mark.asyncio
async def test_parse_text_returns_tasks():
    with patch("backend.services.ai_parser._call_ai", return_value=MOCK_AI_RESPONSE):
        result = await parse_text("I need to book a dentist appointment", provider="openai", api_key="sk-test", model="gpt-4o", base_url="")
    assert len(result) == 1
    assert result[0].title == "Book dentist appointment"
    assert len(result[0].subtasks) == 2


@pytest.mark.asyncio
async def test_parse_text_invalid_json_raises():
    with patch("backend.services.ai_parser._call_ai", side_effect=ValueError("bad json")):
        with pytest.raises(ValueError):
            await parse_text("some text", provider="openai", api_key="sk-test", model="gpt-4o", base_url="")


def test_parse_endpoint_returns_preview(client):
    client.put("/api/settings", json={"ai_api_key": "sk-test", "ai_provider": "openai", "ai_model": "gpt-4o"})
    with patch("backend.routers.parse.parse_text", return_value=[
        ParsedTask(title="Task 1", description="Do something", subtasks=[], priority="medium")
    ]):
        response = client.post("/api/parse", json={"text": "I need to do something"})
    assert response.status_code == 200
    assert response.json()["tasks"][0]["title"] == "Task 1"


def test_parse_endpoint_requires_api_key(client):
    response = client.post("/api/parse", json={"text": "some text"})
    assert response.status_code == 400
