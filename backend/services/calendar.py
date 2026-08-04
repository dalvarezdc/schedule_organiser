import json
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from backend.config import settings as app_settings

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def _build_service(token_json: str):
    creds_data = json.loads(token_json)
    creds = Credentials(
        token=creds_data.get("token"),
        refresh_token=creds_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=app_settings.google_client_id,
        client_secret=app_settings.google_client_secret,
        scopes=SCOPES,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build("calendar", "v3", credentials=creds)


def get_auth_url() -> str:
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": app_settings.google_client_id,
                "client_secret": app_settings.google_client_secret,
                "redirect_uris": [app_settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=app_settings.google_redirect_uri,
    )
    auth_url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return auth_url


def exchange_code_for_token(code: str) -> str:
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": app_settings.google_client_id,
                "client_secret": app_settings.google_client_secret,
                "redirect_uris": [app_settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=app_settings.google_redirect_uri,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials
    return json.dumps({
        "token": creds.token,
        "refresh_token": creds.refresh_token,
    })


def create_event(token_json: str, calendar_id: str, title: str, description: str, date: datetime) -> str:
    service = _build_service(token_json)
    event = {
        "summary": title,
        "description": description,
        "start": {"dateTime": date.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": date.isoformat(), "timeZone": "UTC"},
    }
    result = service.events().insert(calendarId=calendar_id, body=event).execute()
    return result["id"]


def update_event(token_json: str, calendar_id: str, event_id: str, title: str, description: str, date: datetime) -> None:
    service = _build_service(token_json)
    event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
    event["summary"] = title
    event["description"] = description
    event["start"] = {"dateTime": date.isoformat(), "timeZone": "UTC"}
    event["end"] = {"dateTime": date.isoformat(), "timeZone": "UTC"}
    service.events().update(calendarId=calendar_id, eventId=event_id, body=event).execute()


def delete_event(token_json: str, calendar_id: str, event_id: str) -> None:
    service = _build_service(token_json)
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
    except HttpError:
        pass
