import { usePlayback } from "@app/providers/PlaybackProvider";
import { useElementSize } from "@shared/hooks/useElementSize";
import { type ReactElement, useRef } from "react";

import { useKeyboardLayout } from "../hooks/useKeyboardLayout";
import { useWaterfall } from "../hooks/useWaterfall";
import { Piano } from "./Piano";
import "./Piano.css";
import "./Waterfall.css";

// Composition root for the waterfall + piano surface. Owns the shared
// keyboard layout so both the 3D bars and the 2D SVG keys use
// identical x-coordinates.
export function Waterfall(): ReactElement {
  const playfieldRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pianoHostRef = useRef<HTMLDivElement | null>(null);

  const pianoSize = useElementSize(pianoHostRef);
  const layout = useKeyboardLayout({ width: pianoSize?.width });

  const {
    heldMidiPitches,
    latestNotePlayed,
    score,
    serverElapsedMs,
    serverPaused,
    serverPlaybackSpeed,
    serverPlaying,
    sessionRestartGeneration,
  } = usePlayback();

  useWaterfall({
    canvasRef,
    laneGeometry: layout,
    latestNotePlayed,
    score,
    serverElapsedMs,
    serverPaused,
    serverPlaybackSpeed,
    serverPlaying,
    sessionRestartGeneration,
    heldMidiPitches,
  });

  return (
    <div className="playfield" ref={playfieldRef}>
      <canvas className="waterfall-canvas" ref={canvasRef} />
      <div className="piano-host" ref={pianoHostRef}>
        <Piano
          height={pianoSize?.height}
          latestNotePlayed={latestNotePlayed}
          layout={layout}
        />
      </div>
    </div>
  );
}
