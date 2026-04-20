import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type { LaneGeometry } from "../types/geometry";
import type { NotePlayed, ScoreNote, ScoreTimeline } from "../types/score";

import {
  BAR_VERTICAL_GAP_PX,
  barHeightPx,
  DEFAULT_LEAD_MS,
  DEFAULT_PX_PER_MS,
  isAccidental,
  nameForPitch,
  noteMeshKey,
  yForNote,
} from "./timeline";

const COLOUR_PENDING_WHITE = new THREE.Color(0x6cd0ff);
const COLOUR_PENDING_BLACK = new THREE.Color(0xa77bff);
const COLOUR_GOOD = new THREE.Color(0x3fd97f);
const COLOUR_BAD = new THREE.Color(0xff5a6c);
const COLOUR_NEUTRAL = new THREE.Color(0x6cd0ff);
const COLOUR_LINE = new THREE.Color(0xffffff);

function pendingColourFor(pitch: number): THREE.Color {
  return isAccidental(pitch) ? COLOUR_PENDING_BLACK : COLOUR_PENDING_WHITE;
}

const LABEL_WIDTH_PX = 26;
const LABEL_HEIGHT_PX = 16;
const LABEL_BOTTOM_INSET_PX = 3;
const MIN_BAR_HEIGHT_FOR_LABEL_PX =
  LABEL_HEIGHT_PX + LABEL_BOTTOM_INSET_PX * 2;

const NAME_TO_PITCH_CLASS: Record<string, number> = {
  A: 9,
  "A♯": 10,
  B: 11,
  C: 0,
  "C♯": 1,
  D: 2,
  "D♯": 3,
  E: 4,
  F: 5,
  "F♯": 6,
  G: 7,
  "G♯": 8,
};

function midiFromName(text: string): number {
  return NAME_TO_PITCH_CLASS[text] ?? 0;
}

export interface WaterfallOptions {
  leadMs?: number;
  playbackSpeed?: number;
  pxPerMs?: number;
}

const DEFAULT_PLAYBACK_SPEED = 1.0;

type NoteStatus = "bad" | "good" | "pending";

interface NoteUserData {
  bar: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  durationMs: number;
  id?: number;
  pitch: number;
  startMs: number;
  status: NoteStatus;
}

interface FlashUserData {
  spawnedAt: number;
}

type FlashMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: FlashUserData;
};

// Three.js waterfall renderer. Notes fall from the top of the canvas
// toward a horizontal hit-line; each bar's colour encodes status
// (pending / correct / miss). The renderer takes a lane-geometry
// provider — any object exposing ``laneCenterPx(pitch)`` and
// ``laneWidthPx(pitch)`` — rather than owning the piano itself, so the
// React tree can swap the geometry source when the viewport layout
// changes.
export class WaterfallRenderer {
  readonly camera: THREE.OrthographicCamera;
  readonly canvas: HTMLCanvasElement;
  readonly flashes: FlashMesh[] = [];
  readonly flashGroup: THREE.Group;
  readonly hitLine: THREE.Line;
  laneGeometry: LaneGeometry;
  readonly leadMs: number;
  readonly noteGroup: THREE.Group;
  readonly noteMeshes: Map<string, THREE.Group> = new Map();
  // ``pausedElapsedMs`` holds the **virtual** (score-ms) playhead
  // position at the moment of the last ``pause()``; ``startTimestamp``
  // is the wall ``performance.now()`` at the last ``start()``/``resume()``.
  // Virtual now = ``(performance.now() - startTimestamp) * _speed`` while
  // playing, or ``pausedElapsedMs`` while paused. At ``_speed === 1``
  // the arithmetic is identical to the pre-feature code, so legacy
  // behaviour is preserved byte-for-byte.
  pausedElapsedMs: null | number = null;
  readonly pxPerMs: number;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  score: ScoreTimeline = { bpm: 120, duration_ms: 0, notes: [] };
  startTimestamp: null | number = null;
  private _speed: number;
  private readonly _resizeObserver: ResizeObserver;
  private readonly labelMaterials: Map<string, THREE.SpriteMaterial> =
    new Map();

  constructor(
    canvas: HTMLCanvasElement,
    laneGeometry: LaneGeometry,
    {
      leadMs = DEFAULT_LEAD_MS,
      playbackSpeed = DEFAULT_PLAYBACK_SPEED,
      pxPerMs = DEFAULT_PX_PER_MS,
    }: WaterfallOptions = {},
  ) {
    if (!laneGeometry) {
      throw new Error("WaterfallRenderer requires a lane-geometry provider");
    }

    this.canvas = canvas;
    this.laneGeometry = laneGeometry;
    this.pxPerMs = pxPerMs;
    this.leadMs = leadMs;
    this._speed = playbackSpeed > 0 ? playbackSpeed : DEFAULT_PLAYBACK_SPEED;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
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

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas);

    this._resize();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  destroy(): void {
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this.renderer.dispose();
    for (const mat of this.labelMaterials.values()) {
      mat.map?.dispose();
      mat.dispose();
    }
    this.labelMaterials.clear();
  }

  get isPaused(): boolean {
    return this.pausedElapsedMs != null;
  }

  pause(): void {
    if (this.startTimestamp == null) return;
    this.pausedElapsedMs =
      (performance.now() - this.startTimestamp) * this._speed;
    this.startTimestamp = null;
  }

  get playbackSpeed(): number {
    return this._speed;
  }

  // Update the replay-speed multiplier.
  //
  // When ``alignToVirtualMs`` is provided we pin the renderer's
  // playhead to the caller-supplied virtual-time value (the
  // server-authoritative ``elapsed_ms``). This is how drift is
  // eliminated on a speed commit or mid-session reconnect: the
  // frontend stops trying to extrapolate its own virtual time across
  // asymmetric rebases and simply trusts the server's clock for the
  // snap, then resumes ticking forward at the new speed from there.
  //
  // When ``alignToVirtualMs`` is omitted we fall back to a self-rebase
  // (preserve the currently-displayed playhead) for callers that don't
  // yet have an authoritative value — e.g. offline unit tests.
  setPlaybackSpeed(nextSpeed: number, alignToVirtualMs?: number): void {
    if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) return;

    if (typeof alignToVirtualMs === "number" && Number.isFinite(alignToVirtualMs)) {
      const virtualMs = Math.max(0, alignToVirtualMs);
      if (this.pausedElapsedMs != null) {
        this.pausedElapsedMs = virtualMs;
      } else {
        this.startTimestamp = performance.now() - virtualMs / nextSpeed;
      }
      this._speed = nextSpeed;
      return;
    }

    if (this.startTimestamp != null) {
      const virtualNowMs =
        (performance.now() - this.startTimestamp) * this._speed;
      this.startTimestamp = performance.now() - virtualNowMs / nextSpeed;
    }
    // When paused, ``pausedElapsedMs`` already stores virtual ms, so
    // there is nothing to rebase — the next ``resume()`` will honour
    // the new factor automatically.
    this._speed = nextSpeed;
  }

  // Align the renderer's virtual-time playhead to the supplied value
  // without changing the replay-speed. Used on late-join (a client
  // reconnects mid-session) and on pause/resume transitions where the
  // server reports an authoritative elapsed we must honour verbatim.
  syncToElapsedMs(virtualMs: number): void {
    if (!Number.isFinite(virtualMs)) return;
    const safe = Math.max(0, virtualMs);
    if (this.pausedElapsedMs != null) {
      this.pausedElapsedMs = safe;
    } else if (this.startTimestamp != null) {
      this.startTimestamp = performance.now() - safe / this._speed;
    }
  }

  // Like :meth:`start` but positions the virtual-time origin so the
  // playhead begins at ``virtualMs``. Used when a client joins in the
  // middle of a running session — the status frame tells us where the
  // server is, and the renderer mirrors it.
  startAt(virtualMs: number): void {
    const safe = Number.isFinite(virtualMs) ? Math.max(0, virtualMs) : 0;
    this.startTimestamp = performance.now() - safe / this._speed;
    this.pausedElapsedMs = null;
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.status = "pending";
      data.bar.material.color.copy(pendingColourFor(data.pitch));
    }
  }

  // Pause variant that sets the frozen playhead to the supplied
  // virtual-time value. Lets a newly-connecting client land exactly on
  // the server's paused position rather than wherever it was animating
  // locally.
  pauseAt(virtualMs: number): void {
    const safe = Number.isFinite(virtualMs) ? Math.max(0, virtualMs) : 0;
    this.pausedElapsedMs = safe;
    this.startTimestamp = null;
  }

  reportPlayback(msg: NotePlayed): void {
    const { correct, played_pitch } = msg;

    if (correct === true || correct === false) {
      const key = noteMeshKey(msg);
      const group = key != null ? this.noteMeshes.get(key) : null;
      if (group) {
        const data = group.userData as NoteUserData;
        const colour = correct ? COLOUR_GOOD : COLOUR_BAD;
        data.status = correct ? "good" : "bad";
        data.bar.material.color.copy(colour);
        return;
      }
      if (correct === false && played_pitch !== null && played_pitch !== undefined) {
        this._spawnFlash(played_pitch, COLOUR_BAD);
      }
      return;
    }

    if (played_pitch !== null && played_pitch !== undefined) {
      this._spawnFlash(played_pitch, COLOUR_NEUTRAL);
    }
  }

  resume(): void {
    if (this.pausedElapsedMs == null) return;
    this.startTimestamp =
      performance.now() - this.pausedElapsedMs / this._speed;
    this.pausedElapsedMs = null;
  }

  // Replace the lane-geometry provider (e.g. after a piano reflow).
  // Triggers a full mesh rebuild so bar widths/positions stay aligned
  // with the visible keys.
  setLaneGeometry(nextGeometry: LaneGeometry | null | undefined): void {
    if (!nextGeometry) return;
    this.laneGeometry = nextGeometry;
    this._rebuildNotes();
  }

  setScore(scoreTimeline: ScoreTimeline): void {
    this.score = scoreTimeline;
    this._rebuildNotes();
  }

  start(): void {
    this.startTimestamp = performance.now();
    this.pausedElapsedMs = null;
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.status = "pending";
      data.bar.material.color.copy(pendingColourFor(data.pitch));
    }
  }

  stop(): void {
    this.startTimestamp = null;
    this.pausedElapsedMs = null;
  }

  private _canvasHeightPx(): number {
    return this.canvas.clientHeight || this.canvas.height || 1;
  }

  private _canvasWidthPx(): number {
    return this.canvas.clientWidth || this.canvas.width || 1;
  }

  private _getLabelMaterial(text: string): THREE.SpriteMaterial {
    const cached = this.labelMaterials.get(text);
    if (cached) return cached;

    const dpr = Math.ceil((window.devicePixelRatio || 1) * 2);
    const cw = LABEL_WIDTH_PX * dpr;
    const ch = LABEL_HEIGHT_PX * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.clearRect(0, 0, cw, ch);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.floor(ch * 0.78)}px system-ui, -apple-system, "Segoe UI", sans-serif`;

    // Wider outline (~22% of glyph height) reads as a drop-shadow on
    // any of the bar-fill colours (cyan/violet/green/red), keeping the
    // letter legible without a per-state palette.
    const strokeW = Math.max(3, Math.floor(ch * 0.22));
    ctx.lineWidth = strokeW;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "rgba(8,10,20,0.96)";
    ctx.strokeText(text, cw / 2, ch / 2 + 1);
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
      depthTest: false,
      depthWrite: false,
      map: tex,
      transparent: true,
    });
    this.labelMaterials.set(text, mat);
    return mat;
  }

  private _makeHitLine(): THREE.Line {
    const mat = new THREE.LineBasicMaterial({ color: COLOUR_LINE });
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5000, 0, 0),
      new THREE.Vector3(5000, 0, 0),
    ]);
    return new THREE.Line(geom, mat);
  }

  private _makeLabelSprite(pitch: number): THREE.Sprite {
    const text = nameForPitch(pitch);
    const mat = this._getLabelMaterial(text);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(LABEL_WIDTH_PX, LABEL_HEIGHT_PX, 1);
    return sprite;
  }

  private _noteKey(note: ScoreNote): null | string {
    return noteMeshKey(note);
  }

  private _rebuildNotes(): void {
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.bar.geometry.dispose();
      data.bar.material.dispose();
    }
    this.noteMeshes.clear();
    this.noteGroup.clear();

    for (const n of this.score.notes) {
      const laneWidth = this.laneGeometry.laneWidthPx(n.pitch);
      const width = Math.max(3, laneWidth * 0.85);
      const height = barHeightPx(n.duration_ms, this.pxPerMs);
      const isBlack = isAccidental(n.pitch);
      const cornerRadius = Math.min(
        6,
        width * 0.14,
        Math.max(2, height * 0.12),
      );

      const group = new THREE.Group();
      const geom = new RoundedBoxGeometry(
        width,
        height,
        2,
        2,
        cornerRadius,
      );
      const mat = new THREE.MeshBasicMaterial({
        color: pendingColourFor(n.pitch).clone(),
        depthTest: false,
        depthWrite: false,
      });
      const bar = new THREE.Mesh(geom, mat);
      group.add(bar);
      group.renderOrder = isBlack ? 2 : 1;

      if (height >= MIN_BAR_HEIGHT_FOR_LABEL_PX) {
        const sprite = this._makeLabelSprite(n.pitch);
        sprite.position.set(
          0,
          -height / 2 + LABEL_HEIGHT_PX / 2 + LABEL_BOTTOM_INSET_PX,
          0,
        );
        sprite.renderOrder = 3;
        group.add(sprite);
      }

      const userData: NoteUserData = {
        bar,
        durationMs: n.duration_ms,
        id: n.id,
        pitch: n.pitch,
        startMs: n.start_ms,
        status: "pending",
      };
      group.userData = userData;
      const key = this._noteKey(n);
      if (key) this.noteMeshes.set(key, group);
      this.noteGroup.add(group);
    }
  }

  private _resize(): void {
    const w = this._canvasWidthPx();
    const h = this._canvasHeightPx();
    this.renderer.setSize(w, h, false);

    const hitLineOffset = h * 0.15;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h - hitLineOffset;
    this.camera.bottom = -hitLineOffset;
    this.camera.updateProjectionMatrix();

    this._rebuildNotes();
  }

  private _spawnFlash(pitch: number, color: THREE.Color): void {
    const laneWidth = this.laneGeometry.laneWidthPx(pitch);
    const geom = new THREE.PlaneGeometry(Math.max(3, laneWidth * 1.05), 10);
    const mat = new THREE.MeshBasicMaterial({
      color: color.clone(),
      opacity: 1,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geom, mat) as FlashMesh;
    const w = this._canvasWidthPx();
    mesh.position.set(this.laneGeometry.laneCenterPx(pitch) - w / 2, 0, 0);
    mesh.userData = { spawnedAt: performance.now() };
    this.flashGroup.add(mesh);
    this.flashes.push(mesh);
  }

  private _tick(): void {
    const nowMs =
      this.startTimestamp != null
        ? (performance.now() - this.startTimestamp) * this._speed
        : this.pausedElapsedMs != null
          ? this.pausedElapsedMs
          : 0;
    const w = this._canvasWidthPx();

    for (const group of this.noteMeshes.values()) {
      const { durationMs, pitch, startMs } = group.userData as NoteUserData;
      const hPx = barHeightPx(durationMs, this.pxPerMs, BAR_VERTICAL_GAP_PX);
      const y =
        yForNote({ nowMs, pxPerMs: this.pxPerMs, startMs }) + hPx / 2;
      const x = this.laneGeometry.laneCenterPx(pitch) - w / 2;
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
