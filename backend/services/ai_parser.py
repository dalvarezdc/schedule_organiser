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


async def _call_anthropic(text: str, api_key: str, model: str, base_url: str) -> list[dict]:
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
    return _parse_json_response(content)


async def _call_openai_compatible(text: str, api_key: str, model: str, base_url: str) -> list[dict]:
    """Handles OpenAI, Grok (xAI), and any OpenAI-compatible endpoint."""
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
        resp = await client.post(f"{base_url}/v1/chat/completions", json=body, headers=headers, timeout=30)
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
    return _parse_json_response(raw)


async def _call_gemini(text: str, api_key: str, model: str) -> list[dict]:
    """Calls Google Gemini via the generateContent REST API."""
    # Gemini model names: gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash, etc.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {"Content-Type": "application/json"}
    params = {"key": api_key}
    body = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "contents": [
            {"parts": [{"text": text}]}
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
    content = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_json_response(content)


def _parse_json_response(raw: str) -> list[dict]:
    """Parse a JSON string that may be a list or a dict with a 'tasks' key."""
    # Strip markdown code fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}") from e
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "tasks" in data:
        return data["tasks"]
    # Some models wrap in other keys — try to find a list value
    for v in data.values():
        if isinstance(v, list):
            return v
    raise ValueError(f"Unexpected AI response shape: {raw[:200]}")


async def _call_ai(text: str, provider: str, api_key: str, model: str, base_url: str) -> list[dict]:
    """Dispatch to the correct AI provider."""
    if provider == "anthropic":
        return await _call_anthropic(text, api_key, model, base_url)

    if provider == "gemini":
        return await _call_gemini(text, api_key, model or "gemini-3.6-flash")

    if provider == "grok":
        # xAI Grok is OpenAI-compatible; preset base URL
        base = base_url or "https://api.x.ai"
        return await _call_openai_compatible(text, api_key, model or "grok-4.5", base)

    # openai or custom — OpenAI-compatible
    base = base_url or "https://api.openai.com"
    return await _call_openai_compatible(text, api_key, model, base)


async def parse_text(text: str, provider: str, api_key: str, model: str, base_url: str) -> list[ParsedTask]:
    raw_tasks = await _call_ai(text, provider, api_key, model, base_url)
    return [ParsedTask(**t) for t in raw_tasks]
