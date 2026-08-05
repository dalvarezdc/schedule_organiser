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
        "text": f"<!here|@here> *New task:* {title}",
        "link_names": 1,
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
        await _post_webhook(slack_url, {"text": f"<!here|@here> :white_check_mark: Task done: *{title}*", "link_names": 1})
    if discord_url:
        await _post_webhook(discord_url, {"content": f"Task done: **{title}**"})


def _slack_bulk_payload(tasks: list, base_url: str) -> dict:
    attachments = []
    for task in tasks:
        due_str = task.due_date.strftime("%Y-%m-%d") if getattr(task, "due_date", None) else "No due date"
        desc = task.description if getattr(task, "description", None) else "No description provided."
        task_url = f"{base_url.rstrip('/')}/tasks/{task.id}"
        fields = [
            {"title": "Status", "value": str(task.status).replace("_", " ").title(), "short": True},
            {"title": "Priority", "value": str(task.priority).title(), "short": True},
            {"title": "Due Date", "value": due_str, "short": True},
            {"title": "Task URL", "value": task_url, "short": False},
        ]
        attachments.append(
            {
                "color": "#4A90D9",
                "title": f"Task: {task.title}",
                "title_link": task_url,
                "text": desc,
                "fields": fields,
            }
        )
    return {
        "text": f"<!here|@here> *:bell: Slack Notification: {len(tasks)} task(s)*",
        "link_names": 1,
        "attachments": attachments,
    }




async def send_tasks_to_slack(
    tasks: list,
    slack_url: str,
    base_url: str,
) -> None:
    if slack_url and tasks:
        payload = _slack_bulk_payload(tasks, base_url)
        await _post_webhook(slack_url, payload)

