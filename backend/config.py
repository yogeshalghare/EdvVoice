"""Everything configurable lives in backend/.env — nothing is hardcoded."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./edvvoice.db"

    jwt_secret: str = "change-me-before-you-show-this-to-anyone"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    app_url: str = "http://localhost:5173"
    # Extra browser origins allowed to call this API, comma separated.
    # In production this is your Vercel URL.
    cors_origins: str = ""

    # One-time admin bootstrap. Render's free tier has no shell, so there is
    # no way to run create_admin.py against the deployed database. Setting
    # these creates that admin on startup if it does not exist. Remove them
    # from the environment once the account is made.
    admin_email: str = ""
    admin_password: str = ""

    # Require a student to click an emailed link before they can sign in.
    #
    # Default OFF on purpose. Resend's free tier delivers only to the one
    # address the account was registered with, so with this on, nobody but
    # the owner can complete sign-up — at a public demo the app would look
    # broken. Turn it on once a domain is verified in Resend.
    require_email_verification: bool = False

    resend_api_key: str = ""
    resend_from: str = "EdvVoice <onboarding@resend.dev>"

    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Server-side speech to text, used when the browser cannot transcribe.
    # Set either provider; Cloudflare is preferred if both are present.
    # Without one the app still works — students type instead.
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    groq_api_key: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        origins = {
            self.app_url,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        }
        origins.update(o.strip() for o in self.cors_origins.split(",") if o.strip())
        return sorted(o for o in origins if o)

    @property
    def cloudinary_configured(self) -> bool:
        return all([self.cloudinary_cloud_name, self.cloudinary_api_key, self.cloudinary_api_secret])


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
