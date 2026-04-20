"""FastAPI app factory.

``create_app`` instantiates the Hub, wires routers, configures middleware,
and attaches the lifespan. Returning a fresh app per call keeps tests
isolated — they can override config, spin up their own ``TestClient``,
and discard it without poisoning shared state.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cadenza_server.app.config import AppConfig
from cadenza_server.app.lifespan import build_lifespan
from cadenza_server.features.api import build_score_router, build_ws_router
from cadenza_server.features.hub import Hub


def create_app(config: AppConfig | None = None) -> FastAPI:
    """Return a fully wired FastAPI application.

    The created :class:`~cadenza_server.features.hub.Hub` is exposed via
    ``app.state.hub`` so tests and admin endpoints can reach into state.
    """
    cfg = config or AppConfig()
    hub = Hub()

    app = FastAPI(
        title="Cadenza",
        version="0.2.0",
        description=(
            "Cadenza backend: a FastAPI hub exposing a WebSocket endpoint at "
            "`/` for the Electron frontend and an HTTP score ingest at `/score` "
            "for the MuseScore plugin."
        ),
        lifespan=build_lifespan(hub),
    )
    app.state.hub = hub
    app.state.config = cfg

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(cfg.cors_allow_origins),
        allow_methods=["POST", "OPTIONS", "GET"],
        allow_headers=["Content-Type"],
    )

    app.include_router(build_score_router(hub))
    app.include_router(build_ws_router(hub))
    return app
