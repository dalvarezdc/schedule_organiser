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
