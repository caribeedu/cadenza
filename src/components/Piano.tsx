import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { KeyboardLayout } from "../lib/geometry";
import { isBlackKey } from "../lib/timeline";
import { octaveForPitch } from "../lib/timeline";
import "./Piano.css";

export type FlashKind = "good" | "bad" | "neutral";

export type NotePlayed = {
  played_pitch: number;
  correct: boolean | null;
};

const FLASH_DURATION_MS = 300;

function correctnessToKind(correct: boolean | null): FlashKind {
  if (correct === true) return "good";
  if (correct === false) return "bad";
  return "neutral";
}

type Props = {
  layout: KeyboardLayout | null;
  latestNotePlayed: NotePlayed | null;
  heldMidiPitches: readonly number[];
  height?: number;
};

export function Piano(props: Props) {
  const [keyFlashes, setKeyFlashes] = createSignal<Map<number, FlashKind>>(new Map());
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let heldPitches = new Set<number>();
  let prevHeld = new Set<number>();

  createEffect(() => {
    const held = new Set(props.heldMidiPitches);
    heldPitches = held;

    for (const pitch of prevHeld) {
      if (!held.has(pitch)) {
        const existing = timers.get(pitch);
        if (existing) clearTimeout(existing);
        timers.delete(pitch);
        setKeyFlashes((map) => {
          if (!map.has(pitch)) return map;
          const next = new Map(map);
          next.delete(pitch);
          return next;
        });
      }
    }
    prevHeld = held;

    if (props.heldMidiPitches.length === 0) {
      setKeyFlashes((prevMap) => {
        let changed = false;
        const next = new Map(prevMap);
        for (const [pitch, kind] of prevMap.entries()) {
          if (kind === "neutral") {
            next.delete(pitch);
            changed = true;
          }
        }
        return changed ? next : prevMap;
      });
    }
  });

  createEffect(() => {
    const note = props.latestNotePlayed;
    if (!note || note.played_pitch == null) return;

    const pitch = note.played_pitch;
    const kind = correctnessToKind(note.correct);

    setKeyFlashes((prev) => {
      const next = new Map(prev);
      next.set(pitch, kind);
      return next;
    });

    const existing = timers.get(pitch);
    if (existing) clearTimeout(existing);
    timers.set(
      pitch,
      setTimeout(() => {
        if (heldPitches.has(pitch)) {
          const heldTimer = setTimeout(() => {
            setKeyFlashes((prev) => {
              if (heldPitches.has(pitch)) return prev;
              const next = new Map(prev);
              next.delete(pitch);
              return next;
            });
            timers.delete(pitch);
          }, FLASH_DURATION_MS);
          timers.set(pitch, heldTimer);
          return;
        }
        setKeyFlashes((prev) => {
          const next = new Map(prev);
          next.delete(pitch);
          return next;
        });
        timers.delete(pitch);
      }, FLASH_DURATION_MS),
    );
  });

  onCleanup(() => {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  });

  return (
    <Show when={props.layout}>
      {(layout) => {
        const l = layout();
        const height = props.height ?? 140;
        const blackHeight = Math.round(height * 0.62);
        const labelY = height - 6;
        const width = l.totalWidthPx;

        return (
          <svg
            class="piano-svg"
            height={height}
            width={width}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-label="Piano keyboard"
            role="img"
          >
            <For each={l.whites}>
              {(key) => (
                <KeyRect
                  type="white"
                  pitch={key.pitch}
                  x={key.xLeft}
                  y={0}
                  width={l.whiteWidth}
                  height={height}
                  flash={keyFlashes().get(key.pitch)}
                />
              )}
            </For>
            <For each={l.whites.filter((k) => k.pitch % 12 === 0)}>
              {(key) => (
                <text
                  class="key-label"
                  x={key.xLeft + l.whiteWidth / 2}
                  y={labelY}
                  text-anchor="middle"
                >
                  {`C${octaveForPitch(key.pitch)}`}
                </text>
              )}
            </For>
            <For each={l.blacks.filter((k) => isBlackKey(k.pitch))}>
              {(key) => (
                <KeyRect
                  type="black"
                  pitch={key.pitch}
                  x={key.xLeft}
                  y={0}
                  width={key.width}
                  height={blackHeight}
                  flash={keyFlashes().get(key.pitch)}
                />
              )}
            </For>
          </svg>
        );
      }}
    </Show>
  );
}

function KeyRect(props: {
  type: "white" | "black";
  pitch: number;
  x: number;
  y: number;
  width: number;
  height: number;
  flash?: FlashKind;
}) {
  const baseFill = () => (props.type === "white" ? "#f0f0f0" : "#222222");
  const baseStroke = () => (props.type === "white" ? "#888888" : "#111111");
  const state = () => {
    if (props.flash === "good") return "key-pressed-good";
    if (props.flash === "bad") return "key-pressed-bad";
    if (props.flash === "neutral") return "key-pressed-neutral";
    return "";
  };
  const rx = () => (props.type === "white" ? 5 : 3);

  return (
    <rect
      class={`${props.type === "white" ? "key-white" : "key-black"} ${state()}`.trim()}
      data-pitch={props.pitch}
      fill={baseFill()}
      stroke={baseStroke()}
      stroke-width="1"
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      rx={rx()}
      ry={rx()}
    />
  );
}
