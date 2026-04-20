"""Top-level application configuration.

Kept as a plain frozen dataclass rather than ``pydantic.BaseSettings`` so
the CLI can populate it from argparse without dragging env-var loading,
and so tests can construct variants with ``dataclasses.replace``.
"""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
DEFAULT_LOG_LEVEL = "INFO"


@dataclass(frozen=True)
class AppConfig:
    """Immutable runtime configuration for the Cadenza server."""

    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    log_level: str = DEFAULT_LOG_LEVEL
    # CORS allow-list. The frontend (Electron) talks to us over
    # ``file://`` or ``http://localhost:*`` depending on dev vs. prod,
    # so we default to allowing any origin. Operators running the server
    # outside localhost should tighten this.
    cors_allow_origins: tuple[str, ...] = ("*",)
