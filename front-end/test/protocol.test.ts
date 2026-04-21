import {
  decode,
  encode,
  MSG_FINGERING_PROGRESS,
  MSG_HELLO,
  MSG_PAUSE,
  MSG_RESUME,
  MSG_SET_TOLERANCE,
  MSG_START,
  MSG_STOP,
} from "@shared/lib/protocol";
import { describe, expect, it } from "vitest";

describe("encode / decode", () => {
  it("round-trips an object", () => {
    const input = { role: "frontend", type: MSG_HELLO };
    expect(decode(encode(input))).toEqual(input);
  });

  it("rejects non-object payloads", () => {
    expect(() => decode("[]")).toThrow();
    expect(() => decode('"hello"')).toThrow();
    expect(() => decode("null")).toThrow();
  });

  it("surfaces JSON parse errors", () => {
    expect(() => decode("{not json")).toThrow();
  });
});

describe("protocol constants", () => {
  it("pause/resume/start/stop are distinct and well-known strings", () => {
    const set = new Set([MSG_PAUSE, MSG_RESUME, MSG_START, MSG_STOP]);
    expect(set.size).toBe(4);
    expect(MSG_PAUSE).toBe("pause");
    expect(MSG_RESUME).toBe("resume");
    expect(MSG_START).toBe("start");
  });

  it("MSG_SET_TOLERANCE matches the server's dispatch key", () => {
    expect(MSG_SET_TOLERANCE).toBe("set_tolerance");
    expect(MSG_SET_TOLERANCE).not.toBe(MSG_START);
  });

  it("MSG_FINGERING_PROGRESS matches the server outbound type", () => {
    expect(MSG_FINGERING_PROGRESS).toBe("fingering_progress");
  });
});
