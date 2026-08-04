from fastapi import FastAPI
from backend.database import Base, engine
import backend.models  # noqa: F401
from backend.routers import tasks, subtasks, settings, parse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Schedule Organiser")

app.include_router(tasks.router)
app.include_router(subtasks.router)
app.include_router(settings.router)
app.include_router(parse.router)


@app.get("/health")
def health():
    return {"status": "ok"}
