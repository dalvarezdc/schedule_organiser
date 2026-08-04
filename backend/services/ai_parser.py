import json
import httpx
from backend.schemas import ParsedTask, ParsedSubtask  # noqa: F401 — re-exported for callers


SYSTEM_PROMPT = """You are a smart task organiser assistant. The user will give you a narrative description of their tasks in plain text.

Your job is to identify every distinct task mentioned and return them as a structured JSON array. For each task:
- Write a short, clear title
- Write a 1-3 sentence description (auto-generate if the user didn't provide one)
- Extract any subtasks mentioned
- Extract dates if mentioned (ISO 8601 format), otherwise null
- Infer a priority (low/medium/high) based on urgency or importance language used

Return ONLY a valid JSON array. No markdown, no explanation. Example:
[
  {
    "title": "Book dentist appointment",
    "description": "Schedule a routine dental checkup.",
    "subtasks": [{"title": "Find dentist number"}, {"title": "Call to book"}],
    "due_date": null,
    "scheduled_date": null,
    "priority": "medium"
  }
]"""


async def _call_ai(text: str, provider: str, api_key: str, model: str, base_url: str) -> list[dict]:
    """Call the configured AI provider and return the raw parsed JSON list."""
    if provider == "anthropic":
        base = base_url or "https://api.anthropic.com"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {
            "model": model,
            "max_tokens": 2048,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": text}],
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{base}/v1/messages", json=body, headers=headers, timeout=30)
            resp.raise_for_status()
            content = resp.json()["content"][0]["text"]
        try:
            data = json.loads(content)
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and "tasks" in data:
                return data["tasks"]
            raise ValueError(f"Unexpected AI response shape: {content}")
        except json.JSONDecodeError as e:
            raise ValueError(f"AI returned invalid JSON: {e}") from e
    else:
        # OpenAI-compatible (openai, custom)
        base = base_url or "https://api.openai.com"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{base}/v1/chat/completions", json=body, headers=headers, timeout=30)
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and "tasks" in parsed:
                return parsed["tasks"]
            if isinstance(parsed, list):
                return parsed
            raise ValueError(f"Unexpected AI response shape: {raw}")


async def parse_text(text: str, provider: str, api_key: str, model: str, base_url: str) -> list[ParsedTask]:
    raw_tasks = await _call_ai(text, provider, api_key, model, base_url)
    return [ParsedTask(**t) for t in raw_tasks]
