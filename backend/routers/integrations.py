from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.routers.settings import _get_or_create_settings
from backend.services.calendar import get_auth_url, exchange_code_for_token
from backend.crypto import encrypt

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/calendar/connect")
def calendar_connect():
    """Redirect user to Google OAuth consent screen."""
    url = get_auth_url()
    return RedirectResponse(url)


@router.get("/calendar/callback")
def calendar_callback(code: str, db: Session = Depends(get_db)):
    """Handle OAuth callback from Google, store token."""
    try:
        token_json = exchange_code_for_token(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {e}")
    s = _get_or_create_settings(db)
    s.google_oauth_token_encrypted = encrypt(token_json)
    db.commit()
    return RedirectResponse("/#/settings?calendar=connected")


@router.delete("/calendar/disconnect", status_code=204)
def calendar_disconnect(db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    s.google_oauth_token_encrypted = ""
    db.commit()
