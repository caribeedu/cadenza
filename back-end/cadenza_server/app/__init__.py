"""Composition root: configuration, lifespan, and FastAPI factory."""

from cadenza_server.app.config import AppConfig
from cadenza_server.app.factory import create_app
from cadenza_server.app.lifespan import build_lifespan

__all__ = ["AppConfig", "build_lifespan", "create_app"]
