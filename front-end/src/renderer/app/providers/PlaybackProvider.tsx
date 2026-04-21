import type {
  MidiPortsMessage,
  NotePlayedMessage,
  ScoreTimelineMessage,
  StatusMessage,
} from "@shared/types/messages";
import type { NotePlayed, ScoreTimeline } from "@shared/types/score";

import {
  MSG_FINGERING_PROGRESS,
  MSG_HELLO,
  MSG_LIST_MIDI,
  MSG_PAUSE,
  MSG_RESUME,
  MSG_SELECT_MIDI,
  MSG_SET_PLAYBACK_SPEED,
  MSG_SET_TOLERANCE,
  MSG_START,
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

import { useEventLog } from "./EventLogProvider";
import { useScoreConfig } from "./ScoreConfigProvider";
import { useWebSocket } from "./WebSocketProvider";

export interface FingeringProgressState {
  done: number;
  hand: "left" | "right";
  total: number;
}

interface PlaybackState {
  fingeringProgress: null | FingeringProgressState;
  latestNotePlayed: NotePlayed | null;
  midiOpen: boolean;
  midiPort: null | string;
  midiPorts: string[];
  score: null | ScoreTimeline;
  scoreLoaded: boolean;
  // Server-authoritative playhead in virtual (score) milliseconds.
  // ``null`` while no session is running; consumed by the renderer to
  // realign its local clock on speed changes or reconnects. Must be
  // null-checked rather than 0-checked because 0 is the legitimate
  // "just started" value.
  serverElapsedMs: null | number;
  serverPaused: boolean;
  // Server-confirmed playback speed. Distinct from the UI slider
  // value so a drag can update the label without driving the renderer
  // into a drifted state.
  serverPlaybackSpeed: number;
  serverPlaying: boolean;
  /** Increments on every ``start()`` so the waterfall can reset even when
   *  ``serverPlaying`` stays true (restart mid-play). */
  sessionRestartGeneration: number;
}

type PlaybackAction =
  | { payload: FingeringProgressState; type: "fingering_progress" }
  | { payload: MidiPortsMessage; type: "midi_ports" }
  | { payload: NotePlayed; type: "note_played" }
  | { payload: ScoreTimeline; type: "score_timeline" }
  | { payload: StatusMessage; type: "status" }
  | { type: "session_restart" };

export interface PlaybackContextValue extends PlaybackState {
  commitPlaybackSpeed: (factor: number) => void;
  commitTolerance: (valueMs: number) => void;
  pause: () => void;
  refreshMidi: () => void;
  resume: () => void;
  selectMidi: (port: string) => void;
  start: () => void;
  togglePause: () => void;
}

const PlaybackContext = createContext<null | PlaybackContextValue>(null);

const initialState: PlaybackState = {
  fingeringProgress: null,
  latestNotePlayed: null,
  midiOpen: false,
  midiPort: null,
  midiPorts: [],
  score: null,
  scoreLoaded: false,
  serverElapsedMs: null,
  serverPaused: false,
  serverPlaybackSpeed: 1.0,
  serverPlaying: false,
  sessionRestartGeneration: 0,
};

function reducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "fingering_progress":
      return { ...state, fingeringProgress: action.payload };
    case "midi_ports":
      return { ...state, midiPorts: action.payload.ports ?? [] };
    case "note_played":
      return { ...state, latestNotePlayed: action.payload };
    case "score_timeline":
      return {
        ...state,
        fingeringProgress: null,
        score: action.payload,
      };
    case "session_restart":
      return {
        ...state,
        sessionRestartGeneration: state.sessionRestartGeneration + 1,
      };
    case "status": {
      const { payload } = action;
      const serverReportsScore = !!payload.score_loaded;
      return {
        ...state,
        midiOpen: !!payload.midi_open,
        midiPort: payload.midi_open ? payload.midi_port : null,
        // Drop stale timeline when the hub no longer holds a score
        // (keeps session chip / Start in sync with server truth).
        score: serverReportsScore ? state.score : null,
        fingeringProgress: serverReportsScore ? state.fingeringProgress : null,
        scoreLoaded: serverReportsScore,
        // ``elapsed_ms`` is only meaningful while a session is active.
        // We keep it null otherwise so the renderer's sync effect can
        // tell "no server state yet" from "server says t=0".
        serverElapsedMs:
          typeof payload.elapsed_ms === "number" &&
          (payload.playing || payload.paused)
            ? payload.elapsed_ms
            : null,
        serverPaused: !!payload.paused,
        serverPlaybackSpeed:
          typeof payload.playback_speed === "number"
            ? payload.playback_speed
            : state.serverPlaybackSpeed,
        serverPlaying: !!payload.playing,
      };
    }
    default:
      return state;
  }
}

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
  const [state, dispatch] = useReducer(reducer, initialState);
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
    return () => {
      unsubStatus();
      unsubPorts();
      unsubTimeline();
      unsubFingering();
      unsubError();
      unsubNote();
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
    } else if (wsStatus === "closed") {
      log("WebSocket closed (will reconnect)", "dim");
    } else if (wsStatus === "error") {
      log("WebSocket error", "err");
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
