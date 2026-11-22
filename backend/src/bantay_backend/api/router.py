"""Aggregates every router under the versioned API prefix."""

from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from . import cameras, entries, labs, persons, stats

api_router = APIRouter(prefix=settings.api_prefix)

api_router.include_router(stats.system_router)
api_router.include_router(stats.router)
api_router.include_router(persons.router)
api_router.include_router(labs.router)
api_router.include_router(cameras.router)
api_router.include_router(entries.router)
api_router.include_router(entries.recognition_router)
