import { createMemo, Show } from "solid-js";
import { useAppStore } from "../AppProvider";
import { Piano } from "../../components/Piano";
import { TimelineScrubber } from "../../components/TimelineScrubber";
import { Waterfall } from "../../components/Waterfall";
import { Button } from "../../components/ui/Button";
import { useElementWidth } from "../../hooks/useElementWidth";
import { formatFingeringProgressLabel } from "../../lib/fingering-ui";
import { computeKeyboardLayout } from "../../lib/piano-layout";
import { HIGHEST_MIDI, LOWEST_MIDI } from "../../lib/timeline";
import "./PlayerScreen.css";

type Props = {
  onOpenSettings: () => void;
};

export function PlayerScreen(props: Props) {
  const store = useAppStore();
  const { ref: pianoHostRef, width: pianoWidth } = useElementWidth();

  const layout = createMemo(() => {
    const w = pianoWidth();
    if (w <= 0) return null;
    try {
      return computeKeyboardLayout({
        low: LOWEST_MIDI,
        high: HIGHEST_MIDI,
        totalWidthPx: w,
      });
    } catch {
      return null;
    }
  });

  const waterfallReady = createMemo(() => {
    const score = store.timeline();
    const laneGeometry = layout();
    if (!score || !laneGeometry) return null;
    return { score, laneGeometry };
  });

  const scrubberEnabled = () => {
    const t = store.timeline();
    return !!t && t.duration_ms > 0 && t.notes.length > 0;
  };

  const isPlaying = () => {
    const s = store.status();
    return !!s?.playing && !s.paused;
  };

  const isPaused = () => !!store.status()?.paused;

  return (
    <div class="player-screen">
      <header class="player-topbar">
        <div class="player-topbar__info">
          <Show when={store.timeline()} fallback={<span class="player-topbar__title">No score</span>}>
            {(t) => (
              <>
                <span class="player-topbar__title">{t().title ?? "Untitled"}</span>
                <Show when={t().composer?.trim()}>
                  {(c) => <span class="player-topbar__meta"> · {c()}</span>}
                </Show>
                <span class="player-topbar__meta">
                  {" "}
                  · {t().notes.length} notes · {t().bpm} BPM
                </span>
                <Show when={store.fingeringProgress()}>
                  {(p) => (
                    <span class="player-topbar__meta">
                      {" "}
                      · {formatFingeringProgressLabel(p())}
                    </span>
                  )}
                </Show>
              </>
            )}
          </Show>
        </div>
        <div class="player-topbar__actions">
          <Button variant="ghost" size="icon" onClick={() => props.onOpenSettings()} aria-label="Settings">
            ⚙
          </Button>
          <Show
            when={isPlaying()}
            fallback={
              <Show
                when={isPaused()}
                fallback={
                  <Button variant="primary" size="sm" onClick={() => void store.play()}>
                    ▶ Play
                  </Button>
                }
              >
                <Button variant="primary" size="sm" onClick={() => void store.resume()}>
                  ▶ Resume
                </Button>
              </Show>
            }
          >
            <Button variant="ghost" size="sm" onClick={() => void store.pause()}>
              ⏸ Pause
            </Button>
          </Show>
          <Button variant="ghost" size="sm" onClick={() => void store.stop()}>
            ⏹ Stop
          </Button>
        </div>
      </header>

      <Show when={store.bannerError()}>
        <div class="player-toast toast toast--error" role="alert">
          {store.bannerError()}
        </div>
      </Show>

      <div class="playfield player-playfield">
        <div class="waterfall-stage">
          <Show
            when={waterfallReady()}
            fallback={
              <div class="waterfall-empty">
                <p>Waterfall appears when a score is loaded.</p>
              </div>
            }
          >
            {(ctx) => (
              <Waterfall
                laneGeometry={ctx().laneGeometry}
                score={ctx().score}
                serverElapsedMs={store.status()?.positionMs ?? null}
                serverPlaying={store.status()?.playing ?? false}
                serverPaused={store.status()?.paused ?? false}
                serverPlaybackSpeed={store.status()?.speed ?? 1}
                latestNotePlayed={store.waterfallNote()}
                sessionRestartGeneration={store.sessionRestartGeneration()}
                seekGeneration={store.seekGeneration()}
                heldMidiPitches={store.heldMidiPitches()}
                waterfallThemeId={store.waterfallThemeId()}
              />
            )}
          </Show>
          <div class="waterfall-timeline-overlay">
            <TimelineScrubber
              notes={store.timeline()?.notes ?? []}
              durationMs={store.timeline()?.duration_ms ?? 0}
              positionMs={store.status()?.positionMs ?? 0}
              playing={store.status()?.playing ?? false}
              paused={store.status()?.paused ?? false}
              speed={store.status()?.speed ?? 1}
              enabled={scrubberEnabled()}
              onSeek={(ms) => void store.seek(ms)}
            />
          </div>
        </div>
        <div class="piano-host" ref={pianoHostRef}>
          <Piano
            layout={layout()}
            latestNotePlayed={store.latestNote()}
            heldMidiPitches={store.heldMidiPitches()}
          />
        </div>
      </div>
    </div>
  );
}
