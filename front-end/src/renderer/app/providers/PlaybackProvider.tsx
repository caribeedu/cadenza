import type {
  MidiPortsMessage,
  NotePlayedMessage,
  ScoreTimelineMessage,
  StatusMessage,
} from "@shared/types/messages";
import type { NotePlayed } from "@shared/types/score";

import {
  MSG_FINGERING_PROGRESS,
  MSG_HELLO,
  MSG_LIST_MIDI,
  MSG_PAUSE,
  MSG_RESUME,
  MSG_SEEK,
  MSG_SELECT_MIDI,
  MSG_SET_PLAYBACK_SPEED,
  MSG_SET_TOLERANCE,
  MSG_START,
  type DecodedMessage,
} from "@shared/lib/protocol";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  type FingeringProgressState,
  type PlaybackState,
  initialPlaybackState,
  playbackReducer,
} from "../state/playback-reducer";
import { useEventLog } from "./EventLogProvider";
import { useScoreConfig } from "./ScoreConfigProvider";
import { useWebSocket } from "./WebSocketProvider";

export type { FingeringProgressState };

export interface PlaybackContextValue extends PlaybackState {
  commitPlaybackSpeed: (factor: number) => void;
  commitTolerance: (valueMs: number) => void;
  pause: () => void;
  refreshMidi: () => void;
  resume: () => void;
  seekTo: (virtualMs: number) => void;
  selectMidi: (port: string) => void;
  start: () => void;
  togglePause: () => void;
}

const PlaybackContext = createContext<null | PlaybackContextValue>(null);

// Maps backend reason codes (see server.unvalidated_reason) to short
// actionable English for the diagnostic log. Kept in sync with the
// Python side by construction — if a code is missing the raw reason
// flows through.
const UNVALIDATED_REASON_HINTS: Record<string, string> = {
  no_score: "load a score from MuseScore first",
  not_started: "press Start to begin scoring",
  paused: "session is paused — press Resume",
};

export function PlaybackProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [state, dispatch] = useReducer(playbackReducer, initialPlaybackState);
  const {
    send,
    status: wsStatus,
    subscribe,
    subscribeDropped,
  } = useWebSocket();
  const { log } = useEventLog();
  const {
    playbackSpeed,
    setPlaybackSpeed,
    setToleranceMs,
    toleranceMs,
  } = useScoreConfig();

  // Track the tolerance value the server last confirmed so we don't
  // bounce the user's slider back on their own echoed status frame.
  const serverToleranceRef = useRef<null | number>(null);
  // Same pattern for playback speed — the server echoes via status.
  const serverPlaybackSpeedRef = useRef<null | number>(null);
  // Mirror toleranceMs so handlers that fire outside render (message
  // subscribers) can read the current value without re-subscribing.
  const toleranceRef = useRef(toleranceMs);
  useEffect(() => {
    toleranceRef.current = toleranceMs;
  }, [toleranceMs]);
  const playbackSpeedRef = useRef(playbackSpeed);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const lastUnvalidatedReasonRef = useRef<null | string>(null);

  useEffect(() => {
    const unsubStatus = subscribe("status", (msg) => {
      const status = msg as unknown as StatusMessage;
      dispatch({ payload: status, type: "status" });
      if (typeof status.tolerance_ms === "number") {
        serverToleranceRef.current = status.tolerance_ms;
        if (Math.abs(toleranceRef.current - status.tolerance_ms) >= 1) {
          setToleranceMs(status.tolerance_ms);
        }
      }
      if (typeof status.playback_speed === "number") {
        serverPlaybackSpeedRef.current = status.playback_speed;
        // Same 1-step-of-slider dead band as tolerance so an echo
        // doesn't reset the user's in-flight drag.
        if (
          Math.abs(playbackSpeedRef.current - status.playback_speed) >= 0.01
        ) {
          setPlaybackSpeed(status.playback_speed);
        }
      }
    });
    const unsubPorts = subscribe("midi_ports", (msg) =>
      dispatch({
        payload: msg as unknown as MidiPortsMessage,
        type: "midi_ports",
      }),
    );
    const unsubTimeline = subscribe("score_timeline", (msg) => {
      const timeline = msg as unknown as ScoreTimelineMessage;
      dispatch({ payload: timeline, type: "score_timeline" });
      log(
        `Score received: ${timeline.notes.length} notes @ ${timeline.bpm} BPM`,
        "ok",
      );
    });
    const unsubFingering = subscribe(MSG_FINGERING_PROGRESS, (msg) => {
      const raw = msg as Record<string, unknown>;
      const done = raw.done;
      const total = raw.total;
      const hand = raw.hand;
      if (
        typeof done !== "number" ||
        typeof total !== "number" ||
        (hand !== "left" && hand !== "right")
      ) {
        return;
      }
      dispatch({
        payload: { done, hand, total },
        type: "fingering_progress",
      });
    });
    const unsubError = subscribe("error", (msg) => {
      log(`Server error: ${String(msg.error ?? "")}`, "err");
    });
    const unsubNote = subscribe("note_played", (msg) => {
      const played = msg as unknown as NotePlayedMessage;
      dispatch({ payload: played, type: "note_played" });
      logNotePlayed(played, log, lastUnvalidatedReasonRef);
    });
    const onNoteOff = (msg: DecodedMessage) => {
      const raw = (msg as { pitch?: unknown }).pitch;
      const n =
        typeof raw === "number" && Number.isFinite(raw)
          ? Math.round(raw)
          : typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))
            ? Math.round(Number(raw))
            : null;
      if (n != null) {
        dispatch({ payload: n, type: "note_off" });
      }
    };
    // ``note_off`` (current server); keep ``note_released`` for older hub builds.
    const unsubNoteOff1 = subscribe("note_off", onNoteOff);
    const unsubNoteOff2 = subscribe("note_released", onNoteOff);
    return () => {
      unsubStatus();
      unsubPorts();
      unsubTimeline();
      unsubFingering();
      unsubError();
      unsubNote();
      unsubNoteOff1();
      unsubNoteOff2();
    };
  }, [subscribe, log, setToleranceMs, setPlaybackSpeed]);

  // Log WebSocket lifecycle events once per transition so users see
  // the connection state changing without needing DevTools. The
  // ``wsStatus`` enum comes from WebSocketProvider.
  useEffect(() => {
    if (wsStatus === "open") {
      log("WebSocket connected", "ok");
      send({ role: "frontend", type: MSG_HELLO });
      send({ type: MSG_LIST_MIDI });
    } else if (wsStatus === "closed" || wsStatus === "error") {
      if (wsStatus === "closed") {
        log("WebSocket closed (will reconnect)", "dim");
      } else {
        log("WebSocket error", "err");
      }
      dispatch({ type: "connection_lost" });
    }
  }, [wsStatus, log, send]);

  useEffect(() => {
    if (!subscribeDropped) return undefined;
    return subscribeDropped((payload) => {
      const type =
        (payload as null | undefined | { type?: string })?.type ?? "<unknown>";
      log(`Dropped ${type}: send queue full while WebSocket is down`, "err");
    });
  }, [subscribeDropped, log]);

  // Push the tolerance downstream when the user commits a change.
  // Guarded so we don't echo our own incoming status frame.
  const commitTolerance = useCallback(
    (valueMs: number) => {
      const clamped = Number(valueMs);
      if (serverToleranceRef.current === clamped) return;
      send({ tolerance_ms: clamped, type: MSG_SET_TOLERANCE });
      log(`Tolerance → ${clamped} ms`, "dim");
    },
    [send, log],
  );

  const commitPlaybackSpeed = useCallback(
    (factor: number) => {
      const numeric = Number(factor);
      if (!Number.isFinite(numeric) || numeric <= 0) return;
      if (serverPlaybackSpeedRef.current === numeric) return;
      send({ playback_speed: numeric, type: MSG_SET_PLAYBACK_SPEED });
      log(`Playback speed → ${numeric.toFixed(2)}×`, "dim");
    },
    [send, log],
  );

  const start = useCallback(() => {
    send({ type: MSG_START });
    dispatch({ type: "session_restart" });
    log(
      state.serverPlaying || state.serverPaused
        ? "Restarted from beginning"
        : "Playback started",
      "ok",
    );
  }, [send, log, state.serverPlaying, state.serverPaused, dispatch]);

  const pause = useCallback(() => {
    send({ type: MSG_PAUSE });
    log("Playback paused", "dim");
  }, [send, log]);

  const resume = useCallback(() => {
    send({ type: MSG_RESUME });
    log("Playback resumed", "ok");
  }, [send, log]);

  const seekTo = useCallback(
    (virtualMs: number) => {
      const ms = Math.max(0, Math.round(virtualMs));
      if (state.serverPlaying) {
        send({ type: MSG_PAUSE });
      }
      send({ elapsed_ms: ms, type: MSG_SEEK });
      log(`Seek → ${ms} ms${state.serverPlaying ? " (paused)" : ""}`, "dim");
    },
    [send, log, state.serverPlaying],
  );

  const togglePause = useCallback(() => {
    if (state.serverPaused) resume();
    else if (state.serverPlaying) pause();
  }, [state.serverPaused, state.serverPlaying, pause, resume]);

  const refreshMidi = useCallback(() => {
    send({ type: MSG_LIST_MIDI });
  }, [send]);

  const selectMidi = useCallback(
    (port: string) => {
      if (!port) {
        log("Select a MIDI device first", "err");
        return;
      }
      send({ port, type: MSG_SELECT_MIDI });
    },
    [send, log],
  );

  const value = useMemo<PlaybackContextValue>(
    () => ({
      ...state,
      commitPlaybackSpeed,
      commitTolerance,
      pause,
      refreshMidi,
      resume,
      seekTo,
      selectMidi,
      start,
      togglePause,
    }),
    [
      state,
      start,
      pause,
      resume,
      togglePause,
      refreshMidi,
      selectMidi,
      seekTo,
      commitTolerance,
      commitPlaybackSpeed,
    ],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used inside <PlaybackProvider>");
  return ctx;
}

function logNotePlayed(
  msg: NotePlayed,
  log: (message: string, kind?: string) => void,
  lastUnvalidatedReasonRef: { current: null | string },
): void {
  const outcome =
    msg.correct === true ? "OK" : msg.correct === false ? "miss" : "raw";
  const cssKind =
    msg.correct === true ? "ok" : msg.correct === false ? "err" : "dim";
  const deltaText =
    typeof msg.delta_ms === "number" ? `${msg.delta_ms.toFixed(0)}ms` : "—";
  log(`note_on ${msg.played_pitch} ${outcome} Δ=${deltaText}`, cssKind);

  if (msg.correct === null && msg.reason) {
    if (msg.reason !== lastUnvalidatedReasonRef.current) {
      const hint = UNVALIDATED_REASON_HINTS[msg.reason] ?? msg.reason;
      log(`Validation skipped: ${hint}`, "dim");
      lastUnvalidatedReasonRef.current = msg.reason;
    }
  } else if (msg.correct !== null) {
    lastUnvalidatedReasonRef.current = null;
  }
}
