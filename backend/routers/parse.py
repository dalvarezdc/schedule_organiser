from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import ParseRequest, ParseResponse
from backend.services.ai_parser import parse_text
from backend.crypto import decrypt
from backend.routers.settings import _get_or_create_settings

router = APIRouter(prefix="/api", tags=["parse"])


@router.post("/parse", response_model=ParseResponse)
async def parse_input(payload: ParseRequest, db: Session = Depends(get_db)):
    s = _get_or_create_settings(db)
    if not s.ai_api_key_encrypted:
        raise HTTPException(status_code=400, detail="AI API key not configured. Set it in Settings.")
    api_key = decrypt(s.ai_api_key_encrypted)
    try:
        tasks = await parse_text(
            text=payload.text,
            provider=s.ai_provider,
            api_key=api_key,
            model=s.ai_model,
            base_url=s.ai_base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {e}")
    return ParseResponse(tasks=tasks)
