// Small WebSocket client that auto-reconnects with exponential backoff and
// emits decoded messages through an EventTarget-friendly callback API.
//
// ``send()`` is **queued** while the socket isn't OPEN and flushed in
// arrival order on the next ``open`` event. The queue has a small bounded
// size so a perma-disconnected client cannot grow it unboundedly — when
// full, the *oldest* queued message is dropped and a ``send-dropped``
// event is emitted so the UI can surface the loss. This replaces the old
// silent ``return false`` behaviour, which masked problems like "Refresh
// does nothing" during the CSP/importmap debugging session.

import { decode, encode } from "./protocol.js";

const DEFAULT_OUTBOUND_QUEUE_LIMIT = 32;

export class CadenzaClient extends EventTarget {
  constructor({
    url,
    WebSocketCtor = globalThis.WebSocket,
    outboundQueueLimit = DEFAULT_OUTBOUND_QUEUE_LIMIT,
  } = {}) {
    super();
    if (!WebSocketCtor) throw new Error("WebSocket implementation required");
    if (!Number.isInteger(outboundQueueLimit) || outboundQueueLimit < 1) {
      throw new RangeError("outboundQueueLimit must be a positive integer");
    }
    this.url = url;
    this._Ctor = WebSocketCtor;
    this._socket = null;
    this._shouldRun = false;
    this._attempt = 0;
    this._reconnectTimer = null;
    this._outboundQueueLimit = outboundQueueLimit;
    // Holds the original message objects (not encoded strings) so we can
    // re-encode them consistently at flush time and so tests can inspect
    // them without JSON round-tripping.
    this._outbound = [];
  }

  get isOpen() {
    return this._socket !== null && this._socket.readyState === this._Ctor.OPEN;
  }

  /** Number of messages currently buffered waiting for the socket to open. */
  get pendingSendCount() {
    return this._outbound.length;
  }

  connect(url = this.url) {
    this.url = url;
    this._shouldRun = true;
    this._open();
  }

  disconnect() {
    this._shouldRun = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._socket) {
      try { this._socket.close(); } catch { /* ignore */ }
      this._socket = null;
    }
  }

  /**
   * Enqueue or send ``message``.
   *
   * Returns ``true`` when the message is already on the wire, ``false``
   * when it was queued for the next ``open`` event. Never silently drops
   * a live message — queue overflow is signalled via a ``send-dropped``
   * CustomEvent carrying the discarded payload.
   */
  send(message) {
    if (this.isOpen) {
      this._socket.send(encode(message));
      return true;
    }
    this._enqueue(message);
    return false;
  }

  _enqueue(message) {
    if (this._outbound.length >= this._outboundQueueLimit) {
      const dropped = this._outbound.shift();
      this.dispatchEvent(
        new CustomEvent("send-dropped", { detail: dropped }),
      );
    }
    this._outbound.push(message);
  }

  _flushOutbound() {
    // Snapshot then clear: re-entrant ``send()`` calls triggered by
    // "open" listeners go to a fresh queue rather than being flushed
    // twice or re-ordered behind the snapshot.
    const pending = this._outbound;
    this._outbound = [];
    for (const message of pending) {
      try {
        this._socket.send(encode(message));
      } catch (err) {
        // Socket closed between ``open`` and ``flush`` — put the
        // remainder back in front of any newcomers and let reconnect
        // replay them.
        this._outbound = pending
          .slice(pending.indexOf(message))
          .concat(this._outbound);
        this.dispatchEvent(new CustomEvent("send-error", { detail: err }));
        return;
      }
    }
  }

  _open() {
    const socket = new this._Ctor(this.url);
    this._socket = socket;

    socket.addEventListener("open", () => {
      this._attempt = 0;
      // Drain queued messages *before* announcing "open" so external
      // listeners see a consistent "we're live, and everything you
      // tried to send earlier is already on the wire" state.
      this._flushOutbound();
      this.dispatchEvent(new Event("open"));
    });

    socket.addEventListener("close", () => {
      this._socket = null;
      this.dispatchEvent(new Event("close"));
      if (this._shouldRun) this._scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // Swallow the generic error and let `close` drive the reconnect. We
      // still forward the event in case callers want to surface it.
      this.dispatchEvent(new Event("error"));
    });

    socket.addEventListener("message", (event) => {
      let msg;
      try {
        msg = decode(event.data);
      } catch (err) {
        this.dispatchEvent(new CustomEvent("protocol-error", { detail: err }));
        return;
      }
      this.dispatchEvent(new CustomEvent("message", { detail: msg }));
    });
  }

  _scheduleReconnect() {
    this._attempt += 1;
    const delayMs = Math.min(500 * 2 ** (this._attempt - 1), 8000);
    this._reconnectTimer = setTimeout(() => this._open(), delayMs);
  }
}
