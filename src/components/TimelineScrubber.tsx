import { createEffect, createMemo, createSignal, For, onCleanup } from "solid-js";
import { buildTimelineBins, msToRatio, ratioToMs } from "../lib/timeline-preview";
import "./TimelineScrubber.css";

const PREVIEW_BIN_COUNT = 96;

type Note = { start_ms: number };

type Props = {
  notes: Note[];
  durationMs: number;
  positionMs: number;
  playing: boolean;
  paused: boolean;
  speed: number;
  enabled: boolean;
  onSeek: (ms: number) => void;
};

export function TimelineScrubber(props: Props) {
  let railRef: HTMLDivElement | undefined;
  const [dragMs, setDragMs] = createSignal<number | null>(null);
  const [nowMs, setNowMs] = createSignal(performance.now());
  let anchorElapsed = props.positionMs;
  let anchorWall = performance.now();

  createEffect(() => {
    anchorElapsed = props.positionMs;
    anchorWall = performance.now();
  });

  createEffect(() => {
    let raf = 0;
    if (props.playing && !props.paused) {
      const tick = () => {
        setNowMs(performance.now());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(raf));
    } else {
      setNowMs(performance.now());
    }
  });

  const bins = createMemo(() =>
    props.enabled
      ? buildTimelineBins(props.notes, props.durationMs, PREVIEW_BIN_COUNT)
      : [],
  );

  const runningMs = () => {
    if (props.playing && !props.paused) {
      const dt = Math.max(0, nowMs() - anchorWall);
      return anchorElapsed + dt * props.speed;
    }
    return props.positionMs;
  };

  const effectiveMs = () => dragMs() ?? runningMs();
  const thumbPct = () =>
    props.enabled ? msToRatio(effectiveMs(), props.durationMs) * 100 : 0;

  function positionToMs(clientX: number): number {
    const el = railRef;
    if (!el || !props.enabled) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / Math.max(1, rect.width);
    return ratioToMs(ratio, props.durationMs);
  }

  function onPointerDown(e: PointerEvent) {
    if (!props.enabled || !railRef) return;
    railRef.setPointerCapture(e.pointerId);
    const targetMs = positionToMs(e.clientX);
    setDragMs(targetMs);

    const onMove = (ev: PointerEvent) => setDragMs(positionToMs(ev.clientX));
    const onUp = (ev: PointerEvent) => {
      railRef?.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const next = Number.isFinite(ev.clientX) ? positionToMs(ev.clientX) : targetMs;
      setDragMs(null);
      props.onSeek(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div class="timeline" data-enabled={props.enabled ? "1" : "0"}>
      <div
        class="timeline-scrubber"
        ref={railRef}
        role="slider"
        tabindex={props.enabled ? 0 : -1}
        onPointerDown={(e) => onPointerDown(e)}
      >
        <div class="timeline-scrubber__bins">
          <For each={bins()}>
            {(bin) => (
              <span
                class="timeline-scrubber__bin"
                style={{ height: `${Math.max(8, Math.round(bin.density * 100))}%` }}
              />
            )}
          </For>
        </div>
        <div class="timeline-scrubber__thumb" style={{ left: `${thumbPct()}%` }} />
      </div>
    </div>
  );
}
