from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import config
from .database import init_db
from .routers import jobs
from .schemas import AnalysisSettings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config.upload_dir.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="Sales Call Analyzer", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "assemblyai_key_set": bool(config.assemblyai_api_key),
        "anthropic_key_set": bool(config.anthropic_api_key),
    }


@app.get("/api/settings/defaults", response_model=AnalysisSettings)
def default_settings():
    """Frontend renders the settings panel from this, so defaults live in one place."""
    return AnalysisSettings()
