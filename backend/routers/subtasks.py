from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, Subtask
from backend.schemas import SubtaskCreate, SubtaskUpdate, SubtaskOut

router = APIRouter(prefix="/api/tasks/{task_id}/subtasks", tags=["subtasks"])


def _get_task(task_id: str, db: Session) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=SubtaskOut, status_code=201)
def add_subtask(task_id: str, payload: SubtaskCreate, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    sub = Subtask(task_id=task_id, title=payload.title, done=payload.done, order=payload.order)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/{subtask_id}", response_model=SubtaskOut)
def update_subtask(task_id: str, subtask_id: str, payload: SubtaskUpdate, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    sub = db.get(Subtask, subtask_id)
    if not sub or sub.task_id != task_id:
        raise HTTPException(status_code=404, detail="Subtask not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{subtask_id}", status_code=204)
def delete_subtask(task_id: str, subtask_id: str, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    sub = db.get(Subtask, subtask_id)
    if not sub or sub.task_id != task_id:
        raise HTTPException(status_code=404, detail="Subtask not found")
    db.delete(sub)
    db.commit()
