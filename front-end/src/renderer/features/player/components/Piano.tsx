import type { KeyboardLayout } from "@shared/types/geometry";
import type { NotePlayed } from "@shared/types/score";

import { isBlackKey } from "@shared/lib/piano-layout";
import { octaveForPitch } from "@shared/lib/timeline";
import { type ReactElement, useEffect, useRef, useState } from "react";

export const FLASH_DURATION_MS = 300;

export type FlashKind = "bad" | "good" | "neutral";

export const KIND_BY_CORRECTNESS = {
  false: "bad",
  true: "good",
} as const;

export function correctnessToKind(correct: boolean | null): FlashKind {
  if (correct === true) return "good";
  if (correct === false) return "bad";
  return "neutral";
}

// Class modifiers mirror CSS custom-property hooks in piano.css so a
// future theming feature can recolour keys without component changes.
const STATE_CLASS: Record<FlashKind, string> = {
  bad: "key-pressed-bad",
  good: "key-pressed-good",
  neutral: "key-pressed-neutral",
};

export interface PianoProps {
  height?: number | undefined;
  heldMidiPitches: readonly number[];
  latestNotePlayed: NotePlayed | null;
  layout: KeyboardLayout | null;
}

export function Piano({
  height = 140,
  heldMidiPitches,
  latestNotePlayed,
  layout,
}: PianoProps): null | ReactElement {
  const [keyFlashes, setKeyFlashes] = useState<Map<number, FlashKind>>(
    () => new Map(),
  );
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const heldPitchesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    heldPitchesRef.current = new Set(heldMidiPitches);
    if (heldMidiPitches.length > 0) return;
    setKeyFlashes((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const [pitch, kind] of prev.entries()) {
        if (kind === "neutral") next.delete(pitch);
      }
      return next;
    });
  }, [heldMidiPitches]);

  // Cleanup timers on unmount to avoid setState-on-unmounted warnings.
  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!latestNotePlayed) return;
    const pitch = latestNotePlayed.played_pitch;
    if (pitch == null) return;

    const kind = correctnessToKind(latestNotePlayed.correct);

    setKeyFlashes((prev) => {
      const next = new Map(prev);
      next.set(pitch, kind);
      return next;
    });

    const existing = timersRef.current.get(pitch);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      if (heldPitchesRef.current.has(pitch)) {
        const heldTimer = setTimeout(() => {
          setKeyFlashes((prev) => {
            if (heldPitchesRef.current.has(pitch)) return prev;
            const next = new Map(prev);
            next.delete(pitch);
            return next;
          });
          timersRef.current.delete(pitch);
        }, FLASH_DURATION_MS);
        timersRef.current.set(pitch, heldTimer);
        return;
      }
      setKeyFlashes((prev) => {
        const next = new Map(prev);
        next.delete(pitch);
        return next;
      });
      timersRef.current.delete(pitch);
    }, FLASH_DURATION_MS);
    timersRef.current.set(pitch, timer);
  }, [latestNotePlayed]);

  if (!layout) return null;

  const width = layout.totalWidthPx;
  const effectiveHeight = height ?? 140;
  const blackHeight = Math.round(effectiveHeight * 0.62);
  const labelY = effectiveHeight - 6;

  return (
    <svg
      aria-label="Piano keyboard"
      className="piano-svg"
      height={effectiveHeight}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${effectiveHeight}`}
      width={width}
    >
      {layout.whites.map(({ pitch, xLeft }) => (
        <KeyRect
          flashKind={keyFlashes.get(pitch)}
          height={effectiveHeight}
          key={`w-${pitch}`}
          pitch={pitch}
          type="white"
          width={layout.whiteWidth}
          x={xLeft}
          y={0}
        />
      ))}

      {layout.whites
        .filter(({ pitch }) => pitch % 12 === 0)
        .map(({ pitch, xLeft }) => (
          <text
            className="key-label"
            key={`label-${pitch}`}
            textAnchor="middle"
            x={xLeft + layout.whiteWidth / 2}
            y={labelY}
          >
            {`C${octaveForPitch(pitch)}`}
          </text>
        ))}

      {layout.blacks
        .filter(({ pitch }) => isBlackKey(pitch))
        .map(({ pitch, width: w, xLeft }) => (
          <KeyRect
            flashKind={keyFlashes.get(pitch)}
            height={blackHeight}
            key={`b-${pitch}`}
            pitch={pitch}
            type="black"
            width={w}
            x={xLeft}
            y={0}
          />
        ))}
    </svg>
  );
}

interface KeyRectProps {
  flashKind?: FlashKind | undefined;
  height: number;
  pitch: number;
  type: "black" | "white";
  width: number;
  x: number;
  y: number;
}

function KeyRect({
  flashKind,
  height,
  pitch,
  type,
  width,
  x,
  y,
}: KeyRectProps): ReactElement {
  const cls = type === "white" ? "key-white" : "key-black";
  const stateClass = flashKind ? STATE_CLASS[flashKind] : "";
  return (
    <rect
      className={`${cls} ${stateClass}`.trim()}
      data-pitch={pitch}
      height={height}
      rx={type === "white" ? 3 : 2}
      ry={type === "white" ? 3 : 2}
      width={width}
      x={x}
      y={y}
    />
  );
}
