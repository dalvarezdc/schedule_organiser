from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, Subtask
from backend.schemas import TaskCreate, TaskUpdate, TaskOut
from backend.routers.settings import _get_or_create_settings
from backend.services.notifications import send_task_created, send_task_done
from backend.services.calendar import create_event, update_event, delete_event
from backend.crypto import decrypt
from datetime import datetime

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


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
    return db.query(Task).order_by(Task.created_at.desc()).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        scheduled_date=payload.scheduled_date,
    )
    db.add(task)
    db.flush()
    for i, sub in enumerate(payload.subtasks):
        db.add(Subtask(task_id=task.id, title=sub.title, done=sub.done, order=sub.order or i))
    db.commit()
    db.refresh(task)
    s = _get_or_create_settings(db)

    # Notifications — only if flag is set AND webhook is configured
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

    # Calendar sync — only if flag is set AND calendar is connected AND task has a date
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


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    becoming_done = payload.status == "done" and task.status != "done"
    old_event_id = task.google_event_id
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    s = _get_or_create_settings(db)
    if becoming_done:
        background_tasks.add_task(
            send_task_done,
            title=task.title,
            task_id=task.id,
            slack_url=s.slack_webhook_url,
            discord_url=s.discord_webhook_url,
        )
    # Update calendar event if date changed and event exists
    new_date = task.due_date or task.scheduled_date
    if old_event_id and new_date and s.google_oauth_token_encrypted:
        token = decrypt(s.google_oauth_token_encrypted)
        background_tasks.add_task(
            update_event,
            token_json=token,
            calendar_id=s.google_calendar_id,
            event_id=old_event_id,
            title=task.title,
            description=task.description,
            date=new_date,
        )
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    s = _get_or_create_settings(db)
    if task.google_event_id and s.google_oauth_token_encrypted:
        token = decrypt(s.google_oauth_token_encrypted)
        background_tasks.add_task(
            delete_event,
            token_json=token,
            calendar_id=s.google_calendar_id,
            event_id=task.google_event_id,
        )
    db.delete(task)
    db.commit()
