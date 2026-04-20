"""Shared logging bootstrap.

Called by the CLI on startup so every ``logging.getLogger(__name__)``
inside the package inherits the same format and level. Idempotent:
``logging.basicConfig`` is a no-op after the root logger already has a
handler installed.
"""

from __future__ import annotations

import logging


def configure_logging(level: str = "INFO") -> None:
    """Install a single stderr handler on the root logger."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
