import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EventLog } from "./components/EventLog";
import { Piano, type NotePlayed } from "./components/Piano";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { Waterfall, type WaterfallNote } from "./components/Waterfall";
import type { NotePlayed as WaterfallNotePlayed } from "./lib/waterfall/renderer";
import { appendEventLog, type EventLogEntry } from "./lib/event-log";
import { computeKeyboardLayout } from "./lib/piano-layout";
import { applyPianoThemeVars } from "./lib/piano-theme";
import { addHeldPitch, removeHeldPitch } from "./lib/held-pitches";
import { formatFingeringProgressLabel, type FingeringProgress } from "./lib/fingering-ui";
import { useElementWidth } from "./hooks/useElementWidth";
import { HIGHEST_MIDI, LOWEST_MIDI } from "./lib/timeline";
import {
  WATERFALL_THEME_IDS,
  WATERFALL_THEME_LABELS,
  type WaterfallThemeId,
} from "./lib/waterfall/theme";
import "./App.css";
import "./components/Piano.css";
import "./components/Waterfall.css";

type AppStatus = {
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

type Timeline = {
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

function App() {
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
  const { ref: pianoHostRef, width: pianoWidth } = useElementWidth();
  const [waterfallThemeId, setWaterfallThemeId] = createSignal<WaterfallThemeId>(readStoredTheme());
  const [eventLog, setEventLog] = createSignal<EventLogEntry[]>([]);
  const [bannerError, setBannerError] = createSignal<string | null>(null);

  const layout = createMemo(() => {
    const w = pianoWidth();
    if (w <= 0) return null;
    try {
      return computeKeyboardLayout({
        low: LOWEST_MIDI,
        high: HIGHEST_MIDI,
        totalWidthPx: w,
      });
    } catch {
      return null;
    }
  });

  const waterfallReady = createMemo(() => {
    const score = timeline();
    const laneGeometry = layout();
    if (!score || !laneGeometry) return null;
    return { score, laneGeometry };
  });

  const idleHint = createMemo(() => {
    const s = status();
    if (!s?.hasScore) {
      return "Open MuseScore, run Plugins → Cadenza Sender, then select your MIDI device.";
    }
    if (!s.midiSelected) {
      return "Score loaded — select a MIDI device below to validate live input.";
    }
    return null;
  });

  function log(kind: EventLogEntry["kind"], text: string) {
    setEventLog((prev) => appendEventLog(prev, kind, text));
  }

  createEffect(() => {
    applyPianoThemeVars(waterfallThemeId());
  });

  async function refreshStatus() {
    setStatus(await invoke<AppStatus>("get_status"));
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

  async function seek(ms: number) {
    clearHeldPitches();
    await invoke("seek", { positionMs: ms });
    await refreshStatus();
    setSeekGeneration((g) => g + 1);
  }

  onMount(async () => {
    log("info", "Cadenza ready — waiting for score from MuseScore");
    await refreshStatus();
    await loadTimeline();
    const ports = await invoke<string[]>("list_midi_ports");
    setMidiPorts(ports);

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

  const scrubberEnabled = () => {
    const t = timeline();
    return !!t && t.duration_ms > 0 && t.notes.length > 0;
  };

  return (
    <main class="container">
      <header class="header">
        <h1>Cadenza</h1>
        <Show when={timeline()}>
          {(t) => (
            <p class="subtitle">
              {t().title ?? "Untitled"}
              <Show when={t().composer?.trim()}>
                {(c) => <span> · {c()}</span>}
              </Show>
              <span>
                {" "}
                · {t().notes.length} notes · {t().bpm} BPM
              </span>
              <Show when={fingeringProgress()}>
                {(p) => (
                  <span class="fingering-chip"> · {formatFingeringProgressLabel(p())}</span>
                )}
              </Show>
            </p>
          )}
        </Show>
      </header>

      <Show when={bannerError()}>
        <p class="app-banner app-banner-error" role="alert">
          {bannerError()}
        </p>
      </Show>

      <Show when={idleHint()}>
        <p class="app-banner app-banner-hint">{idleHint()}</p>
      </Show>

      <div class="playfield">
        <div class="waterfall-stage">
          <Show
            when={waterfallReady()}
            fallback={
              <div class="waterfall-empty">
                <p>Waterfall appears when a score is loaded.</p>
              </div>
            }
          >
            {(ctx) => (
              <Waterfall
                laneGeometry={ctx().laneGeometry}
                score={ctx().score}
                serverElapsedMs={status()?.positionMs ?? null}
                serverPlaying={status()?.playing ?? false}
                serverPaused={status()?.paused ?? false}
                serverPlaybackSpeed={status()?.speed ?? 1}
                latestNotePlayed={waterfallNote()}
                sessionRestartGeneration={sessionRestartGeneration()}
                seekGeneration={seekGeneration()}
                heldMidiPitches={heldMidiPitches()}
                waterfallThemeId={waterfallThemeId()}
              />
            )}
          </Show>
          <div class="waterfall-timeline-overlay">
            <TimelineScrubber
              notes={timeline()?.notes ?? []}
              durationMs={timeline()?.duration_ms ?? 0}
              positionMs={status()?.positionMs ?? 0}
              playing={status()?.playing ?? false}
              paused={status()?.paused ?? false}
              speed={status()?.speed ?? 1}
              enabled={scrubberEnabled()}
              onSeek={(ms) => void seek(ms)}
            />
          </div>
        </div>
        <div class="piano-host" ref={pianoHostRef}>
          <Piano
            layout={layout()}
            latestNotePlayed={latestNote()}
            heldMidiPitches={heldMidiPitches()}
          />
        </div>
      </div>

      <div class="grid">
        <section class="panel controls">
          <h2>Playback</h2>
          <label class="theme-row">
            Waterfall theme
            <select
              value={waterfallThemeId()}
              onChange={(e) => {
                const id = e.currentTarget.value as WaterfallThemeId;
                setWaterfallThemeId(id);
                try {
                  localStorage.setItem(THEME_STORAGE_KEY, id);
                } catch {
                  /* ignore */
                }
              }}
            >
              <option value={WATERFALL_THEME_IDS.LavaStage}>
                {WATERFALL_THEME_LABELS[WATERFALL_THEME_IDS.LavaStage]}
              </option>
              <option value={WATERFALL_THEME_IDS.AuroraIce}>
                {WATERFALL_THEME_LABELS[WATERFALL_THEME_IDS.AuroraIce]}
              </option>
            </select>
          </label>
          <div class="row">
            <button type="button" onClick={() => void play()}>
              Play
            </button>
            <button
              type="button"
              onClick={() =>
                void invoke("pause").then(() => {
                  log("playback", "Paused");
                  return refreshStatus();
                })
              }
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() =>
                void invoke("resume").then(() => {
                  log("playback", "Resumed");
                  return refreshStatus();
                })
              }
            >
              Resume
            </button>
            <button type="button" onClick={() => void stop()}>
              Stop
            </button>
          </div>
          <label class="slider-row">
            Speed {(status()?.speed ?? 1).toFixed(2)}x
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={status()?.speed ?? 1}
              onInput={(e) =>
                void invoke("set_speed", { speed: Number(e.currentTarget.value) }).then(
                  refreshStatus,
                )
              }
            />
          </label>
          <label class="slider-row">
            Tolerance {Math.round(status()?.toleranceMs ?? 130)} ms
            <input
              type="range"
              min={50}
              max={300}
              step={5}
              value={status()?.toleranceMs ?? 130}
              onInput={(e) =>
                void invoke("set_tolerance", {
                  toleranceMs: Number(e.currentTarget.value),
                }).then(refreshStatus)
              }
            />
          </label>
        </section>

        <section class="panel">
          <h2>MIDI</h2>
          <div class="row">
            <select
              value={selectedMidi()}
              onChange={(e) => {
                const port = e.currentTarget.value;
                setSelectedMidi(port);
                if (port) {
                  void invoke("select_midi", { port })
                    .then(() => log("midi", `Selected ${port}`))
                    .catch((err) => log("error", String(err)));
                }
              }}
            >
              <option value="">Select device…</option>
              <For each={midiPorts()}>{(port) => <option value={port}>{port}</option>}</For>
            </select>
            <button
              type="button"
              onClick={() =>
                void invoke<string[]>("list_midi_ports").then((ports) => setMidiPorts(ports))
              }
            >
              Refresh
            </button>
          </div>
        </section>

        <EventLog entries={eventLog()} />

        <section class="panel">
          <h2>MuseScore plugin</h2>
          <p class="panel-hint">
            Installs <code>Cadenza.qml</code> to your MuseScore 4 plugins folder. Restart MuseScore,
            then run <strong>Plugins → Cadenza Sender</strong> with this app open.
          </p>
          <div class="row">
            <button
              type="button"
              onClick={() =>
                void invoke<{ dest: string; alreadyInstalled: boolean }>(
                  "install_musescore_plugin",
                ).then((r) => {
                  setPluginMessage(
                    r.alreadyInstalled
                      ? `Plugin already up to date at ${r.dest}`
                      : `Installed to ${r.dest}`,
                  );
                  log("info", r.alreadyInstalled ? "Plugin up to date" : "Plugin installed");
                }).catch((e) => setPluginMessage(String(e)))
              }
            >
              Install plugin
            </button>
          </div>
          <Show when={pluginMessage()}>
            <p class="plugin-status">{pluginMessage()}</p>
          </Show>
        </section>
      </div>
    </main>
  );
}

export default App;
