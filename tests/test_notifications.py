import pytest
from unittest.mock import patch, AsyncMock
from backend.services.notifications import send_task_created, send_task_done


@pytest.mark.asyncio
async def test_send_task_created_slack():
    with patch("backend.services.notifications._post_webhook", new_callable=AsyncMock) as mock_post:
        await send_task_created(
            title="Buy milk",
            description="Get 2 litres of whole milk.",
            due_date=None,
            task_id="abc-123",
            slack_url="https://hooks.slack.com/test",
            discord_url="",
        )
        mock_post.assert_called_once()
        args = mock_post.call_args[0]
        assert args[0] == "https://hooks.slack.com/test"


@pytest.mark.asyncio
async def test_send_both_webhooks():
    with patch("backend.services.notifications._post_webhook", new_callable=AsyncMock) as mock_post:
        await send_task_created(
            title="Task", description="Desc", due_date=None, task_id="xyz",
            slack_url="https://hooks.slack.com/a",
            discord_url="https://discord.com/api/webhooks/b",
        )
        assert mock_post.call_count == 2


@pytest.mark.asyncio
async def test_no_webhooks_configured_does_not_raise():
    await send_task_created(
        title="Task", description="Desc", due_date=None, task_id="xyz",
        slack_url="", discord_url=""
    )


@pytest.mark.asyncio
async def test_send_tasks_to_slack():
    from backend.models import Task, TaskStatus, TaskPriority
    task1 = Task(id="t1", title="Task One", description="First task description", status=TaskStatus.pending, priority=TaskPriority.high)
    task2 = Task(id="t2", title="Task Two", description="Second task description", status=TaskStatus.done, priority=TaskPriority.medium)

    with patch("backend.services.notifications._post_webhook", new_callable=AsyncMock) as mock_post:
        from backend.services.notifications import send_tasks_to_slack
        await send_tasks_to_slack(
            tasks=[task1, task2],
            slack_url="https://hooks.slack.com/services/test",
            base_url="http://testserver",
        )
        mock_post.assert_called_once()
        url, payload = mock_post.call_args[0]
        assert url == "https://hooks.slack.com/services/test"
        assert "<!here|@here>" in payload["text"]
        assert "2 task(s)" in payload["text"]

        assert len(payload["attachments"]) == 2

        # Check first task attachment fields & description URL
        att1 = payload["attachments"][0]
        assert att1["title"] == "Task: Task One"
        assert att1["title_link"] == "http://testserver/tasks/t1"
        assert att1["text"] == "First task description"
        url_field = next(f for f in att1["fields"] if f["title"] == "Task URL")
        assert url_field["value"] == "http://testserver/tasks/t1"

