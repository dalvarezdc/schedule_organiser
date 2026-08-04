from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from backend.database import Base, engine
import backend.models  # noqa: F401
from backend.routers import tasks, settings, parse, share, integrations

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Schedule Organiser")

app.include_router(tasks.router)
app.include_router(settings.router)
app.include_router(parse.router)
app.include_router(share.router)
app.include_router(integrations.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve built React frontend for all non-API routes
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIST):
    _assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
