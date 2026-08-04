import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task
from backend.schemas import TaskOut

router = APIRouter(tags=["share"])


@router.post("/api/tasks/{task_id}/share")
def generate_share(task_id: str, request: Request, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.share_token:
        task.share_token = str(uuid.uuid4())
        db.commit()
        db.refresh(task)
    base_url = str(request.base_url).rstrip("/")
    return {
        "share_token": task.share_token,
        "share_url": f"{base_url}/share/{task.share_token}",
    }


@router.delete("/api/tasks/{task_id}/share", status_code=204)
def revoke_share(task_id: str, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.share_token = None
    db.commit()


@router.get("/api/share/{token}", response_model=TaskOut)
def resolve_share(token: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.share_token == token).first()
    if not task:
        raise HTTPException(status_code=404, detail="Share link not found or revoked")
    return task
