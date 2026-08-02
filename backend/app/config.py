from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    # Signs the short-lived OAuth-state session cookie. Separate from
    # JWT_SECRET so either can rotate independently; falls back to JWT_SECRET
    # when unset so local dev keeps working.
    session_secret: str = ""
    owner_email: str
    # Comma-separated Google accounts that may host Cambio rooms. These
    # accounts receive no access to owner-only routes or integrations.
    cambio_host_emails: str = "hannahbrier1@gmail.com"
    google_client_id: str
    google_client_secret: str
    oauth_redirect_uri: str
    # Fernet key used only for persisted Google OAuth refresh tokens. Keep it
    # independent from JWT_SECRET so either credential can rotate separately.
    google_token_encryption_key: str = ""
    cookie_domain: str = ""  # empty for localhost (host-only cookie)
    frontend_origin: str = "http://localhost:3000"

    # Language tool (optional — audio generation is skipped when unset)
    google_tts_api_key: str = ""
    cloudinary_url: str = ""

    # LLM fallback for wiki lookups + card enrichment (OpenRouter).
    llm_base_url: str = "https://openrouter.ai/api/v1"
    open_router_api_key: str = ""
    multilingual_model: str = ""
    fallback_model: str = ""

    # Brain (/brain) — private Obsidian vault synced from a GitHub repo.
    # All optional so local dev degrades gracefully when unset.
    brain_repo: str = ""  # "owner/name" of the private vault repo
    brain_github_token: str = ""  # fine-grained PAT, contents:read on that repo
    brain_webhook_secret: str = ""  # GitHub webhook HMAC secret (X-Hub-Signature-256)
    brain_chat_model: str = ""  # default OpenRouter slug; UI picker overrides per request
    # Tiny, non-streaming model used only to name a new Brain chat from its opener.
    brain_title_model: str = "mistralai/mistral-nemo"
    # Web search tool (Tavily, LLM-oriented). Set the key to offer web_search
    # to the agent. Free tier ~1,000 searches/month.
    brain_tavily_key: str = ""  # Tavily API key (tvly-...)

    # Read-only source-code tools for Brain. Keep this token separate from the
    # vault token so each credential can be restricted to exactly its repos.
    brain_code_repos: str = ""  # comma-separated "owner/repo" allowlist
    brain_code_github_token: str = ""  # fine-grained PAT, contents + pull requests read

    # Read-only Railway deployment visibility. Each token should be a project
    # token scoped to the production environment for exactly one project.
    brain_railway_colehenry_token: str = ""
    brain_railway_colehenry_service_id: str = ""
    brain_railway_lapwise_token: str = ""
    brain_railway_lapwise_service_id: str = ""

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

    @property
    def cambio_host_email_set(self) -> set[str]:
        return {
            email.strip().lower()
            for email in self.cambio_host_emails.split(",")
            if email.strip()
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
