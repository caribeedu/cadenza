import { CadenzaClient, type WebSocketCtor } from "@shared/lib/ws-client";
import { beforeEach, describe, expect, it } from "vitest";

class MockSocket extends EventTarget {
  static CLOSED = 3;
  static OPEN = 1;
  static instances: MockSocket[] = [];
  readyState = 0;
  readonly sent: string[] = [];
  readonly url: string;

  constructor(url: string) {
    super();
    this.url = url;
    MockSocket.instances.push(this);
  }

  close(): void {
    this.readyState = MockSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  send(data: string): void {
    if (this.readyState !== MockSocket.OPEN) {
      throw new Error("MockSocket.send called while not OPEN");
    }
    this.sent.push(data);
  }

  _message(payload: string): void {
    this.dispatchEvent(new MessageEvent("message", { data: payload }));
  }

  _open(): void {
    this.readyState = MockSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }
}

const MockSocketCtor = MockSocket as unknown as WebSocketCtor;

beforeEach(() => {
  MockSocket.instances.length = 0;
});

describe("CadenzaClient outbound buffering", () => {
  it("returns false and queues while the socket is not open", () => {
    const client = new CadenzaClient({
      url: "ws://test",
      WebSocketCtor: MockSocketCtor,
    });
    client.connect();
    const socket = MockSocket.instances.at(-1)!;

    expect(client.send({ role: "frontend", type: "hello" })).toBe(false);
    expect(client.pendingSendCount).toBe(1);
    expect(socket.sent).toHaveLength(0);
  });

  it("flushes queued messages on open in arrival order before 'open' fires", () => {
    const client = new CadenzaClient({
      url: "ws://test",
      WebSocketCtor: MockSocketCtor,
    });
    client.connect();
    const socket = MockSocket.instances.at(-1)!;

    client.send({ role: "frontend", type: "hello" });
    client.send({ type: "list_midi" });
    client.send({ type: "start" });

    let sentAtOpen = 0;
    client.addEventListener("open", () => {
      sentAtOpen = socket.sent.length;
    });

    socket._open();

    expect(sentAtOpen).toBe(3);
    expect(
      socket.sent.map((s) => (JSON.parse(s) as { type: string }).type),
    ).toEqual(["hello", "list_midi", "start"]);
    expect(client.pendingSendCount).toBe(0);
  });

  it("goes straight to the wire for live sends after open", () => {
    const client = new CadenzaClient({
      url: "ws://test",
      WebSocketCtor: MockSocketCtor,
    });
    client.connect();
    const socket = MockSocket.instances.at(-1)!;
    socket._open();

    expect(client.send({ type: "stop" })).toBe(true);
    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toEqual({ type: "stop" });
    expect(client.pendingSendCount).toBe(0);
  });

  it("drops the oldest message and emits 'send-dropped' on overflow", () => {
    const client = new CadenzaClient({
      outboundQueueLimit: 2,
      url: "ws://test",
      WebSocketCtor: MockSocketCtor,
    });
    client.connect();

    const dropped: { type: string }[] = [];
    client.addEventListener("send-dropped", (e) => {
      dropped.push((e as CustomEvent<{ type: string }>).detail);
    });

    client.send({ type: "first" });
    client.send({ type: "second" });
    client.send({ type: "third" });
    client.send({ type: "fourth" });

    expect(client.pendingSendCount).toBe(2);
    expect(dropped.map((m) => m.type)).toEqual(["first", "second"]);

    const socket = MockSocket.instances.at(-1)!;
    socket._open();
    expect(
      socket.sent.map((s) => (JSON.parse(s) as { type: string }).type),
    ).toEqual(["third", "fourth"]);
  });

  it("replays the queue after a reconnect", () => {
    const client = new CadenzaClient({
      url: "ws://test",
      WebSocketCtor: MockSocketCtor,
    });
    client.connect();
    const first = MockSocket.instances.at(-1)!;
    first._open();

    first.close();
    expect(client.isOpen).toBe(false);

    client.send({ type: "start" });
    expect(client.pendingSendCount).toBe(1);

    client._open();
    const second = MockSocket.instances.at(-1)!;
    second._open();

    expect(
      second.sent.map((s) => (JSON.parse(s) as { type: string }).type),
    ).toEqual(["start"]);
  });

  it("rejects a non-positive queue limit", () => {
    expect(
      () =>
        new CadenzaClient({
          outboundQueueLimit: 0,
          url: "ws://test",
          WebSocketCtor: MockSocketCtor,
        }),
    ).toThrow(/outboundQueueLimit/);
    expect(
      () =>
        new CadenzaClient({
          outboundQueueLimit: -1,
          url: "ws://test",
          WebSocketCtor: MockSocketCtor,
        }),
    ).toThrow(/outboundQueueLimit/);
    expect(
      () =>
        new CadenzaClient({
          outboundQueueLimit: 1.5,
          url: "ws://test",
          WebSocketCtor: MockSocketCtor,
        }),
    ).toThrow(/outboundQueueLimit/);
  });
});

describe("CadenzaClient message decoding", () => {
  it("decodes JSON and rejects non-object payloads", () => {
    const client = new CadenzaClient({
      url: "ws://test",
      WebSocketCtor: MockSocketCtor,
    });
    client.connect();
    const socket = MockSocket.instances.at(-1)!;
    socket._open();

    const messages: unknown[] = [];
    client.addEventListener("message", (e) => {
      messages.push((e as CustomEvent<unknown>).detail);
    });

    const protoErrors: unknown[] = [];
    client.addEventListener("protocol-error", (e) => {
      protoErrors.push((e as CustomEvent<unknown>).detail);
    });

    socket._message('{"type":"status","midi_open":true}');
    socket._message("[1,2,3]");

    expect(messages).toEqual([{ midi_open: true, type: "status" }]);
    expect(protoErrors).toHaveLength(1);
  });
});
