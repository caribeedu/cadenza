import { describe, expect, it } from "vitest";

import { VirtualPlayhead } from "./virtual-playhead";

describe("VirtualPlayhead", () => {
  it("returns 0 for virtual time when never started", () => {
    const clock = new VirtualPlayhead(1, () => 10_000);
    expect(clock.getVirtualNowMs()).toBe(0);
  });

  it("advances virtual time at 1× speed while playing", () => {
    let t = 1_000;
    const clock = new VirtualPlayhead(1, () => t);
    clock.start();
    t += 500;
    expect(clock.getVirtualNowMs()).toBe(500);
  });

  it("freeze-holds virtual ms on pause and resumes from it", () => {
    let t = 0;
    const clock = new VirtualPlayhead(1, () => t);
    clock.start();
    t = 400;
    clock.pause();
    expect(clock.getVirtualNowMs()).toBe(400);
    t = 10_000;
    expect(clock.getVirtualNowMs()).toBe(400);
    clock.resume();
    t = 10_500;
    expect(clock.getVirtualNowMs()).toBe(900);
  });

  it("startAt sets virtual time and advances 1:1 with wall clock at 1×", () => {
    let t = 10_000;
    const clock = new VirtualPlayhead(1, () => t);
    clock.startAt(2_500);
    expect(clock.getVirtualNowMs()).toBe(2_500);
    t = 11_000;
    expect(clock.getVirtualNowMs()).toBe(3_500);
  });
});
