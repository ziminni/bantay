"""FastAPI application: lifespan, middleware, error handling and Swagger."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .api.router import api_router
from .config import settings
from .db import Base, check_database, engine, ensure_vector_extension
from .services.camera_worker import manager

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


TAGS_METADATA = [
    {
        "name": "System",
        "description": "Service health and readiness.",
    },
    {
        "name": "Dashboard",
        "description": "Counters, entries per hour and per-laboratory totals for today.",
    },
    {
        "name": "Persons & Enrollment",
        "description": (
            "Register people and enroll their faces. Enrollment requires recorded "
            "consent; uploaded photos become embeddings and are discarded."
        ),
    },
    {
        "name": "Laboratories",
        "description": "Laboratories, their opening hours, match threshold and cooldown.",
    },
    {
        "name": "Cameras & Live View",
        "description": "RTSP cameras, their workers, and the MJPEG live view.",
    },
    {
        "name": "Entry Logs",
        "description": "Search, export and manage the record of who entered which laboratory.",
    },
    {
        "name": "Recognition",
        "description": (
            "Run recognition against an uploaded image, with or without writing an "
            "entry. Useful for measuring accuracy and choosing the threshold."
        ),
    },
    {
        "name": "Behavior Flags",
        "description": "Suspicious activity detection queue, incident review, and decision audit logs.",
    },
]

DESCRIPTION = f"""
**Bantay** records who enters each computer laboratory and flags anomalous behavior
automatically from existing CCTV cameras.

A camera worker reads its RTSP stream, detects faces, produces 512-dimensional
ArcFace embeddings, matches against enrolled persons via pgvector cosine search,
and logs entries when the match reaches the laboratory threshold and is outside the cooldown period.
Unknown faces, after-hours visits, and anomalous behaviors automatically generate incident flags
for administrative review.

### Where to start
1. `POST {settings.api_prefix}/labs` — create a laboratory.
2. `POST {settings.api_prefix}/persons` — create a person with `consent_given: true`.
3. `POST {settings.api_prefix}/persons/{{id}}/faces` — upload 3 to 5 face photos.
4. `POST {settings.api_prefix}/cameras` — add the entrance camera's RTSP URL.
5. `GET  {settings.api_prefix}/flags` — review suspicious behavior incidents.

Use `POST {settings.api_prefix}/recognize` to test matching against a still image
without writing anything, and `POST {settings.api_prefix}/entries` to record an
entry by hand while no camera is connected.
""".strip()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Prepare the database and start the camera workers."""
    logger.info("Starting %s backend %s", settings.app_name, __version__)

    if check_database():
        try:
            ensure_vector_extension()
            if settings.db_auto_create:
                Base.metadata.create_all(bind=engine)
                logger.warning(
                    "DB_AUTO_CREATE is on: tables were created directly. "
                    "Use Alembic migrations in production."
                )
        except Exception:
            logger.exception("Database preparation failed.")
    else:
        logger.error(
            "The database at %s is unreachable. The API will start, but every "
            "endpoint that touches data will fail.",
            settings.database_url.rsplit("@", 1)[-1],
        )

    Path(settings.media_root).mkdir(parents=True, exist_ok=True)
    manager.start_all()

    yield

    manager.stop_all()
    logger.info("Backend stopped.")


app = FastAPI(
    title=f"{settings.app_name} API",
    description=DESCRIPTION,
    version=__version__,
    openapi_tags=TAGS_METADATA,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={
        "docExpansion": "list",
        "defaultModelsExpandDepth": 1,
        "displayRequestDuration": True,
        "filter": True,
        "tryItOutEnabled": True,
        "persistAuthorization": True,
    },
    contact={"name": "Bantay — Sanchez & Velasco, Central Mindanao University"},
    license_info={"name": "Academic, non-commercial use (InsightFace model licence)"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return validation problems as 422 with the offending fields."""
    return JSONResponse(
        status_code=422,
        content={"detail": "Request validation failed.", "errors": exc.errors()},
    )


app.include_router(api_router)

# Unknown-face snapshots, served read-only to the dashboard.
media_root = Path(settings.media_root)
media_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_root)), name="media")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Send a bare visit straight to the Swagger UI."""
    return RedirectResponse(url="/docs")


def main() -> None:
    """Entry point for `uv run bantay-backend`."""
    import uvicorn

    uvicorn.run(
        "bantay_backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
    )
