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

  it("scales elapsed by playback speed", () => {
    let t = 0;
    const clock = new VirtualPlayhead(2, () => t);
    clock.start();
    t = 250;
    expect(clock.getVirtualNowMs()).toBe(500);
  });

  it("freeze-holds virtual ms on pause and resumes from it", () => {
    let t = 0;
    const clock = new VirtualPlayhead(1, () => t);
    clock.start();
    t = 400;
    clock.pause();
    expect(clock.pausedElapsedMs).toBe(400);
    expect(clock.getVirtualNowMs()).toBe(400);
    t = 10_000;
    expect(clock.getVirtualNowMs()).toBe(400);
    clock.resume();
    t = 10_500;
    expect(clock.getVirtualNowMs()).toBe(900);
  });

  it("clears timestamps on stop", () => {
    const clock = new VirtualPlayhead(1, () => 5_000);
    clock.start();
    clock.stop();
    expect(clock.getVirtualNowMs()).toBe(0);
  });

  it("startAt sets virtual time at call and advances 1:1 with wall clock at 1×", () => {
    let t = 10_000;
    const clock = new VirtualPlayhead(1, () => t);
    clock.startAt(2_500);
    expect(clock.getVirtualNowMs()).toBe(2_500);
    t = 11_000;
    expect(clock.getVirtualNowMs()).toBe(3_500);
  });

  it("setPlaybackSpeed with align pins paused and running clocks", () => {
    let t = 0;
    const running = new VirtualPlayhead(1, () => t);
    running.start();
    t = 100;
    running.setPlaybackSpeed(0.5, 100);
    expect(running.speed).toBe(0.5);
    t = 200;
    expect(running.getVirtualNowMs()).toBe(150);

    const paused = new VirtualPlayhead(1, () => t);
    paused.pauseAt(999);
    paused.setPlaybackSpeed(2, 1_000);
    expect(paused.pausedElapsedMs).toBe(1_000);
  });
});
