from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    assemblyai_api_key: str = ""
    anthropic_api_key: str = ""

    # Comma-separated, in priority order. AssemblyAI falls back to the next model
    # for languages the first one doesn't support. If AssemblyAI rejects a name,
    # change it here (no code edit needed).
    speech_models: str = "universal-3-pro,universal-2"

    # Guard rail: very long transcripts get expensive (and Haiku 5.5 has a price
    # cliff above 100K tokens). 250K chars is roughly 4 hours of speech.
    max_transcript_chars: int = 250_000

    # as_posix() keeps the SQLite URL valid on Windows (forward slashes)
    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'app.db').as_posix()}"
    upload_dir: Path = BASE_DIR / "data" / "uploads"
    max_upload_mb: int = 100
    cors_origins: list[str] = ["http://localhost:5173"]

    @property
    def speech_model_list(self) -> list[str]:
        return [m.strip() for m in self.speech_models.split(",") if m.strip()]


config = Config()
