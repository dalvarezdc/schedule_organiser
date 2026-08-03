from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./schedule.db"
    secret_key: str = "change-me-to-a-random-32-char-string"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/integrations/calendar/callback"

    class Config:
        env_file = ".env"


settings = Settings()
