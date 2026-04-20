import type {
  MidiPortsMessage,
  NotePlayedMessage,
  ScoreTimelineMessage,
  StatusMessage,
} from "@shared/types/messages";
import type { NotePlayed, ScoreTimeline } from "@shared/types/score";

import {
  MSG_HELLO,
  MSG_LIST_MIDI,
  MSG_PAUSE,
  MSG_RESUME,
  MSG_SELECT_MIDI,
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

interface PlaybackState {
  latestNotePlayed: NotePlayed | null;
  midiOpen: boolean;
  midiPort: null | string;
  midiPorts: string[];
  score: null | ScoreTimeline;
  scoreLoaded: boolean;
  serverPaused: boolean;
  serverPlaying: boolean;
}

type PlaybackAction =
  | { payload: MidiPortsMessage; type: "midi_ports" }
  | { payload: NotePlayed; type: "note_played" }
  | { payload: ScoreTimeline; type: "score_timeline" }
  | { payload: StatusMessage; type: "status" };

export interface PlaybackContextValue extends PlaybackState {
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
  latestNotePlayed: null,
  midiOpen: false,
  midiPort: null,
  midiPorts: [],
  score: null,
  scoreLoaded: false,
  serverPaused: false,
  serverPlaying: false,
};

function reducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "midi_ports":
      return { ...state, midiPorts: action.payload.ports ?? [] };
    case "note_played":
      return { ...state, latestNotePlayed: action.payload };
    case "score_timeline":
      return { ...state, score: action.payload };
    case "status":
      return {
        ...state,
        midiOpen: !!action.payload.midi_open,
        midiPort: action.payload.midi_open ? action.payload.midi_port : null,
        scoreLoaded: !!action.payload.score_loaded,
        serverPaused: !!action.payload.paused,
        serverPlaying: !!action.payload.playing,
      };
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
  const { setToleranceMs, toleranceMs } = useScoreConfig();

  // Track the tolerance value the server last confirmed so we don't
  // bounce the user's slider back on their own echoed status frame.
  const serverToleranceRef = useRef<null | number>(null);
  // Mirror toleranceMs so handlers that fire outside render (message
  // subscribers) can read the current value without re-subscribing.
  const toleranceRef = useRef(toleranceMs);
  useEffect(() => {
    toleranceRef.current = toleranceMs;
  }, [toleranceMs]);

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
      unsubError();
      unsubNote();
    };
  }, [subscribe, log, setToleranceMs]);

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

  const start = useCallback(() => {
    send({ type: MSG_START });
    log("Playback started", "ok");
  }, [send, log]);

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
