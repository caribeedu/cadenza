import type { ReactElement } from "react";

import { usePlayback } from "@app/providers/PlaybackProvider";
import { useWebSocket } from "@app/providers/WebSocketProvider";
import { formatFingeringProgressLabel } from "@shared/lib/fingering-ui";
import { MidiDeviceSelector } from "@features/midi/components/MidiDeviceSelector";
import { PlaybackSpeedSlider } from "@features/score-config/components/PlaybackSpeedSlider";
import { ToleranceSlider } from "@features/score-config/components/ToleranceSlider";
import { BackendUrlInput } from "@features/websocket/components/BackendUrlInput";
import { type ChipState, StatusChip } from "@shared/components/StatusChip";
import "@features/score-config/components/score-config.css";

import { usePlaybackTransportHotkeys } from "../hooks/usePlaybackTransportHotkeys";
import { ScoreInfoChip } from "./ScoreInfoChip";
import "./TopBar.css";

interface ScoreChipArgs {
  fingeringProgress: null | {
    done: number;
    hand: "left" | "right";
    total: number;
  };
  hasPlayableScore: boolean;
  serverPaused: boolean;
  serverPlaying: boolean;
}

function scoreChipState({
  fingeringProgress,
  hasPlayableScore,
  serverPaused,
  serverPlaying,
}: ScoreChipArgs): { label: string; state: ChipState } {
  if (fingeringProgress) {
    return {
      label: formatFingeringProgressLabel(fingeringProgress),
      state: "on",
    };
  }
  if (!hasPlayableScore) return { label: "No score", state: "off" };
  if (serverPaused) return { label: "Paused", state: "on" };
  if (serverPlaying) return { label: "Playing", state: "on" };
  return { label: "Ready", state: "on" };
}

export function TopBar(): ReactElement {
  usePlaybackTransportHotkeys();

  const { status: wsStatus } = useWebSocket();
  const {
    fingeringProgress,
    midiOpen,
    midiPort,
    score,
    serverPaused,
    serverPlaying,
    start,
    togglePause,
  } = usePlayback();

  // Server ``score_loaded`` can be true while the client has not yet
  // received ``score_timeline``, or after a hub restart with stale
  // flags — never enable transport until we have real note data.
  const hasPlayableScore = (score?.notes?.length ?? 0) > 0;

  const sessionActive = serverPlaying || serverPaused;
  const startDisabled = !hasPlayableScore;
  const pauseDisabled = !sessionActive;

  const wsLabel =
    wsStatus === "open"
      ? "WS"
      : wsStatus === "error"
        ? "WS!"
        : "WS…";
  const wsChipState: ChipState =
    wsStatus === "open" ? "on" : wsStatus === "error" ? "err" : "off";

  const midiLabel = midiOpen ? midiPort ?? "MIDI" : "No MIDI";
  const midiState: ChipState = midiOpen ? "on" : "off";

  const scoreChip = scoreChipState({
    fingeringProgress,
    hasPlayableScore,
    serverPaused,
    serverPlaying,
  });

  const startLabel = sessionActive ? "Restart" : "Start";
  const startTitle = sessionActive
    ? "Restart Cadenza session and timeline (keyboard: R). MuseScore audio is not controlled here."
    : "Start the session (keyboard: R)";
  const pauseLabel = serverPaused ? "Resume" : "Pause";
  const pauseTitle = serverPaused
    ? "Resume (keyboard: Enter)"
    : "Pause (keyboard: Enter)";

  return (
    <header className="topbar">
      <div className="topbar__brand" title="Cadenza practice client">
        <span aria-hidden className="topbar__logo">
          ♪
        </span>
        <span className="topbar__name">Cadenza</span>
      </div>

      <div aria-label="Transport" className="topbar__transport" role="group">
        <button
          className="topbar__btn topbar__btn--accent"
          disabled={startDisabled}
          onClick={start}
          title={startTitle}
          type="button"
        >
          {startLabel}
        </button>
        <kbd className="topbar__kbd" title="Restart / Start">
          R
        </kbd>
        <button
          className="topbar__btn"
          disabled={pauseDisabled}
          onClick={togglePause}
          title={pauseTitle}
          type="button"
        >
          {pauseLabel}
        </button>
        <kbd className="topbar__kbd" title="Pause / Resume">
          Enter
        </kbd>
      </div>

      <div
        aria-label="Practice settings"
        className="topbar__practice"
        role="group"
      >
        <ToleranceSlider />
        <PlaybackSpeedSlider />
      </div>

      <details className="topbar__setup">
        <summary className="topbar__setup-summary">Setup</summary>
        <div className="topbar__setup-body">
          <BackendUrlInput />
          <MidiDeviceSelector />
        </div>
      </details>

      <div aria-label="Status" className="topbar__status" role="group">
        <StatusChip label={wsLabel} state={wsChipState} title="WebSocket" />
        <StatusChip label={midiLabel} state={midiState} title="MIDI input" />
        <StatusChip
          label={scoreChip.label}
          state={scoreChip.state}
          title={
            fingeringProgress
              ? formatFingeringProgressLabel(fingeringProgress)
              : "Session"
          }
        />
        <ScoreInfoChip />
      </div>
    </header>
  );
}
