"""Cadenza backend package.

Re-exports the stable public surface so callers can continue to import
``from cadenza_server import Score, Validator, ...`` after the 0.2
restructure. Transport details (FastAPI routers, the Hub service, etc.)
live under :mod:`cadenza_server.features` and :mod:`cadenza_server.app`.
"""

from cadenza_server.app import AppConfig, create_app
from cadenza_server.core import (
    DEFAULT_BPM,
    DEFAULT_TOLERANCE_MS,
    MessageType,
    Score,
    ScoreNote,
    ValidationResult,
    Validator,
    build_score_from_payload,
    decode,
    encode,
    unvalidated_reason,
)

__all__ = [
    "AppConfig",
    "DEFAULT_BPM",
    "DEFAULT_TOLERANCE_MS",
    "MessageType",
    "Score",
    "ScoreNote",
    "ValidationResult",
    "Validator",
    "build_score_from_payload",
    "create_app",
    "decode",
    "encode",
    "unvalidated_reason",
]
