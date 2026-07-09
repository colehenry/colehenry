from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    owner_email: str
    google_client_id: str
    google_client_secret: str
    oauth_redirect_uri: str
    cookie_domain: str = ""  # empty for localhost (host-only cookie)
    frontend_origin: str = "http://localhost:3000"

    # Language tool (optional — audio generation is skipped when unset)
    google_tts_api_key: str = ""
    cloudinary_url: str = ""

    cookie_name: str = "ch_session"
    jwt_expires_days: int = 30

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Neon and Railway often expose postgresql:// URLs; use psycopg v3.
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cookie_secure(self) -> bool:
        # Secure cookies require https; localhost dev runs plain http.
        return self.frontend_origin.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
