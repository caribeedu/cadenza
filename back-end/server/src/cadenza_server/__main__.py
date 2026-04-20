"""CLI entry point: ``uv run cadenza-server`` or ``python -m cadenza_server``."""

from __future__ import annotations

import argparse
import asyncio
import logging

from .server import DEFAULT_HOST, DEFAULT_HTTP_PORT, DEFAULT_PORT, CadenzaServer


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="cadenza-server",
        description="Cadenza WebSocket hub (plugin + MIDI + Electron frontend).",
    )
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="WebSocket port (frontend).")
    parser.add_argument(
        "--http-port",
        type=int,
        default=DEFAULT_HTTP_PORT,
        help="HTTP ingest port (MuseScore plugin fallback).",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=args.log_level,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    server = CadenzaServer(host=args.host, port=args.port, http_port=args.http_port)
    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
