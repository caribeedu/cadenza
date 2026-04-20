// UI glue: wires DOM controls to the WebSocket client and the Three.js
// waterfall renderer.

import {
  MSG_HELLO,
  MSG_LIST_MIDI,
  MSG_PAUSE,
  MSG_RESUME,
  MSG_SELECT_MIDI,
  MSG_SET_TOLERANCE,
  MSG_START,
} from "./protocol.js";
import { CadenzaClient } from "./ws-client.js";
import { PianoKeyboard } from "./piano.js";
import { nameForPitch } from "./timeline.js";
import { WaterfallRenderer } from "./waterfall.js";

const backendInput = document.getElementById("backend-url");
const midiSelect = document.getElementById("midi-ports");
const refreshBtn = document.getElementById("refresh-midi");
const useMidiBtn = document.getElementById("connect-midi");
const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const toleranceInput = document.getElementById("tolerance");
const toleranceValueEl = document.getElementById("tolerance-value");
const wsStatus = document.getElementById("ws-status");
const midiStatus = document.getElementById("midi-status");
const scoreStatus = document.getElementById("score-status");
const logEl = document.getElementById("log");
const canvas = document.getElementById("stage");
const pianoHost = document.getElementById("piano");

const defaultUrl = window.cadenza?.defaultBackendUrl ?? "ws://127.0.0.1:8765";
backendInput.value = defaultUrl;

// Piano owns the lane geometry; the waterfall consults it for positions
// so bars line up exactly with the visible keys. Construction order
// matters: the waterfall subscribes to the piano's `resize` event at
// constructor time.
const piano = new PianoKeyboard(pianoHost);
const waterfall = new WaterfallRenderer(canvas, piano);
const client = new CadenzaClient({ url: defaultUrl });

function log(msg, kind = "") {
  const line = document.createElement("div");
  line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
  if (kind) line.classList.add(kind);
  logEl.prepend(line);
  while (logEl.children.length > 200) logEl.lastChild?.remove();
}

function setChip(el, label, state) {
  el.textContent = label;
  el.classList.remove("chip-on", "chip-off", "chip-err");
  el.classList.add(`chip-${state}`);
}

client.addEventListener("open", () => {
  setChip(wsStatus, "WS: connected", "on");
  log("WebSocket connected", "ok");
  client.send({ type: MSG_HELLO, role: "frontend" });
  client.send({ type: MSG_LIST_MIDI });
});

client.addEventListener("close", () => {
  setChip(wsStatus, "WS: disconnected", "off");
  log("WebSocket closed (will reconnect)", "dim");
});

client.addEventListener("error", () => log("WebSocket error", "err"));

// Diagnostics for the outbound send queue: a client that stays offline
// long enough can overflow the small bounded buffer. Surface the drop in
// the UI so "my click vanished" turns into a readable message instead of
// silent nothing-happens — the original TD-06 symptom.
client.addEventListener("send-dropped", (event) => {
  const type = event.detail?.type ?? "<unknown>";
  log(`Dropped ${type}: send queue full while WebSocket is down`, "err");
});

// Playback state mirrored from the server's `status` frame so the Pause
// button knows whether to emit MSG_PAUSE or MSG_RESUME next.
let serverPlaying = false;
let serverPaused = false;

function updatePauseButton() {
  pauseBtn.textContent = serverPaused ? "Resume" : "Pause";
  pauseBtn.disabled = !serverPlaying && !serverPaused;
}

function setToleranceLabel(valueMs) {
  toleranceValueEl.textContent = `${Math.round(valueMs)} ms`;
}

// Initialise the label from whatever value the HTML defaulted to so it's
// correct before the first status frame arrives.
setToleranceLabel(Number(toleranceInput.value));

client.addEventListener("message", (event) => {
  const msg = event.detail;
  switch (msg.type) {
    case "status":
      serverPlaying = !!msg.playing;
      serverPaused = !!msg.paused;
      setChip(midiStatus, msg.midi_open ? `MIDI: ${msg.midi_port}` : "MIDI: none", msg.midi_open ? "on" : "off");
      setChip(
        scoreStatus,
        msg.score_loaded
          ? (msg.paused ? "Score: paused" : msg.playing ? "Score: playing" : "Score: ready")
          : "Score: waiting",
        msg.score_loaded ? "on" : "off",
      );
      updatePauseButton();
      // Sync the slider with the server's authoritative tolerance. The
      // guard prevents a feedback loop: the user's own `change` event
      // triggers a broadcast, which comes back as a status frame we'd
      // otherwise apply on top of a slider they may have just moved
      // again. A 1 ms epsilon is safe since the slider step is 5 ms.
      if (typeof msg.tolerance_ms === "number") {
        const current = Number(toleranceInput.value);
        if (Math.abs(current - msg.tolerance_ms) >= 1) {
          toleranceInput.value = String(msg.tolerance_ms);
          setToleranceLabel(msg.tolerance_ms);
        }
      }
      break;
    case "midi_ports":
      renderMidiPorts(msg.ports ?? []);
      break;
    case "score_timeline":
      waterfall.setScore(msg);
      log(`Score received: ${msg.notes.length} notes @ ${msg.bpm} BPM`, "ok");
      break;
    case "note_played":
      handleNotePlayed(msg);
      break;
    case "error":
      log(`Server error: ${msg.error}`, "err");
      break;
    default:
      break;
  }
});

// Map backend reason codes (see server.unvalidated_reason) to short,
// actionable English for the event log. Keys must stay in sync with the
// Python side.
const UNVALIDATED_REASON_HINTS = {
  no_score: "load a score from MuseScore first",
  not_started: "press Start to begin scoring",
  paused: "session is paused — press Resume",
};

// Show the reason hint at most once per reason per streak so we don't
// spam the log on every single keypress.
let lastUnvalidatedReason = null;

function handleNotePlayed(msg) {
  const pitch = msg.played_pitch;
  // Three distinct correctness outcomes — see waterfall.reportPlayback.
  const kind = msg.correct === true
    ? "good"
    : msg.correct === false
      ? "bad"
      : "neutral";

  waterfall.reportPlayback(msg);

  let painted = false;
  if (pitch !== null && pitch !== undefined) {
    painted = piano.flash(pitch, kind);
    // Console-level diagnostic that survives DevTools filters: makes the
    // "I pressed a key and saw nothing" debugging loop one step shorter
    // by telling the user whether the frontend received the event and
    // whether the pitch falls inside the keyboard's rendered range.
    // eslint-disable-next-line no-console
    console.info(
      `[Cadenza] note_played pitch=${pitch} (${nameForPitch(pitch)}) `
      + `correct=${msg.correct} reason=${msg.reason ?? "-"} key_painted=${painted}`,
    );
    if (!painted) {
      const { low, high } = piano.range;
      log(
        `Pressed MIDI ${pitch} (${nameForPitch(pitch)}) is outside the ${low}–${high} keyboard range`,
        "dim",
      );
    }
  }

  const outcome = msg.correct === true ? "OK"
                : msg.correct === false ? "miss"
                : "raw";
  const cssKind = msg.correct === true ? "ok"
                : msg.correct === false ? "err"
                : "dim";
  const deltaText = typeof msg.delta_ms === "number"
    ? `${msg.delta_ms.toFixed(0)}ms`
    : "—";
  log(`note_on ${pitch} ${outcome} Δ=${deltaText}`, cssKind);

  // Once per reason-streak, print the remediation hint so the user
  // understands *why* every press is coming back as "raw" instead of
  // validated. Cleared whenever a real validation arrives.
  if (msg.correct === null && msg.reason) {
    if (msg.reason !== lastUnvalidatedReason) {
      const hint = UNVALIDATED_REASON_HINTS[msg.reason] ?? msg.reason;
      log(`Validation skipped: ${hint}`, "dim");
      lastUnvalidatedReason = msg.reason;
    }
  } else if (msg.correct !== null) {
    lastUnvalidatedReason = null;
  }
}

function renderMidiPorts(ports) {
  const previous = midiSelect.value;
  midiSelect.innerHTML = "";
  if (ports.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(no MIDI devices found)";
    midiSelect.appendChild(opt);
    return;
  }
  for (const p of ports) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    midiSelect.appendChild(opt);
  }
  if (ports.includes(previous)) midiSelect.value = previous;
}

refreshBtn.addEventListener("click", () => client.send({ type: MSG_LIST_MIDI }));

useMidiBtn.addEventListener("click", () => {
  const port = midiSelect.value;
  if (!port) return log("Select a MIDI device first", "err");
  client.send({ type: MSG_SELECT_MIDI, port });
});

startBtn.addEventListener("click", () => {
  client.send({ type: MSG_START });
  waterfall.start();
  log("Playback started", "ok");
});

// Live label update while dragging, but only send one message when the
// user releases the slider. The `change` event fires exactly once per
// commit in both Chromium and Firefox, which keeps the wire traffic
// sane and avoids flooding the server with dozens of intermediate
// tolerances per drag gesture.
toleranceInput.addEventListener("input", () => {
  setToleranceLabel(Number(toleranceInput.value));
});
toleranceInput.addEventListener("change", () => {
  const value = Number(toleranceInput.value);
  client.send({ type: MSG_SET_TOLERANCE, tolerance_ms: value });
  log(`Tolerance → ${value} ms`, "dim");
});

pauseBtn.addEventListener("click", () => {
  // Mirror whatever the server will do — if it's currently playing, pause;
  // if it's already paused, resume. The server broadcasts a status frame
  // that we then use to update the button label, keeping both sides in
  // agreement even if a second client issues pause/resume in parallel.
  if (serverPaused) {
    client.send({ type: MSG_RESUME });
    waterfall.resume();
    log("Playback resumed", "ok");
  } else if (serverPlaying) {
    client.send({ type: MSG_PAUSE });
    waterfall.pause();
    log("Playback paused", "dim");
  }
});

backendInput.addEventListener("change", () => {
  const url = backendInput.value.trim();
  if (!url) return;
  client.disconnect();
  client.connect(url);
  log(`Reconnecting to ${url}`, "dim");
});

client.connect();
