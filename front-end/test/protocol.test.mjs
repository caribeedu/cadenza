import test from "node:test";
import assert from "node:assert/strict";

import {
  MSG_HELLO,
  MSG_PAUSE,
  MSG_RESUME,
  MSG_SET_TOLERANCE,
  MSG_START,
  MSG_STOP,
  decode,
  encode,
} from "../src/renderer/protocol.js";

test("encode/decode round-trips an object", () => {
  const input = { type: MSG_HELLO, role: "frontend" };
  assert.deepEqual(decode(encode(input)), input);
});

test("decode rejects non-object payloads", () => {
  assert.throws(() => decode("[]"));
  assert.throws(() => decode("\"hello\""));
  assert.throws(() => decode("null"));
});

test("decode surfaces JSON parse errors", () => {
  assert.throws(() => decode("{not json"));
});

test("pause/resume/start/stop constants are distinct and well-known strings", () => {
  // Regression guard: the Pause button emits MSG_PAUSE and the Start
  // button emits MSG_START. If the constants ever collide or drift from
  // the Python side, the server silently routes to the wrong dispatch.
  const set = new Set([MSG_START, MSG_PAUSE, MSG_RESUME, MSG_STOP]);
  assert.equal(set.size, 4);
  assert.equal(MSG_PAUSE, "pause");
  assert.equal(MSG_RESUME, "resume");
  assert.equal(MSG_START, "start");
});

test("MSG_SET_TOLERANCE matches the server's dispatch key", () => {
  // Mirrors `protocol.MSG_SET_TOLERANCE` on the Python side. If one
  // drifts, the slider silently stops applying.
  assert.equal(MSG_SET_TOLERANCE, "set_tolerance");
  assert.notEqual(MSG_SET_TOLERANCE, MSG_START);
});
