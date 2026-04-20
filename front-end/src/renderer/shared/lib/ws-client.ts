// Small WebSocket client that auto-reconnects with exponential backoff,
// decodes JSON messages, and buffers outbound traffic while the socket
// isn't OPEN (TD-06). Framework-free so it can be unit-tested with a
// fake WebSocket constructor.

import { decode, type DecodedMessage, encode } from "./protocol";

const DEFAULT_OUTBOUND_QUEUE_LIMIT = 32;

export interface WebSocketCtor {
  new (url: string): WebSocketLike;
  readonly OPEN: number;
}

// Minimal subset of WebSocket we rely on — typed here so the mock used
// in tests doesn't have to fake every DOM surface of the real thing.
export interface WebSocketLike extends EventTarget {
  close(): void;
  readonly readyState: number;
  send(data: string): void;
}

export interface CadenzaClientOptions {
  outboundQueueLimit?: number;
  url: string;
  WebSocketCtor?: null | WebSocketCtor;
}

export class CadenzaClient extends EventTarget {
  url: string;
  private _attempt = 0;
  private readonly _Ctor: WebSocketCtor;
  private _outbound: unknown[] = [];
  private readonly _outboundQueueLimit: number;
  private _reconnectTimer: null | ReturnType<typeof setTimeout> = null;
  private _shouldRun = false;
  private _socket: null | WebSocketLike = null;

  constructor({
    outboundQueueLimit = DEFAULT_OUTBOUND_QUEUE_LIMIT,
    url,
    WebSocketCtor,
  }: CadenzaClientOptions) {
    super();
    const Ctor =
      WebSocketCtor ?? (globalThis.WebSocket as unknown as WebSocketCtor);
    if (!Ctor) throw new Error("WebSocket implementation required");
    if (!Number.isInteger(outboundQueueLimit) || outboundQueueLimit < 1) {
      throw new RangeError("outboundQueueLimit must be a positive integer");
    }
    this.url = url;
    this._Ctor = Ctor;
    this._outboundQueueLimit = outboundQueueLimit;
  }

  connect(url: string = this.url): void {
    this.url = url;
    this._shouldRun = true;
    this._open();
  }

  disconnect(): void {
    this._shouldRun = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._socket) {
      try {
        this._socket.close();
      } catch {
        /* ignore */
      }
      this._socket = null;
    }
  }

  get isOpen(): boolean {
    return (
      this._socket !== null && this._socket.readyState === this._Ctor.OPEN
    );
  }

  get pendingSendCount(): number {
    return this._outbound.length;
  }

  send(message: unknown): boolean {
    if (this.isOpen && this._socket) {
      this._socket.send(encode(message));
      return true;
    }
    this._enqueue(message);
    return false;
  }

  _open(): void {
    const socket = new this._Ctor(this.url);
    this._socket = socket;

    socket.addEventListener("open", () => {
      this._attempt = 0;
      this._flushOutbound();
      this.dispatchEvent(new Event("open"));
    });

    socket.addEventListener("close", () => {
      this._socket = null;
      this.dispatchEvent(new Event("close"));
      if (this._shouldRun) this._scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      this.dispatchEvent(new Event("error"));
    });

    socket.addEventListener("message", (event) => {
      const data = (event as MessageEvent).data;
      let msg: DecodedMessage;
      try {
        msg = decode(String(data));
      } catch (err) {
        this.dispatchEvent(new CustomEvent("protocol-error", { detail: err }));
        return;
      }
      this.dispatchEvent(new CustomEvent("message", { detail: msg }));
    });
  }

  private _enqueue(message: unknown): void {
    if (this._outbound.length >= this._outboundQueueLimit) {
      const dropped = this._outbound.shift();
      this.dispatchEvent(
        new CustomEvent("send-dropped", { detail: dropped }),
      );
    }
    this._outbound.push(message);
  }

  private _flushOutbound(): void {
    const pending = this._outbound;
    this._outbound = [];
    for (const message of pending) {
      try {
        this._socket?.send(encode(message));
      } catch (err) {
        this._outbound = pending
          .slice(pending.indexOf(message))
          .concat(this._outbound);
        this.dispatchEvent(new CustomEvent("send-error", { detail: err }));
        return;
      }
    }
  }

  private _scheduleReconnect(): void {
    this._attempt += 1;
    const delayMs = Math.min(500 * 2 ** (this._attempt - 1), 8000);
    this._reconnectTimer = setTimeout(() => this._open(), delayMs);
  }
}
