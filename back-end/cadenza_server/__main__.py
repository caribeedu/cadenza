"""CLI entry point: ``uv run cadenza-server`` or ``python -m cadenza_server``.

Wires argparse to :class:`AppConfig`, configures logging, and hands the
built FastAPI app to uvicorn.
"""

from __future__ import annotations

import argparse
import logging

import uvicorn

from cadenza_server.app import AppConfig, create_app
from cadenza_server.app.config import DEFAULT_HOST, DEFAULT_LOG_LEVEL, DEFAULT_PORT
from cadenza_server.logging_config import configure_logging

log = logging.getLogger("cadenza.cli")


def _parse_args(argv: list[str] | None = None) -> AppConfig:
    parser = argparse.ArgumentParser(
        prog="cadenza-server",
        description=(
            "Cadenza FastAPI hub: WebSocket endpoint for the Electron frontend "
            "and HTTP score ingest for the MuseScore plugin."
        ),
    )
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument(
        "--port", type=int, default=DEFAULT_PORT, help="Port for both WS and HTTP."
    )
    parser.add_argument(
        "--log-level",
        default=DEFAULT_LOG_LEVEL,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args(argv)
    return AppConfig(host=args.host, port=args.port, log_level=args.log_level)


def main(argv: list[str] | None = None) -> None:
    config = _parse_args(argv)
    configure_logging(config.log_level)
    app = create_app(config)
    log.info(
        "Cadenza listening on ws://%s:%d/ and http://%s:%d/score",
        config.host,
        config.port,
        config.host,
        config.port,
    )
    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
        access_log=False,
    )


if __name__ == "__main__":
    main()
