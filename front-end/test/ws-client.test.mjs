import test from "node:test";
import assert from "node:assert/strict";

import { CadenzaClient } from "../src/renderer/ws-client.js";

// Minimal WebSocket mock that exposes the API CadenzaClient needs.
class MockSocket extends EventTarget {
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    MockSocket.instances.push(this);
  }

  send(data) {
    if (this.readyState !== MockSocket.OPEN) {
      // The real WebSocket throws here too. CadenzaClient should never
      // call us in this state once queuing is in place, so surface any
      // regression loudly.
      throw new Error("MockSocket.send called while not OPEN");
    }
    this.sent.push(data);
  }

  close() {
    this.readyState = MockSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  // Helpers for tests.
  _open() {
    this.readyState = MockSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  _message(payload) {
    this.dispatchEvent(new MessageEvent("message", { data: payload }));
  }
}
MockSocket.instances = [];

// CadenzaClient reads `Ctor.OPEN` to decide if the socket is open.
MockSocket.prototype.OPEN = MockSocket.OPEN;

test("send returns false and queues while the socket is not open", () => {
  MockSocket.instances.length = 0;
  const client = new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket });
  client.connect();
  const socket = MockSocket.instances.at(-1);

  assert.equal(client.send({ type: "hello", role: "frontend" }), false);
  assert.equal(
    client.pendingSendCount,
    1,
    "pre-open send must be queued, not silently dropped",
  );
  assert.equal(socket.sent.length, 0);
});

test("queued messages flush on open in arrival order before 'open' fires", () => {
  MockSocket.instances.length = 0;
  const client = new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket });
  client.connect();
  const socket = MockSocket.instances.at(-1);

  client.send({ type: "hello", role: "frontend" });
  client.send({ type: "list_midi" });
  client.send({ type: "start" });

  let sentAtOpen = 0;
  client.addEventListener("open", () => {
    // By the time external listeners observe "open", the flush is done.
    sentAtOpen = socket.sent.length;
  });

  socket._open();

  assert.equal(sentAtOpen, 3, "queue must drain before the 'open' event");
  assert.deepEqual(
    socket.sent.map((s) => JSON.parse(s).type),
    ["hello", "list_midi", "start"],
    "queued messages must flush in arrival order",
  );
  assert.equal(client.pendingSendCount, 0);
});

test("live send after open goes straight to the wire", () => {
  MockSocket.instances.length = 0;
  const client = new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket });
  client.connect();
  const socket = MockSocket.instances.at(-1);
  socket._open();

  assert.equal(client.send({ type: "stop" }), true);
  assert.equal(socket.sent.length, 1);
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: "stop" });
  assert.equal(client.pendingSendCount, 0);
});

test("outbound queue overflow drops the oldest message and emits 'send-dropped'", () => {
  MockSocket.instances.length = 0;
  const client = new CadenzaClient({
    url: "ws://test",
    WebSocketCtor: MockSocket,
    outboundQueueLimit: 2,
  });
  client.connect();

  const dropped = [];
  client.addEventListener("send-dropped", (e) => dropped.push(e.detail));

  client.send({ type: "first" });
  client.send({ type: "second" });
  client.send({ type: "third" }); // pushes first out of the queue
  client.send({ type: "fourth" }); // pushes second out of the queue

  assert.equal(client.pendingSendCount, 2);
  assert.deepEqual(
    dropped.map((m) => m.type),
    ["first", "second"],
    "overflow must surface *which* messages were discarded",
  );

  const socket = MockSocket.instances.at(-1);
  socket._open();

  assert.deepEqual(
    socket.sent.map((s) => JSON.parse(s).type),
    ["third", "fourth"],
    "only the survivors of the overflow get flushed",
  );
});

test("reconnect replays the outbound queue after a close", () => {
  MockSocket.instances.length = 0;
  const client = new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket });
  client.connect();
  const first = MockSocket.instances.at(-1);
  first._open();

  // Client is live; simulate the socket going away mid-session.
  first.close();
  assert.equal(client.isOpen, false);

  // User presses "Start" while reconnect backoff is pending — the
  // message must survive the downtime.
  client.send({ type: "start" });
  assert.equal(client.pendingSendCount, 1);

  // Reconnect happens: simulate a fresh socket and open it.
  client._open();
  const second = MockSocket.instances.at(-1);
  second._open();

  assert.deepEqual(
    second.sent.map((s) => JSON.parse(s).type),
    ["start"],
    "messages queued during downtime must flush on the reconnected socket",
  );
});

test("constructor rejects a non-positive queue limit", () => {
  assert.throws(
    () => new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket, outboundQueueLimit: 0 }),
    /outboundQueueLimit/,
  );
  assert.throws(
    () => new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket, outboundQueueLimit: -1 }),
    /outboundQueueLimit/,
  );
  assert.throws(
    () => new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket, outboundQueueLimit: 1.5 }),
    /outboundQueueLimit/,
  );
});

test("message events decode JSON and reject non-object payloads", () => {
  MockSocket.instances.length = 0;
  const client = new CadenzaClient({ url: "ws://test", WebSocketCtor: MockSocket });
  client.connect();
  const socket = MockSocket.instances.at(-1);
  socket._open();

  const messages = [];
  client.addEventListener("message", (e) => messages.push(e.detail));

  const protoErrors = [];
  client.addEventListener("protocol-error", (e) => protoErrors.push(e.detail));

  socket._message('{"type":"status","midi_open":true}');
  socket._message("[1,2,3]");

  assert.deepEqual(messages, [{ type: "status", midi_open: true }]);
  assert.equal(protoErrors.length, 1);
});
