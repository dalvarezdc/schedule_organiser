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


@pytest.mark.asyncio
async def test_parse_text_gemini():
    with patch("backend.services.ai_parser._call_ai", return_value=[
        {"title": "Task via Gemini", "description": "Desc", "subtasks": [],
         "due_date": None, "scheduled_date": None, "priority": "low"}
    ]):
        result = await parse_text("Do something", provider="gemini", api_key="AIza-test", model="gemini-2.0-flash", base_url="")
    assert result[0].title == "Task via Gemini"


@pytest.mark.asyncio
async def test_parse_text_grok():
    with patch("backend.services.ai_parser._call_ai", return_value=[
        {"title": "Task via Grok", "description": "Desc", "subtasks": [],
         "due_date": None, "scheduled_date": None, "priority": "high"}
    ]):
        result = await parse_text("Do something", provider="grok", api_key="xai-test", model="grok-3", base_url="")
    assert result[0].title == "Task via Grok"


def test_parse_json_response_strips_markdown():
    from backend.services.ai_parser import _parse_json_response
    raw = '```json\n[{"title": "T", "description": "D", "subtasks": [], "due_date": null, "scheduled_date": null, "priority": "low"}]\n```'
    result = _parse_json_response(raw)
    assert result[0]["title"] == "T"
