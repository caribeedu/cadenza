import type { ReactElement } from "react";

import { usePlayback } from "@app/providers/PlaybackProvider";
import { useWebSocket } from "@app/providers/WebSocketProvider";
import { MidiDeviceSelector } from "@features/midi/components/MidiDeviceSelector";
import { ToleranceSlider } from "@features/score-config/components/ToleranceSlider";
import { BackendUrlInput } from "@features/websocket/components/BackendUrlInput";
import { type ChipState, StatusChip } from "@shared/components/StatusChip";
import "@features/score-config/components/score-config.css";

import "./TopBar.css";

interface ScoreChipArgs {
  scoreLoaded: boolean;
  serverPaused: boolean;
  serverPlaying: boolean;
}

function scoreChipState({
  scoreLoaded,
  serverPaused,
  serverPlaying,
}: ScoreChipArgs): { label: string; state: ChipState } {
  if (!scoreLoaded) return { label: "Score: waiting", state: "off" };
  if (serverPaused) return { label: "Score: paused", state: "on" };
  if (serverPlaying) return { label: "Score: playing", state: "on" };
  return { label: "Score: ready", state: "on" };
}

export function TopBar(): ReactElement {
  const { status: wsStatus } = useWebSocket();
  const {
    midiOpen,
    midiPort,
    scoreLoaded,
    serverPaused,
    serverPlaying,
    start,
    togglePause,
  } = usePlayback();

  const wsLabel =
    wsStatus === "open"
      ? "WS: connected"
      : wsStatus === "error"
        ? "WS: error"
        : "WS: disconnected";
  const wsChipState: ChipState =
    wsStatus === "open" ? "on" : wsStatus === "error" ? "err" : "off";

  const midiLabel = midiOpen ? `MIDI: ${midiPort}` : "MIDI: none";
  const midiState: ChipState = midiOpen ? "on" : "off";

  const scoreChip = scoreChipState({
    scoreLoaded,
    serverPaused,
    serverPlaying,
  });

  const pauseDisabled = !serverPlaying && !serverPaused;
  const pauseLabel = serverPaused ? "Resume" : "Pause";

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">♪</span>
        <span className="name">Cadenza</span>
      </div>
      <div className="controls">
        <BackendUrlInput />
        <MidiDeviceSelector />
        <button className="primary" onClick={start} type="button">
          Start
        </button>
        <button disabled={pauseDisabled} onClick={togglePause} type="button">
          {pauseLabel}
        </button>
        <ToleranceSlider />
      </div>
      <div className="status">
        <StatusChip label={wsLabel} state={wsChipState} />
        <StatusChip label={midiLabel} state={midiState} />
        <StatusChip label={scoreChip.label} state={scoreChip.state} />
      </div>
    </header>
  );
}
