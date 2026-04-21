/**
 * Three.js waterfall renderer. Notes fall from the top of the canvas toward a
 * horizontal hit-line; each bar's colour encodes status (pending / correct /
 * miss). The renderer takes a lane-geometry provider — any object exposing
 * ``laneCenterPx(pitch)`` and ``laneWidthPx(pitch)`` — rather than owning the
 * piano itself, so the React tree can swap the geometry source when the
 * viewport layout changes.
 *
 * Virtual time (score-ms) lives in {@link VirtualPlayhead}; this class wires it
 * into note motion, playback colouring, and lane flashes.
 */
import * as THREE from "three";

import type { LaneGeometry } from "../../types/geometry";
import type { NotePlayed, ScoreTimeline } from "../../types/score";

/** Per-hand tint for bars still in the "pending" state. */
import { pendingNoteColorHex } from "../note-hand-colors";
/**
 * Timeline math shared with any other score visualisation: vertical placement,
 * bar height in px, and mesh keys for matching server playback events to
 * on-screen notes.
 */
import {
  BAR_VERTICAL_GAP_PX,
  barHeightPx,
  DEFAULT_LEAD_MS,
  DEFAULT_PX_PER_MS,
  noteMeshKey,
  yForNote,
} from "../timeline";

import { WaterfallFlashLayer } from "./flash-layer";
import { createHitLine } from "./hit-line";
import type { NoteUserData } from "./note-group-factory";
import { WaterfallNoteGroupFactory } from "./note-group-factory";
import { NoteSpriteMaterialCache } from "./sprite-material-cache";
import { VirtualPlayhead } from "./virtual-playhead";

/** Hit / miss / neutral feedback on the lane (distinct from per-hand pending). */
const COLOUR_GOOD = new THREE.Color(0x3fd97f);
const COLOUR_BAD = new THREE.Color(0xff5a6c);
const COLOUR_NEUTRAL = new THREE.Color(0x6cd0ff);

function pendingColourFor(staff: number | undefined, pitch: number): THREE.Color {
  return new THREE.Color(pendingNoteColorHex(staff, pitch));
}

export interface WaterfallOptions {
  leadMs?: number;
  playbackSpeed?: number;
  pxPerMs?: number;
}

const DEFAULT_PLAYBACK_SPEED = 1.0;

export class WaterfallRenderer {
  readonly camera: THREE.OrthographicCamera;
  readonly canvas: HTMLCanvasElement;
  readonly flashGroup: THREE.Group;
  readonly hitLine: THREE.Line;
  laneGeometry: LaneGeometry;
  readonly leadMs: number;
  readonly noteGroup: THREE.Group;
  readonly noteMeshes: Map<string, THREE.Group> = new Map();
  readonly pxPerMs: number;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  score: ScoreTimeline = { bpm: 120, duration_ms: 0, notes: [] };

  /**
   * Virtual score-time clock (see {@link VirtualPlayhead}).
   *
   * While playing: virtual ms is ``(performance.now() - startTimestamp) *
   * speed``. While paused: it is frozen in ``pausedElapsedMs``. At
   * ``speed === 1``, elapsed virtual ms equals wall-clock ms since
   * ``start()``/``resume()`` for that segment.
   *
   * ``pausedElapsedMs`` and ``startTimestamp`` are also exposed on this class
   * as getters/setters that read and write the same fields on the playhead, for
   * callers that inspect or adjust playhead state directly.
   */
  private readonly playhead: VirtualPlayhead;
  private readonly spriteCache = new NoteSpriteMaterialCache();
  private noteFactory: WaterfallNoteGroupFactory;
  private readonly flashLayer: WaterfallFlashLayer;
  private readonly _resizeObserver: ResizeObserver;

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
    const speed =
      playbackSpeed > 0 ? playbackSpeed : DEFAULT_PLAYBACK_SPEED;
    this.playhead = new VirtualPlayhead(speed);

    this.noteFactory = new WaterfallNoteGroupFactory(
      this.laneGeometry,
      this.pxPerMs,
      this.spriteCache,
    );
    this.flashLayer = new WaterfallFlashLayer(this.laneGeometry);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d17);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

    this.hitLine = createHitLine();
    this.scene.add(this.hitLine);

    this.noteGroup = new THREE.Group();
    this.scene.add(this.noteGroup);

    this.flashGroup = this.flashLayer.group;
    this.scene.add(this.flashGroup);

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas);

    this._resize();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  get pausedElapsedMs(): null | number {
    return this.playhead.pausedElapsedMs;
  }
  set pausedElapsedMs(v: null | number) {
    this.playhead.pausedElapsedMs = v;
  }

  get startTimestamp(): null | number {
    return this.playhead.startTimestamp;
  }
  set startTimestamp(v: null | number) {
    this.playhead.startTimestamp = v;
  }

  get flashes() {
    return this.flashLayer.flashes;
  }

  destroy(): void {
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this.renderer.dispose();
    this.spriteCache.dispose();
  }

  get isPaused(): boolean {
    return this.playhead.isPaused;
  }

  pause(): void {
    this.playhead.pause();
  }

  get playbackSpeed(): number {
    return this.playhead.speed;
  }

  /**
   * Update the replay-speed multiplier.
   *
   * When ``alignToVirtualMs`` is provided we pin the renderer's playhead to the
   * caller-supplied virtual-time value (the server-authoritative
   * ``elapsed_ms``). This is how drift is eliminated on a speed commit or
   * mid-session reconnect: the frontend stops extrapolating its own virtual
   * time across asymmetric rebases and trusts the server's clock for the snap,
   * then resumes ticking forward at the new speed from there.
   *
   * When ``alignToVirtualMs`` is omitted we fall back to a self-rebase
   * (preserve the currently displayed playhead) for callers that do not yet
   * have an authoritative value — e.g. offline unit tests.
   *
   * When paused, ``pausedElapsedMs`` already stores virtual ms, so there is
   * nothing to rebase — the next ``resume()`` honours the new factor
   * automatically.
   */
  setPlaybackSpeed(nextSpeed: number, alignToVirtualMs?: number): void {
    this.playhead.setPlaybackSpeed(nextSpeed, alignToVirtualMs);
  }

  /**
   * Align the renderer's virtual-time playhead to the supplied value without
   * changing the replay speed. Used on late-join (a client reconnects
   * mid-session) and on pause/resume transitions where the server reports an
   * authoritative elapsed we must honour verbatim.
   */
  syncToElapsedMs(virtualMs: number): void {
    this.playhead.syncToElapsedMs(virtualMs);
  }

  /**
   * Like ``start`` but positions the virtual-time origin so the playhead
   * begins at ``virtualMs``. Used when a client joins in the middle of a
   * running session — the status frame tells us where the server is, and the
   * renderer mirrors it.
   */
  startAt(virtualMs: number): void {
    this.playhead.startAt(virtualMs);
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.status = "pending";
      data.bar.material.color.copy(
        pendingColourFor(data.staff, data.pitch),
      );
    }
  }

  /**
   * Pause variant that sets the frozen playhead to the supplied virtual-time
   * value. Lets a newly connecting client land exactly on the server's paused
   * position rather than wherever it was animating locally.
   */
  pauseAt(virtualMs: number): void {
    this.playhead.pauseAt(virtualMs);
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
        this.flashLayer.spawn(played_pitch, COLOUR_BAD, this._canvasWidthPx());
      }
      return;
    }

    if (played_pitch !== null && played_pitch !== undefined) {
      this.flashLayer.spawn(played_pitch, COLOUR_NEUTRAL, this._canvasWidthPx());
    }
  }

  resume(): void {
    this.playhead.resume();
  }

  /**
   * Replace the lane-geometry provider (e.g. after a piano reflow). Triggers a
   * full mesh rebuild so bar widths/positions stay aligned with the visible
   * keys.
   */
  setLaneGeometry(nextGeometry: LaneGeometry | null | undefined): void {
    if (!nextGeometry) return;
    this.laneGeometry = nextGeometry;
    this.noteFactory = new WaterfallNoteGroupFactory(
      this.laneGeometry,
      this.pxPerMs,
      this.spriteCache,
    );
    this.flashLayer.setLaneGeometry(this.laneGeometry);
    this._rebuildNotes();
  }

  setScore(scoreTimeline: ScoreTimeline): void {
    // New timeline: reset the playhead so note motion uses only this score’s
    // timing (no leftover virtual time from the last load).
    this.stop();
    this.score = scoreTimeline;
    this._rebuildNotes();
  }

  start(): void {
    this.playhead.start();
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.status = "pending";
      data.bar.material.color.copy(
        pendingColourFor(data.staff, data.pitch),
      );
    }
  }

  stop(): void {
    this.playhead.stop();
  }

  private _canvasHeightPx(): number {
    return this.canvas.clientHeight || this.canvas.height || 1;
  }

  private _canvasWidthPx(): number {
    return this.canvas.clientWidth || this.canvas.width || 1;
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
      const { group, key } = this.noteFactory.createGroup(n);
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

  private _tick(): void {
    const nowMs = this.playhead.getVirtualNowMs();
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

    this.flashLayer.tick();
    this.renderer.render(this.scene, this.camera);
  }
}

export type { NoteUserData } from "./note-group-factory";
