from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, TaskStatus
from backend.schemas import TaskCreate, TaskUpdate, TaskOut, ImproveResponse, SlackBulkNotifyRequest, SlackBulkNotifyResponse
from backend.routers.settings import _get_or_create_settings
from backend.services.notifications import send_task_created, send_tasks_to_slack
from backend.services.calendar import create_event
from backend.services.ai_parser import improve_task as ai_improve_task
from backend.crypto import decrypt
from datetime import datetime


router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_task_or_404(task_id: str, db: Session) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _collect_descendant_ids(task: Task) -> set[str]:
    """Return all descendant IDs of a task (not including the task itself)."""
    ids = set()
    for child in task.children:
        ids.add(child.id)
        ids |= _collect_descendant_ids(child)
    return ids


def _validate_parent(task_id: str, new_parent_id: str, db: Session) -> None:
    """Raise 400 if setting parent_id would create a cycle."""
    if new_parent_id == task_id:
        raise HTTPException(status_code=400, detail="A task cannot be its own parent.")
    task = db.get(Task, task_id)
    if task is not None:
        descendants = _collect_descendant_ids(task)
        if new_parent_id in descendants:
            raise HTTPException(status_code=400, detail="Cannot set a descendant as parent (cycle).")


async def _sync_create_calendar_event(
    task_id: str, token: str, calendar_id: str,
    title: str, description: str, date: datetime,
    db: Session,
) -> None:
    event_id = create_event(token, calendar_id, title, description, date)
    task = db.get(Task, task_id)
    if task:
        task.google_event_id = event_id
        db.commit()


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    """Return root tasks only; children are nested via the relationship."""
    return (
        db.query(Task)
        .filter(Task.parent_id.is_(None))
        .order_by(Task.created_at.desc())
        .all()
    )


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    return _get_task_or_404(task_id, db)


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if payload.parent_id:
        _get_task_or_404(payload.parent_id, db)

    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        scheduled_date=payload.scheduled_date,
        parent_id=payload.parent_id,
        order=payload.order,
    )
    db.add(task)
    db.flush()

    # Create inline subtasks as child Tasks
    for i, sub in enumerate(payload.subtasks):
        child = Task(
            title=sub.title,
            status=TaskStatus.done if sub.done else TaskStatus.pending,
            priority=task.priority,
            parent_id=task.id,
            order=sub.order or i,
        )
        db.add(child)

    db.commit()
    db.refresh(task)

    s = _get_or_create_settings(db)
    if payload.notify_slack and s.slack_webhook_url:
        background_tasks.add_task(
            send_task_created,
            title=task.title,
            description=task.description,
            due_date=task.due_date,
            task_id=task.id,
            slack_url=s.slack_webhook_url,
            discord_url="",
        )
    if payload.notify_discord and s.discord_webhook_url:
        background_tasks.add_task(
            send_task_created,
            title=task.title,
            description=task.description,
            due_date=task.due_date,
            task_id=task.id,
            slack_url="",
            discord_url=s.discord_webhook_url,
        )
    if payload.sync_calendar and (task.due_date or task.scheduled_date) and s.google_oauth_token_encrypted:
        token = decrypt(s.google_oauth_token_encrypted)
        date = task.due_date or task.scheduled_date
        background_tasks.add_task(
            _sync_create_calendar_event,
            task_id=task.id,
            token=token,
            calendar_id=s.google_calendar_id,
            title=task.title,
            description=task.description,
            date=date,
            db=db,
        )
    return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)

    if payload.parent_id is not None:
        _validate_parent(task_id, payload.parent_id, db)
        _get_task_or_404(payload.parent_id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)
    db.delete(task)
    db.commit()


@router.post("/{task_id}/improve", response_model=ImproveResponse)
async def improve_task_endpoint(task_id: str, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)
    s = _get_or_create_settings(db)
    if not s.ai_api_key_encrypted:
        raise HTTPException(status_code=400, detail="AI API key not configured. Set it in Settings.")
    api_key = decrypt(s.ai_api_key_encrypted)
    try:
        result = await ai_improve_task(
            title=task.title,
            description=task.description,
            provider=s.ai_provider,
            api_key=api_key,
            model=s.ai_model,
            base_url=s.ai_base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI improve failed: {e}")
    return result


@router.post("/slack-notify", response_model=SlackBulkNotifyResponse)
async def slack_notify_endpoint(
    payload: SlackBulkNotifyRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    if not payload.task_ids:
        raise HTTPException(status_code=400, detail="No task IDs provided.")

    s = _get_or_create_settings(db)
    webhook_url = (payload.slack_webhook_url or s.slack_webhook_url or "").strip()
    if not webhook_url:
        raise HTTPException(
            status_code=400,
            detail="Slack Webhook URL is not configured. Set it in Settings or enter a webhook URL.",
        )

    tasks = db.query(Task).filter(Task.id.in_(payload.task_ids)).all()
    if not tasks:
        raise HTTPException(status_code=404, detail="No matching tasks found for the provided IDs.")

    base_url = str(request.base_url).rstrip("/")
    try:
        await send_tasks_to_slack(tasks, webhook_url, base_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to send Slack notification: {e}")

    return SlackBulkNotifyResponse(
        success=True,
        sent_count=len(tasks),
        message=f"Successfully sent {len(tasks)} task(s) to Slack.",
    )

