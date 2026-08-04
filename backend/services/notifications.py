import httpx
from datetime import datetime
from typing import Optional


async def _post_webhook(url: str, body: dict) -> None:
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, timeout=10)
        resp.raise_for_status()


def _slack_payload(title: str, description: str, due_date: Optional[datetime], task_id: str) -> dict:
    due_str = due_date.strftime("%Y-%m-%d") if due_date else "No due date"
    return {
        "text": f"*New task:* {title}",
        "attachments": [
            {
                "text": description,
                "fields": [{"title": "Due", "value": due_str, "short": True}],
                "color": "#4A90D9",
            }
        ],
    }


def _discord_payload(title: str, description: str, due_date: Optional[datetime], task_id: str) -> dict:
    due_str = due_date.strftime("%Y-%m-%d") if due_date else "No due date"
    return {
        "embeds": [
            {
                "title": f"New task: {title}",
                "description": description,
                "color": 4886481,
                "fields": [{"name": "Due", "value": due_str, "inline": True}],
            }
        ]
    }


async def send_task_created(
    title: str,
    description: str,
    due_date: Optional[datetime],
    task_id: str,
    slack_url: str,
    discord_url: str,
) -> None:
    if slack_url:
        await _post_webhook(slack_url, _slack_payload(title, description, due_date, task_id))
    if discord_url:
        await _post_webhook(discord_url, _discord_payload(title, description, due_date, task_id))


async def send_task_done(
    title: str,
    task_id: str,
    slack_url: str,
    discord_url: str,
) -> None:
    if slack_url:
        await _post_webhook(slack_url, {"text": f":white_check_mark: Task done: *{title}*"})
    if discord_url:
        await _post_webhook(discord_url, {"content": f"Task done: **{title}**"})
