import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appendEventLog, type EventLogEntry } from "../lib/event-log";
import { addHeldPitch, removeHeldPitch } from "../lib/held-pitches";
import type { FingeringProgress } from "../lib/fingering-ui";
import { applyPianoThemeVars } from "../lib/piano-theme";
import type { NotePlayed as WaterfallNotePlayed } from "../lib/waterfall/renderer";
import {
  WATERFALL_THEME_IDS,
  type WaterfallThemeId,
} from "../lib/waterfall/theme";
import type { NotePlayed } from "../components/Piano";
import type { WaterfallNote } from "../components/Waterfall";

export type AppStatus = {
  hasScore: boolean;
  noteCount: number;
  durationMs: number;
  midiSelected: string | null;
  playing: boolean;
  paused: boolean;
  positionMs: number;
  speed: number;
  toleranceMs: number;
};

export type Timeline = {
  bpm: number;
  title?: string;
  composer?: string;
  duration_ms: number;
  notes: WaterfallNote[];
};

type ValidationResult = {
  correct: boolean;
  playedPitch: number;
  playedTimeMs: number;
  expectedId: number | null;
  expectedPitch: number | null;
  expectedTimeMs: number | null;
  deltaMs: number | null;
};

type AppError = {
  code: string;
  message: string;
  recoverable: boolean;
};

const THEME_STORAGE_KEY = "cadenza-waterfall-theme";

function readStoredTheme(): WaterfallThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === WATERFALL_THEME_IDS.LavaStage || raw === WATERFALL_THEME_IDS.AuroraIce) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return WATERFALL_THEME_IDS.LavaStage;
}

export function createAppStore() {
  const [status, setStatus] = createSignal<AppStatus | null>(null);
  const [timeline, setTimeline] = createSignal<Timeline | null>(null);
  const [midiPorts, setMidiPorts] = createSignal<string[]>([]);
  const [selectedMidi, setSelectedMidi] = createSignal("");
  const [latestNote, setLatestNote] = createSignal<NotePlayed | null>(null);
  const [waterfallNote, setWaterfallNote] = createSignal<WaterfallNotePlayed | null>(null);
  const [sessionRestartGeneration, setSessionRestartGeneration] = createSignal(0);
  const [seekGeneration, setSeekGeneration] = createSignal(0);
  const [heldMidiPitches, setHeldMidiPitches] = createSignal<number[]>([]);
  const [fingeringProgress, setFingeringProgress] = createSignal<FingeringProgress | null>(null);
  const [pluginMessage, setPluginMessage] = createSignal("");
  const [pluginStatus, setPluginStatus] = createSignal<{
    dest: string;
    installed: boolean;
    upToDate: boolean;
  } | null>(null);
  const [waterfallThemeId, setWaterfallThemeId] = createSignal<WaterfallThemeId>(readStoredTheme());
  const [eventLog, setEventLog] = createSignal<EventLogEntry[]>([]);
  const [bannerError, setBannerError] = createSignal<string | null>(null);
  const [scoreJustLoaded, setScoreJustLoaded] = createSignal(false);

  const hasScore = createMemo(() => {
    const t = timeline();
    return !!t && t.notes.length > 0 && t.duration_ms > 0;
  });

  function log(kind: EventLogEntry["kind"], text: string) {
    setEventLog((prev) => appendEventLog(prev, kind, text));
  }

  function setTheme(id: WaterfallThemeId) {
    setWaterfallThemeId(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  createEffect(() => {
    applyPianoThemeVars(waterfallThemeId());
  });

  async function refreshStatus() {
    const s = await invoke<AppStatus>("get_status");
    setStatus(s);
    if (s.midiSelected != null) {
      setSelectedMidi(s.midiSelected);
    }
  }

  async function loadTimeline() {
    setTimeline((await invoke<Timeline | null>("get_timeline")) ?? null);
  }

  function applyValidation(v: ValidationResult) {
    const note: WaterfallNotePlayed = {
      correct: v.correct,
      played_pitch: v.playedPitch,
      delta_ms: v.deltaMs,
      expected_id: v.expectedId,
      expected_pitch: v.expectedPitch,
      expected_time_ms: v.expectedTimeMs ?? undefined,
    };
    setLatestNote({ played_pitch: v.playedPitch, correct: v.correct });
    setWaterfallNote(note);
    setHeldMidiPitches((prev) => addHeldPitch(prev, v.playedPitch));
    log(
      "validation",
      v.correct
        ? `Correct · pitch ${v.playedPitch}${v.deltaMs != null ? ` (${Math.round(v.deltaMs)} ms)` : ""}`
        : `Wrong · played ${v.playedPitch}, expected ${v.expectedPitch ?? "?"}`,
    );
  }

  function clearHeldPitches() {
    setHeldMidiPitches([]);
  }

  async function stop() {
    await invoke("stop");
    clearHeldPitches();
    setSeekGeneration(0);
    log("playback", "Stopped");
    await refreshStatus();
  }

  async function play() {
    const wasPlaying = status()?.playing && !status()?.paused;
    await invoke("play");
    if (wasPlaying) {
      setSessionRestartGeneration((g) => g + 1);
      clearHeldPitches();
    }
    log("playback", "Playing");
    await refreshStatus();
  }

  async function pause() {
    await invoke("pause");
    log("playback", "Paused");
    await refreshStatus();
  }

  async function resume() {
    await invoke("resume");
    log("playback", "Resumed");
    await refreshStatus();
  }

  async function seek(ms: number) {
    clearHeldPitches();
    await invoke("seek", { positionMs: ms });
    await refreshStatus();
    setSeekGeneration((g) => g + 1);
  }

  async function setSpeed(speed: number) {
    await invoke("set_speed", { speed });
    await refreshStatus();
  }

  async function setTolerance(toleranceMs: number) {
    await invoke("set_tolerance", { toleranceMs });
    await refreshStatus();
  }

  async function refreshMidiPorts() {
    setMidiPorts(await invoke<string[]>("list_midi_ports"));
  }

  async function selectMidi(port: string) {
    setSelectedMidi(port);
    if (!port) return;
    await invoke("select_midi", { port });
    log("midi", `Selected ${port}`);
  }

  async function refreshPluginStatus() {
    try {
      const status = await invoke<{ dest: string; installed: boolean; upToDate: boolean }>(
        "check_musescore_plugin",
      );
      setPluginStatus(status);
    } catch {
      setPluginStatus(null);
    }
  }

  async function installPlugin() {
    const r = await invoke<{ dest: string; alreadyInstalled: boolean }>("install_musescore_plugin");
    setPluginMessage(
      r.alreadyInstalled
        ? `Plugin already up to date at ${r.dest}`
        : `Installed to ${r.dest}`,
    );
    log("info", r.alreadyInstalled ? "Plugin up to date" : "Plugin installed");
    await refreshPluginStatus();
    return r;
  }

  onMount(async () => {
    log("info", "Cadenza ready — waiting for score from MuseScore");
    await refreshStatus();
    await loadTimeline();
    await refreshMidiPorts();
    await refreshPluginStatus();

    await listen<Timeline>("score_loaded", async (e) => {
      clearHeldPitches();
      setSeekGeneration(0);
      setFingeringProgress(null);
      setBannerError(null);
      await loadTimeline();
      await refreshStatus();
      const t = e.payload;
      const label = [t.title, t.composer].filter(Boolean).join(" — ") || "Untitled score";
      log("score", `Loaded ${label} (${t.notes.length} notes)`);
      setScoreJustLoaded(true);
      window.setTimeout(() => setScoreJustLoaded(false), 1200);
    });
    await listen<FingeringProgress>("fingering_progress", (e) => {
      setFingeringProgress(e.payload);
      if (e.payload.done >= e.payload.total && e.payload.total > 0) {
        window.setTimeout(() => setFingeringProgress(null), 600);
      }
    });
    await listen("playback_changed", refreshStatus);
    await listen<ValidationResult>("validation_result", (e) => applyValidation(e.payload));
    await listen<{ pitch: number; velocity: number }>("midi_note", (e) => {
      setLatestNote({ played_pitch: e.payload.pitch, correct: null });
      setHeldMidiPitches((prev) => addHeldPitch(prev, e.payload.pitch));
    });
    await listen<{ pitch: number }>("midi_note_off", (e) => {
      setHeldMidiPitches((prev) => removeHeldPitch(prev, e.payload.pitch));
    });
    await listen<{ ports: string[]; selected: string | null }>("midi_ports_changed", (e) => {
      setMidiPorts(e.payload.ports);
      setSelectedMidi(e.payload.selected ?? "");
      if (e.payload.selected) {
        log("midi", `MIDI: ${e.payload.selected}`);
      }
    });
    await listen<AppError>("app_error", (e) => {
      const { code, message } = e.payload;
      log("error", `${code}: ${message}`);
      setBannerError(message);
    });
  });

  return {
    status,
    timeline,
    midiPorts,
    selectedMidi,
    latestNote,
    waterfallNote,
    sessionRestartGeneration,
    seekGeneration,
    heldMidiPitches,
    fingeringProgress,
    pluginMessage,
    setPluginMessage,
    pluginStatus,
    refreshPluginStatus,
    waterfallThemeId,
    setTheme,
    eventLog,
    bannerError,
    setBannerError,
    hasScore,
    scoreJustLoaded,
    log,
    refreshStatus,
    stop,
    play,
    pause,
    resume,
    seek,
    setSpeed,
    setTolerance,
    refreshMidiPorts,
    selectMidi,
    installPlugin,
  };
}

export type AppStore = ReturnType<typeof createAppStore>;
