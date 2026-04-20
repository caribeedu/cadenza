"""Core domain: protocol enums, score model, and validation logic.

This package holds pure, transport-agnostic code. Nothing here imports
FastAPI, websockets, mido, or uvicorn — making every symbol trivially
unit-testable and re-usable from alternative transports (CLI, a
future gRPC endpoint, a stub replay harness, etc.).
"""

from cadenza_server.core.protocol import (
    MessageType,
    decode,
    encode,
)
from cadenza_server.core.score import (
    DEFAULT_BPM,
    Score,
    ScoreNote,
    build_score_from_payload,
)
from cadenza_server.core.validator import (
    DEFAULT_TOLERANCE_MS,
    ValidationResult,
    Validator,
    unvalidated_reason,
)

__all__ = [
    "DEFAULT_BPM",
    "DEFAULT_TOLERANCE_MS",
    "MessageType",
    "Score",
    "ScoreNote",
    "ValidationResult",
    "Validator",
    "build_score_from_payload",
    "decode",
    "encode",
    "unvalidated_reason",
]
