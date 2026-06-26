"""FastAPI application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import admin as admin_routes
from .routes import incidents as incident_routes

settings = get_settings()
logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Incident Stories API starting (model=%s)", settings.llm_model)
    yield
    logger.info("Incident Stories API shutting down")


app = FastAPI(
    title="Incident Stories API",
    version="0.1.0",
    description="Backend for Incident Stories — turns rough engineer notes into polished STAR stories.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incident_routes.router)
app.include_router(admin_routes.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": settings.llm_model}