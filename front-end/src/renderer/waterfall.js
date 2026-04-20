// Three.js-powered waterfall renderer. Notes descend from the top of the
// canvas toward a horizontal "hit-line" near the bottom. Each note is a
// vertical bar; its colour indicates status (pending / correct / error);
// a sprite under each bar shows the note letter (C, C♯, D, ...).

// Relative path instead of a bare specifier: our CSP (`script-src 'self'`)
// blocks inline scripts, which also blocks <script type="importmap">. A
// direct relative import bypasses the importmap entirely.
import * as THREE from "../../node_modules/three/build/three.module.js";

import {
  DEFAULT_LEAD_MS,
  DEFAULT_PX_PER_MS,
  barHeightPx,
  isAccidental,
  nameForPitch,
  noteMeshKey,
  yForNote,
} from "./timeline.js";

// Pending bars are tinted by key colour so black-key notes are visually
// distinct from white-key notes at a glance — matching the "which lane
// is this note in?" mental model that piano learners already use.
// Good/Bad/Neutral stay universal; correctness always reads as the same
// semantic colour regardless of which lane produced it.
const COLOUR_PENDING_WHITE = new THREE.Color(0x6cd0ff); // cyan
const COLOUR_PENDING_BLACK = new THREE.Color(0xa77bff); // violet
const COLOUR_GOOD = new THREE.Color(0x3fd97f);
const COLOUR_BAD = new THREE.Color(0xff5a6c);
const COLOUR_NEUTRAL = new THREE.Color(0x6cd0ff);
const COLOUR_LINE = new THREE.Color(0xffffff);

function pendingColourFor(pitch) {
  return isAccidental(pitch) ? COLOUR_PENDING_BLACK : COLOUR_PENDING_WHITE;
}

// Label sprite sizing (screen-space pixels — we use an ortho camera where
// 1 world unit == 1 CSS pixel, so sprite.scale doubles as a pixel size).
const LABEL_WIDTH_PX = 26;
const LABEL_HEIGHT_PX = 16;

// Inset from the bar's bottom edge to the label's centre. The label is
// rendered at bottom-centre of the bar (like a small name tag on the
// nearest-to-hit-line side), so the visual hierarchy reads "bar on top,
// letter at the foot", matching how the user is about to hit the note.
const LABEL_BOTTOM_INSET_PX = 3;

// Bars shorter than this are rendered without a label. Labels are drawn
// *inside* the bar at bottom-centre, so a bar must be at least as tall
// as the label plus the inset plus a small margin to keep the glyph
// from clipping the top edge — this keeps the visual density sane
// during fast passages while guaranteeing labels never collide with
// adjacent notes in the same lane (each label is physically contained
// in its own bar).
const MIN_BAR_HEIGHT_FOR_LABEL_PX = LABEL_HEIGHT_PX + LABEL_BOTTOM_INSET_PX * 2;

export class WaterfallRenderer {
  constructor(canvas, piano, { pxPerMs = DEFAULT_PX_PER_MS, leadMs = DEFAULT_LEAD_MS } = {}) {
    if (!piano) throw new Error("WaterfallRenderer requires a PianoKeyboard instance");

    this.canvas = canvas;
    this.piano = piano;
    this.pxPerMs = pxPerMs;
    this.leadMs = leadMs;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d17);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

    this.hitLine = this._makeHitLine();
    this.scene.add(this.hitLine);

    this.noteGroup = new THREE.Group();
    this.scene.add(this.noteGroup);

    this.flashGroup = new THREE.Group();
    this.scene.add(this.flashGroup);

    // Keyed by "pitch@start_ms" so we can update status in place. The
    // value is a THREE.Group containing the bar Mesh (+ optional label).
    // The bar itself is reachable via `group.userData.bar`.
    this.noteMeshes = new Map();
    this.flashes = [];

    // Shared sprite materials, cached per glyph ("C", "C♯", ...). Each
    // label is a Sprite that references one of these — so rebuilding
    // notes doesn't churn GPU textures.
    this.labelMaterials = new Map();

    // Clock state. `startTimestamp` is the wall-clock (performance.now) at
    // which the score clock's t=0 happened. `pausedElapsedMs` is set only
    // while paused: it freezes the displayed time at that value and keeps
    // startTimestamp null so _tick doesn't keep advancing.
    this.startTimestamp = null;
    this.pausedElapsedMs = null;

    this.score = { bpm: 120, notes: [], duration_ms: 0 };

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas);
    // The piano owns the lane geometry; its width tracks the canvas (same
    // grid column), but we still rebuild when it re-lays-out so bar
    // widths/positions stay in sync even if the piano reflows first.
    this._pianoResizeListener = () => this._rebuildNotes();
    this.piano.addEventListener("resize", this._pianoResizeListener);

    this._resize();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this.piano.removeEventListener("resize", this._pianoResizeListener);
    this.renderer.dispose();
    for (const mat of this.labelMaterials.values()) {
      mat.map?.dispose();
      mat.dispose();
    }
    this.labelMaterials.clear();
  }

  setScore(scoreTimeline) {
    this.score = scoreTimeline;
    this._rebuildNotes();
  }

  /** Fresh start — resets the clock to t=0 and clears all note colours. */
  start() {
    this.startTimestamp = performance.now();
    this.pausedElapsedMs = null;
    for (const group of this.noteMeshes.values()) {
      group.userData.status = "pending";
      group.userData.bar.material.color.copy(pendingColourFor(group.userData.pitch));
    }
  }

  /** Freeze the clock where it is. Idempotent; safe to call when idle. */
  pause() {
    if (this.startTimestamp == null) return;
    this.pausedElapsedMs = performance.now() - this.startTimestamp;
    this.startTimestamp = null;
  }

  /** Continue from the last pause position. No-op if not paused. */
  resume() {
    if (this.pausedElapsedMs == null) return;
    this.startTimestamp = performance.now() - this.pausedElapsedMs;
    this.pausedElapsedMs = null;
  }

  /** True while the clock is frozen in place. */
  get isPaused() {
    return this.pausedElapsedMs != null;
  }

  /** Full stop: clock idle, no pause memory. */
  stop() {
    this.startTimestamp = null;
    this.pausedElapsedMs = null;
  }

  /**
   * Highlight a note validation result pushed from the backend.
   *
   * Feedback strategy: paint the *bar* itself (green on hit, red on
   * miss) whenever the server resolved a target scored note. This keeps
   * the feedback attached to the object the user is reading — the
   * falling bar — instead of flashing at the hit-line, which required
   * the user to split attention. Fallback flashes only happen when
   * there's nothing useful to colour:
   *
   *   - `correct === true`  + target bar found → paint green, no flash.
   *   - `correct === false` + target bar found → paint red, no flash.
   *                           (Covers Phase-3 "wrong key near a target"
   *                           misses and Phase-2 "extra press during
   *                           hold window" penalties, which flip a
   *                           previously-green bar back to red.)
   *   - `correct === false` + no target → red flash on the played lane
   *                           so a truly off-time random press still
   *                           registers visually.
   *   - `correct === null`  → neutral flash on the played lane for
   *                           un-scored / pre-start presses.
   */
  reportPlayback(msg) {
    const { correct, played_pitch } = msg;

    if (correct === true || correct === false) {
      // noteMeshKey prefers the backend-assigned id; (pitch, startMs) is
      // only used as a fallback for payloads that still omit the id.
      const key = noteMeshKey(msg);
      const group = key != null ? this.noteMeshes.get(key) : null;
      if (group) {
        const colour = correct ? COLOUR_GOOD : COLOUR_BAD;
        group.userData.status = correct ? "good" : "bad";
        group.userData.bar.material.color.copy(colour);
        return; // Bar carries the feedback — no hit-line flash.
      }

      // Fallback: we know the press missed, but there's no bar to
      // repaint (truly random press far from any scored note). Keep a
      // red flash so the user still gets negative feedback.
      if (correct === false && played_pitch !== null && played_pitch !== undefined) {
        this._spawnFlash(played_pitch, COLOUR_BAD);
      }
      return;
    }

    // Unvalidated press (correct === null / undefined): neutral flash
    // on the played lane. Covers pre-start "test the cable" presses
    // and noodling without a loaded score.
    if (played_pitch !== null && played_pitch !== undefined) {
      this._spawnFlash(played_pitch, COLOUR_NEUTRAL);
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  _noteKey(note) {
    // Centralised through ``noteMeshKey`` so the keying policy (id
    // preferred, composite fallback) stays identical between
    // mesh creation and mesh lookup.
    return noteMeshKey(note);
  }

  _rebuildNotes() {
    for (const group of this.noteMeshes.values()) {
      group.userData.bar.geometry.dispose();
      group.userData.bar.material.dispose();
    }
    this.noteMeshes.clear();
    this.noteGroup.clear();

    for (const n of this.score.notes) {
      const laneWidth = this.piano.laneWidthPx(n.pitch);
      const width = Math.max(3, laneWidth * 0.85);
      const height = barHeightPx(n.duration_ms, this.pxPerMs);
      const isBlack = isAccidental(n.pitch);

      const group = new THREE.Group();
      const geom = new THREE.PlaneGeometry(width, height);
      // `depthTest:false` + `renderOrder` ensures black-key bars draw on
      // top of any overlapping white-key bar (real piano stacking), and
      // also guarantees deterministic draw order under our ortho camera
      // where all bars share the same Z — without this, overlap shows up
      // as z-fighting flicker between frames.
      const mat = new THREE.MeshBasicMaterial({
        color: pendingColourFor(n.pitch).clone(),
        depthTest: false,
        depthWrite: false,
      });
      const bar = new THREE.Mesh(geom, mat);
      group.add(bar);
      group.renderOrder = isBlack ? 2 : 1;

      if (height >= MIN_BAR_HEIGHT_FOR_LABEL_PX) {
        // Label at bottom-centre of the bar. The bar's local origin is
        // its centre (PlaneGeometry is origin-centred), so the bottom
        // edge sits at y = -height/2. Adding LABEL_HEIGHT_PX/2 lifts the
        // sprite so its own bottom aligns with the bar's bottom, then
        // LABEL_BOTTOM_INSET_PX nudges it up a few pixels for breathing
        // room. Labels of two back-to-back same-lane notes therefore
        // sit at the bottom of each bar and cannot overlap each other.
        const sprite = this._makeLabelSprite(n.pitch);
        sprite.position.set(
          0,
          -height / 2 + LABEL_HEIGHT_PX / 2 + LABEL_BOTTOM_INSET_PX,
          0,
        );
        sprite.renderOrder = 3;
        group.add(sprite);
      }

      group.userData = {
        id: n.id,
        pitch: n.pitch,
        startMs: n.start_ms,
        durationMs: n.duration_ms,
        status: "pending",
        bar,
      };
      this.noteMeshes.set(this._noteKey(n), group);
      this.noteGroup.add(group);
    }
  }

  _makeLabelSprite(pitch) {
    const text = nameForPitch(pitch);
    const mat = this._getLabelMaterial(text);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(LABEL_WIDTH_PX, LABEL_HEIGHT_PX, 1);
    return sprite;
  }

  _getLabelMaterial(text) {
    const cached = this.labelMaterials.get(text);
    if (cached) return cached;

    // Render at 2× DPR for crispness on HiDPI without wasting memory.
    const dpr = Math.ceil((window.devicePixelRatio || 1) * 2);
    const cw = LABEL_WIDTH_PX * dpr;
    const ch = LABEL_HEIGHT_PX * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.floor(ch * 0.78)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    // Labels now sit *inside* bars, so bar fill (cyan/violet/green/red)
    // is the background. Stroke+fill produces an outlined glyph that
    // stays readable against any of those fills without needing a
    // per-state palette. Stroke first, fill second: the fill masks the
    // inner stroke, leaving only a dark outline at the edges.
    //
    // Stroke width is ~22% of glyph height — visibly thick so the
    // outline reads as a "shadow" rather than a hair-line, matching the
    // request for wider shadows on note letters. `lineJoin: round`
    // prevents spiky corners on accidental glyphs (C♯, etc.).
    const strokeW = Math.max(3, Math.floor(ch * 0.22));
    ctx.lineWidth = strokeW;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "rgba(8,10,20,0.96)";
    ctx.strokeText(text, cw / 2, ch / 2 + 1);
    // Accidentals dim 10% so the visual rhythm still emphasises white keys.
    ctx.fillStyle = isAccidental(midiFromName(text))
      ? "rgba(242,246,255,0.92)"
      : "rgba(255,255,255,1)";
    ctx.fillText(text, cw / 2, ch / 2 + 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.labelMaterials.set(text, mat);
    return mat;
  }

  _spawnFlash(pitch, color) {
    const laneWidth = this.piano.laneWidthPx(pitch);
    const geom = new THREE.PlaneGeometry(Math.max(3, laneWidth * 1.05), 10);
    const mat = new THREE.MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geom, mat);
    const w = this._canvasWidthPx();
    mesh.position.set(this.piano.laneCenterPx(pitch) - w / 2, 0, 0);
    mesh.userData.spawnedAt = performance.now();
    this.flashGroup.add(mesh);
    this.flashes.push(mesh);
  }

  _makeHitLine() {
    const mat = new THREE.LineBasicMaterial({ color: COLOUR_LINE });
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5000, 0, 0),
      new THREE.Vector3(5000, 0, 0),
    ]);
    return new THREE.Line(geom, mat);
  }

  _canvasWidthPx() {
    return this.canvas.clientWidth || this.canvas.width || 1;
  }

  _canvasHeightPx() {
    return this.canvas.clientHeight || this.canvas.height || 1;
  }

  _resize() {
    const w = this._canvasWidthPx();
    const h = this._canvasHeightPx();
    this.renderer.setSize(w, h, false);

    // Orthographic camera: +X right, +Y up, hit-line at y=0, top of canvas
    // at y=h-hitLineOffset, bottom at y=-hitLineOffset.
    const hitLineOffset = h * 0.15;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h - hitLineOffset;
    this.camera.bottom = -hitLineOffset;
    this.camera.updateProjectionMatrix();

    this._rebuildNotes();
  }

  _tick() {
    // Clock resolution: playing → wall-clock since start; paused → the
    // frozen elapsed value; idle → zero so notes rest at their spawn
    // positions. Order matters: check startTimestamp first because a
    // lingering pausedElapsedMs must be ignored once start() has cleared it.
    const nowMs = this.startTimestamp != null
      ? performance.now() - this.startTimestamp
      : this.pausedElapsedMs != null
        ? this.pausedElapsedMs
        : 0;
    const w = this._canvasWidthPx();

    for (const group of this.noteMeshes.values()) {
      const { pitch, startMs, durationMs } = group.userData;
      const y = yForNote({ startMs, nowMs, pxPerMs: this.pxPerMs }) + (durationMs * this.pxPerMs) / 2;
      const x = this.piano.laneCenterPx(pitch) - w / 2;
      group.position.set(x, y, 0);
      group.visible = y > this.camera.bottom - 50 && y < this.camera.top + 50;
    }

    const now = performance.now();
    for (let i = this.flashes.length - 1; i >= 0; --i) {
      const f = this.flashes[i];
      const age = now - f.userData.spawnedAt;
      if (age >= 300) {
        this.flashGroup.remove(f);
        f.geometry.dispose();
        f.material.dispose();
        this.flashes.splice(i, 1);
      } else {
        f.material.opacity = 1 - age / 300;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// The label cache is keyed by text, but we need to know whether the glyph
// represents an accidental to dim it appropriately. Reverse-map the glyph
// back to any pitch in its class; pitch identity doesn't matter here,
// only the black/white distinction.
const NAME_TO_PITCH_CLASS = {
  "C": 0, "C♯": 1, "D": 2, "D♯": 3, "E": 4, "F": 5,
  "F♯": 6, "G": 7, "G♯": 8, "A": 9, "A♯": 10, "B": 11,
};
function midiFromName(text) {
  return NAME_TO_PITCH_CLASS[text] ?? 0;
}
