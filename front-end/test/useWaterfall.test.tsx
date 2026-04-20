// @vitest-environment jsdom

import type { LaneGeometry } from "@shared/types/geometry";
import type { ScoreTimeline } from "@shared/types/score";

import { useWaterfall } from "@features/player/hooks/useWaterfall";
import { act, render } from "@testing-library/react";
import {
  type ReactElement,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Track every instance the hook constructs so the test can assert
// "was it ever instantiated?" and "did the score land on it?" without
// having to peek at internal React state. One live instance at a time
// is the invariant the hook guarantees; tests reject multiple.
interface RendererSpy {
  destroy: () => void;
  destroyed: boolean;
  pause: () => void;
  pauseAt: (virtualMs: number) => void;
  reportPlayback: () => void;
  resume: () => void;
  setLaneGeometry: (geom: LaneGeometry) => void;
  setPlaybackSpeed: (speed: number, alignToVirtualMs?: number) => void;
  setScore: (score: ScoreTimeline) => void;
  start: () => void;
  startAt: (virtualMs: number) => void;
  stop: () => void;
  syncToElapsedMs: (virtualMs: number) => void;
}

const rendererSpies: RendererSpy[] = [];

vi.mock("@shared/lib/waterfall-renderer", () => {
  return {
    WaterfallRenderer: vi.fn().mockImplementation(() => {
      const spy: RendererSpy = {
        destroyed: false,
        destroy: vi.fn(() => {
          spy.destroyed = true;
        }),
        pause: vi.fn(),
        pauseAt: vi.fn(),
        reportPlayback: vi.fn(),
        resume: vi.fn(),
        setLaneGeometry: vi.fn(),
        setPlaybackSpeed: vi.fn(),
        setScore: vi.fn(),
        start: vi.fn(),
        startAt: vi.fn(),
        stop: vi.fn(),
        syncToElapsedMs: vi.fn(),
      };
      rendererSpies.push(spy);
      return spy;
    }),
  };
});

function makeGeometry(id = "g"): LaneGeometry {
  return {
    laneCenterPx: () => 0,
    laneWidthPx: () => 10,
    _id: id,
  } as unknown as LaneGeometry;
}

const SAMPLE_SCORE: ScoreTimeline = {
  bpm: 120,
  duration_ms: 1000,
  notes: [{ duration_ms: 500, id: 0, pitch: 60, start_ms: 0, track: 0 }],
  title: "Minuet",
};

interface HarnessProps {
  geometry: LaneGeometry | null;
  rendererRefOut?: {
    current: null | RefObject<unknown>;
  };
  score?: null | ScoreTimeline;
  serverElapsedMs?: null | number;
  serverPaused?: boolean;
  serverPlaybackSpeed?: number;
  serverPlaying?: boolean;
  sessionRestartGeneration?: number;
}

function Harness({
  geometry,
  rendererRefOut,
  score = null,
  serverElapsedMs = null,
  serverPaused = false,
  serverPlaybackSpeed = 1,
  serverPlaying = false,
  sessionRestartGeneration = 0,
}: HarnessProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const rendererRef = useWaterfall({
    canvasRef,
    laneGeometry: geometry,
    latestNotePlayed: null,
    score,
    serverElapsedMs,
    serverPaused,
    serverPlaybackSpeed,
    serverPlaying,
    sessionRestartGeneration,
  });
  if (rendererRefOut) rendererRefOut.current = rendererRef;
  return (
    <canvas
      data-mounted={mounted ? "1" : "0"}
      ref={canvasRef}
    />
  );
}

beforeEach(() => {
  rendererSpies.length = 0;
});

describe("useWaterfall", () => {
  it("constructs the renderer once laneGeometry becomes available", () => {
    const { rerender } = render(<Harness geometry={null} />);
    expect(rendererSpies).toHaveLength(0);

    act(() => {
      rerender(<Harness geometry={makeGeometry("first")} />);
    });
    expect(rendererSpies).toHaveLength(1);
    expect(rendererSpies[0].destroyed).toBe(false);
  });

  it("applies a score that arrived before the renderer existed", () => {
    const { rerender } = render(
      <Harness geometry={null} score={SAMPLE_SCORE} />,
    );
    expect(rendererSpies).toHaveLength(0);

    act(() => {
      rerender(<Harness geometry={makeGeometry()} score={SAMPLE_SCORE} />);
    });
    expect(rendererSpies).toHaveLength(1);
    expect(rendererSpies[0].setScore).toHaveBeenCalledWith(SAMPLE_SCORE);
  });

  it("re-applies the server's playing state when the renderer becomes available", () => {
    // If the server is already playing when the frontend mounts
    // (reload mid-session), the renderer must immediately start
    // ticking as soon as laneGeometry resolves. Without this guard,
    // a late-joining client would show a frozen playfield despite
    // notes arriving over the wire.
    const { rerender } = render(
      <Harness
        geometry={null}
        serverElapsedMs={null}
        serverPlaying={true}
      />,
    );
    act(() => {
      rerender(
        <Harness
          geometry={makeGeometry()}
          serverElapsedMs={null}
          serverPlaying={true}
        />,
      );
    });
    expect(rendererSpies).toHaveLength(1);
    // Without a server-supplied elapsed the hook falls back to the
    // plain ``start`` path (same as pre-drift-fix behaviour).
    expect(rendererSpies[0].start).toHaveBeenCalledTimes(1);
  });

  it("does not destroy the renderer when laneGeometry identity changes", () => {
    const { rerender } = render(
      <Harness geometry={makeGeometry("a")} />,
    );
    expect(rendererSpies).toHaveLength(1);
    act(() => {
      rerender(<Harness geometry={makeGeometry("b")} />);
    });
    expect(rendererSpies).toHaveLength(1);
    expect(rendererSpies[0].destroyed).toBe(false);
    expect(rendererSpies[0].setLaneGeometry).toHaveBeenCalled();
  });

  it("destroys and rebuilds the renderer when laneGeometry disappears then returns", () => {
    const { rerender } = render(
      <Harness geometry={makeGeometry("a")} />,
    );
    expect(rendererSpies).toHaveLength(1);
    const first = rendererSpies[0];

    act(() => {
      rerender(<Harness geometry={null} />);
    });
    expect(first.destroyed).toBe(true);

    act(() => {
      rerender(<Harness geometry={makeGeometry("b")} />);
    });
    expect(rendererSpies).toHaveLength(2);
    expect(rendererSpies[1].destroyed).toBe(false);
  });

  describe("server-authoritative clock sync", () => {
    it("does not drive the renderer on UI-only speed changes", () => {
      // Regression for the drag-drift bug: updating the UI slider
      // (which is no longer fed to this hook) must not cause the
      // renderer's speed to change. Only a confirmed server-echoed
      // ``serverPlaybackSpeed`` should.
      const { rerender } = render(
        <Harness geometry={makeGeometry()} serverPlaybackSpeed={1} />,
      );
      expect(rendererSpies).toHaveLength(1);
      // Initial mount pushes speed=1 once; we reset the spy so the
      // assertion below is about the re-render specifically.
      (rendererSpies[0].setPlaybackSpeed as unknown as {
        mockClear: () => void;
      }).mockClear();

      act(() => {
        // Rerender with the same server speed — the renderer must not
        // be rebased. Previously the UI slider drove this path and a
        // mere re-render with an unchanged committed value could still
        // trigger a rebase via the dependency on serverElapsedMs.
        rerender(
          <Harness
            geometry={makeGeometry()}
            serverElapsedMs={1234}
            serverPlaybackSpeed={1}
          />,
        );
      });
      expect(rendererSpies[0].setPlaybackSpeed).not.toHaveBeenCalled();
    });

    it("aligns the renderer to the server's elapsed_ms on speed change", () => {
      const { rerender } = render(
        <Harness
          geometry={makeGeometry()}
          serverElapsedMs={1000}
          serverPaused={false}
          serverPlaybackSpeed={1}
          serverPlaying={true}
        />,
      );
      expect(rendererSpies).toHaveLength(1);
      (rendererSpies[0].setPlaybackSpeed as unknown as {
        mockClear: () => void;
      }).mockClear();

      act(() => {
        // Backend confirms 0.5× with elapsed=1200ms. The renderer
        // must be rebased to both the new speed and the server's
        // authoritative virtual-time playhead — without the alignment,
        // slider round-trips left the two sides drifted by one RTT.
        rerender(
          <Harness
            geometry={makeGeometry()}
            serverElapsedMs={1200}
            serverPaused={false}
            serverPlaybackSpeed={0.5}
            serverPlaying={true}
          />,
        );
      });
      expect(rendererSpies[0].setPlaybackSpeed).toHaveBeenCalledWith(0.5, 1200);
    });

    it("starts the renderer at the server's elapsed_ms on a play transition", () => {
      // Late-join scenario: the frontend mounts while the backend is
      // already several seconds into the session. The renderer must
      // begin animating at the server's playhead, not at zero.
      const { rerender } = render(
        <Harness
          geometry={makeGeometry()}
          serverElapsedMs={null}
          serverPaused={false}
          serverPlaying={false}
        />,
      );
      expect(rendererSpies).toHaveLength(1);

      act(() => {
        rerender(
          <Harness
            geometry={makeGeometry()}
            serverElapsedMs={5_200}
            serverPaused={false}
            serverPlaying={true}
          />,
        );
      });
      expect(rendererSpies[0].startAt).toHaveBeenCalledWith(5_200);
      expect(rendererSpies[0].start).not.toHaveBeenCalled();
    });

    it("resumes from the paused position instead of restarting on resume", () => {
      // Regression bug: clicking Resume after
      // Pause caused the playfield to restart from the beginning. The
      // pause→play transition satisfies both ``(serverPlaying &&
      // !wasPlaying && !serverPaused)`` *and* ``(!serverPaused &&
      // wasPaused)``; without an explicit ordering the former would
      // win and call ``startAt`` (which resets note statuses to
      // ``pending`` and pins the clock to ``elapsed_ms``), clobbering
      // the paused position the user expects to continue from.
      const { rerender } = render(
        <Harness
          geometry={makeGeometry()}
          serverElapsedMs={1_000}
          serverPaused={false}
          serverPlaying={true}
        />,
      );
      expect(rendererSpies).toHaveLength(1);
      const spy = rendererSpies[0];

      act(() => {
        rerender(
          <Harness
            geometry={makeGeometry()}
            serverElapsedMs={4_200}
            serverPaused={true}
            serverPlaying={false}
          />,
        );
      });
      expect(spy.pauseAt).toHaveBeenCalledWith(4_200);
      (spy.startAt as unknown as { mockClear: () => void }).mockClear();
      (spy.start as unknown as { mockClear: () => void }).mockClear();

      act(() => {
        rerender(
          <Harness
            geometry={makeGeometry()}
            serverElapsedMs={4_200}
            serverPaused={false}
            serverPlaying={true}
          />,
        );
      });
      expect(spy.resume).toHaveBeenCalledTimes(1);
      expect(spy.start).not.toHaveBeenCalled();
      expect(spy.startAt).not.toHaveBeenCalled();
    });

    it("pauses at the server's elapsed_ms on a pause transition", () => {
      const { rerender } = render(
        <Harness
          geometry={makeGeometry()}
          serverElapsedMs={0}
          serverPaused={false}
          serverPlaying={true}
        />,
      );
      expect(rendererSpies).toHaveLength(1);

      act(() => {
        rerender(
          <Harness
            geometry={makeGeometry()}
            serverElapsedMs={3_400}
            serverPaused={true}
            serverPlaying={false}
          />,
        );
      });
      expect(rendererSpies[0].pauseAt).toHaveBeenCalledWith(3_400);
      expect(rendererSpies[0].pause).not.toHaveBeenCalled();
    });

    it("recenters the waterfall when sessionRestartGeneration bumps mid-play", () => {
      const { rerender } = render(
        <Harness
          geometry={makeGeometry()}
          score={SAMPLE_SCORE}
          serverPlaying={true}
          sessionRestartGeneration={1}
        />,
      );
      expect(rendererSpies).toHaveLength(1);
      const spy = rendererSpies[0];
      (spy.startAt as unknown as { mockClear: () => void }).mockClear();

      act(() => {
        rerender(
          <Harness
            geometry={makeGeometry()}
            score={SAMPLE_SCORE}
            serverPlaying={true}
            sessionRestartGeneration={2}
          />,
        );
      });
      expect(spy.startAt).toHaveBeenCalledWith(0);
    });
  });
});
