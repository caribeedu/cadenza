"""Vendored piano fingering (Blake West's Performer algorithm, Python port).

Source: https://github.com/Kanma/piano_fingering (MIT-style upstream; see module headers).
Adapted for Cadenza: lazy cost-database initialisation to avoid heavy import-time work.
"""

from cadenza_server.core.vendor.performer_fingering.fingering import compute_fingering

__all__ = ["compute_fingering"]
