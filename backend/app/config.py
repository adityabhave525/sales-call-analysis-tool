from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    assemblyai_api_key: str = ""
    anthropic_api_key: str = ""
    analysis_model: str = "claude-haiku-5-5"

    # as_posix() keeps the SQLite URL valid on Windows (forward slashes)
    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'app.db').as_posix()}"
    upload_dir: Path = BASE_DIR / "data" / "uploads"
    max_upload_mb: int = 100
    cors_origins: list[str] = ["http://localhost:5173"]


config = Config()
