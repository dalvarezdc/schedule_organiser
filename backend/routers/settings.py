from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import AppSettings
from backend.schemas import SettingsOut, SettingsUpdate
from backend.crypto import encrypt

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> AppSettings:
    s = db.get(AppSettings, 1)
    if not s:
        s = AppSettings(id=1)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    return SettingsOut(
        ai_provider=s.ai_provider,
        ai_model=s.ai_model,
        ai_base_url=s.ai_base_url,
        ai_api_key_set=bool(s.ai_api_key_encrypted),
        slack_webhook_url=s.slack_webhook_url,
        discord_webhook_url=s.discord_webhook_url,
        google_calendar_id=s.google_calendar_id,
        google_connected=bool(s.google_oauth_token_encrypted),
    )


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if payload.ai_provider is not None:
        s.ai_provider = payload.ai_provider
    if payload.ai_model is not None:
        s.ai_model = payload.ai_model
    if payload.ai_base_url is not None:
        s.ai_base_url = payload.ai_base_url
    if payload.ai_api_key is not None:
        s.ai_api_key_encrypted = encrypt(payload.ai_api_key)
    if payload.slack_webhook_url is not None:
        s.slack_webhook_url = payload.slack_webhook_url
    if payload.discord_webhook_url is not None:
        s.discord_webhook_url = payload.discord_webhook_url
    if payload.google_calendar_id is not None:
        s.google_calendar_id = payload.google_calendar_id
    db.commit()
    db.refresh(s)
    return SettingsOut(
        ai_provider=s.ai_provider,
        ai_model=s.ai_model,
        ai_base_url=s.ai_base_url,
        ai_api_key_set=bool(s.ai_api_key_encrypted),
        slack_webhook_url=s.slack_webhook_url,
        discord_webhook_url=s.discord_webhook_url,
        google_calendar_id=s.google_calendar_id,
        google_connected=bool(s.google_oauth_token_encrypted),
    )
