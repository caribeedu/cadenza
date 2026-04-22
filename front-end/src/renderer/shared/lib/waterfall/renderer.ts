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

import {
  BAR_VERTICAL_GAP_PX,
  barHeightPx,
  DEFAULT_LEAD_MS,
  DEFAULT_PX_PER_MS,
  noteMeshKey,
  yForNote,
} from "../timeline";

import { applyBarFeedback, applyBarPending, feedbackColor } from "./bar-feedback";
import { createWaterfallBloomPipeline } from "./bloom-pipeline";
import { WaterfallFlashLayer } from "./flash-layer";
import { createHitLine } from "./hit-line";
import { WaterfallImpactParticles } from "./impact-particles";
import { setLavaBarTime } from "./lava-bar-material";
import type { NoteUserData } from "./note-group-factory";
import { WaterfallNoteGroupFactory } from "./note-group-factory";
import { NoteSpriteMaterialCache } from "./sprite-material-cache";
import {
  MAX_DEVICE_PIXEL_RATIO,
  visualThemeConfig,
} from "./visual-theme";
import type { WaterfallTheme } from "./visual-theme";
import { VirtualPlayhead } from "./virtual-playhead";

export interface WaterfallOptions {
  leadMs?: number;
  /** ``hand`` = per-hand “study” colours; ``fire`` = warm stage (default). */
  theme?: WaterfallTheme;
  playbackSpeed?: number;
  pxPerMs?: number;
}

const DEFAULT_PLAYBACK_SPEED = 1.0;
const DEFAULT_THEME: WaterfallTheme = "cadenza-dark";

export class WaterfallRenderer {
  readonly camera: THREE.OrthographicCamera;
  readonly canvas: HTMLCanvasElement;
  readonly flashGroup: THREE.Group;
  /** Play line: additive band + hot core. */
  readonly hitLine: THREE.Group;
  laneGeometry: LaneGeometry;
  readonly leadMs: number;
  readonly noteGroup: THREE.Group;
  readonly noteMeshes: Map<string, THREE.Group> = new Map();
  readonly pxPerMs: number;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  score: ScoreTimeline = { bpm: 120, duration_ms: 0, notes: [] };

  private readonly _bloom: ReturnType<typeof createWaterfallBloomPipeline>;
  /**
   * World Y of the hit line (px). Placed just inside the bottom of the
   * waterfall so it lines up with the top of the piano keys below the canvas.
   */
  private _strikeLineY = 0;
  /** Pitches with physical keys down; see {@link setHeldPitches}. */
  private _heldPitches: number[] = [];
  /** Seconds; ``0`` means "no prior frame" for delta. */
  private _lastFrameT = 0;
  private readonly _impacts: WaterfallImpactParticles;
  private readonly playhead: VirtualPlayhead;
  private readonly spriteCache = new NoteSpriteMaterialCache();
  private noteFactory: WaterfallNoteGroupFactory;
  private readonly _theme: WaterfallTheme;
  private readonly flashLayer: WaterfallFlashLayer;
  private readonly _resizeObserver: ResizeObserver;

  constructor(
    canvas: HTMLCanvasElement,
    laneGeometry: LaneGeometry,
    {
      leadMs = DEFAULT_LEAD_MS,
      playbackSpeed = DEFAULT_PLAYBACK_SPEED,
      pxPerMs = DEFAULT_PX_PER_MS,
      theme = DEFAULT_THEME,
    }: WaterfallOptions = {},
  ) {
    if (!laneGeometry) {
      throw new Error("WaterfallRenderer requires a lane-geometry provider");
    }

    this.canvas = canvas;
    this.laneGeometry = laneGeometry;
    this.pxPerMs = pxPerMs;
    this.leadMs = leadMs;
    this._theme = theme;
    const themeConfig = visualThemeConfig(this._theme);
    const speed =
      playbackSpeed > 0 ? playbackSpeed : DEFAULT_PLAYBACK_SPEED;
    this.playhead = new VirtualPlayhead(speed);

    this.noteFactory = new WaterfallNoteGroupFactory(
      this.laneGeometry,
      this.pxPerMs,
      this.spriteCache,
      this._theme,
    );
    this.flashLayer = new WaterfallFlashLayer(this.laneGeometry);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, MAX_DEVICE_PIXEL_RATIO),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(themeConfig.background);
    this.scene.fog = new THREE.Fog(
      themeConfig.fog.color,
      themeConfig.fog.near,
      themeConfig.fog.far,
    );

    const amb = new THREE.AmbientLight(
      themeConfig.ambientLight.color,
      themeConfig.ambientLight.intensity,
    );
    const hemi = new THREE.HemisphereLight(
      themeConfig.hemiLight.sky,
      themeConfig.hemiLight.ground,
      themeConfig.hemiLight.intensity,
    );
    this.scene.add(amb, hemi);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

    this.hitLine = createHitLine(this._theme);
    this.scene.add(this.hitLine);

    this.noteGroup = new THREE.Group();
    this.scene.add(this.noteGroup);

    this.flashGroup = this.flashLayer.group;
    this.scene.add(this.flashGroup);

    this._impacts = new WaterfallImpactParticles(this._theme);
    this.scene.add(this._impacts.object);

    this._bloom = createWaterfallBloomPipeline(
      this.renderer,
      this.scene,
      this.camera,
      themeConfig,
    );

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

  get theme(): WaterfallTheme {
    return this._theme;
  }

  destroy(): void {
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this._bloom.dispose();
    this._impacts.dispose();
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

  setPlaybackSpeed(nextSpeed: number, alignToVirtualMs?: number): void {
    this.playhead.setPlaybackSpeed(nextSpeed, alignToVirtualMs);
  }

  syncToElapsedMs(virtualMs: number): void {
    this.playhead.syncToElapsedMs(virtualMs);
  }

  startAt(virtualMs: number): void {
    this.playhead.startAt(virtualMs);
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.status = "pending";
      applyBarPending(
        data.bar,
        data.isLava,
        this._theme,
        data.staff,
        data.pitch,
      );
    }
  }

  pauseAt(virtualMs: number): void {
    this.playhead.pauseAt(virtualMs);
  }

  reportPlayback(msg: NotePlayed): void {
    const { correct, played_pitch } = msg;
    const w = this._canvasWidthPx();

    if (played_pitch !== null && played_pitch !== undefined) {
      this._impacts.burst(
        this.laneGeometry.laneCenterPx(played_pitch) - w * 0.5,
        this._strikeLineY,
        16,
      );
    }

    if (correct === true || correct === false) {
      const key = noteMeshKey(msg);
      const group = key != null ? this.noteMeshes.get(key) : null;
      if (group) {
        const data = group.userData as NoteUserData;
        if (correct) {
          data.status = "good";
          applyBarFeedback(data.bar, data.isLava, this._theme, "good");
        } else {
          data.status = "bad";
          applyBarFeedback(data.bar, data.isLava, this._theme, "bad");
        }
        return;
      }
      if (correct === false && played_pitch !== null && played_pitch !== undefined) {
        this.flashLayer.spawn(played_pitch, feedbackColor(this._theme, "bad"), w);
      }
      return;
    }

    if (played_pitch !== null && played_pitch !== undefined) {
      this.flashLayer.spawn(played_pitch, feedbackColor(this._theme, "neutral"), w);
    }
  }

  /**
   * Which MIDI pitches are still held, matching server ``note_played`` /
   * ``note_off`` (and legacy ``note_released``) pairs. Drives sustain sparks.
   */
  setHeldPitches(pitches: readonly number[]): void {
    this._heldPitches = pitches.length ? [...pitches] : [];
    if (this._heldPitches.length === 0) {
      this._impacts.resetSustainEmission();
    }
  }

  resume(): void {
    this.playhead.resume();
  }

  setLaneGeometry(nextGeometry: LaneGeometry | null | undefined): void {
    if (!nextGeometry) return;
    this.laneGeometry = nextGeometry;
    this.noteFactory = new WaterfallNoteGroupFactory(
      this.laneGeometry,
      this.pxPerMs,
      this.spriteCache,
      this._theme,
    );
    this.flashLayer.setLaneGeometry(this.laneGeometry);
    this._rebuildNotes();
  }

  setScore(scoreTimeline: ScoreTimeline): void {
    this.stop();
    this.score = scoreTimeline;
    this._rebuildNotes();
  }

  start(): void {
    this.playhead.start();
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.status = "pending";
      applyBarPending(
        data.bar,
        data.isLava,
        this._theme,
        data.staff,
        data.pitch,
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
    const dpr = Math.min(window.devicePixelRatio, MAX_DEVICE_PIXEL_RATIO);
    this.renderer.setPixelRatio(dpr);
    this._bloom.syncSize(w, h, dpr);

    const hitLineOffset = h * 0.15;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h - hitLineOffset;
    this.camera.bottom = -hitLineOffset;
    this.camera.updateProjectionMatrix();

    const keyTopPadPx = 0;
    this._strikeLineY = this.camera.bottom + keyTopPadPx;
    this.hitLine.position.y = this._strikeLineY;
    this.flashLayer.setStrikeLineY(this._strikeLineY);

    this._rebuildNotes();
  }

  private _tick(): void {
    const t = performance.now() * 0.001;
    const dt = this._lastFrameT > 0 ? t - this._lastFrameT : 0;
    this._lastFrameT = t;

    const nowMs = this.playhead.getVirtualNowMs();
    const w = this._canvasWidthPx();

    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      const { durationMs, pitch, startMs, isLava, bar } = data;
      if (isLava) {
        setLavaBarTime(bar.material as THREE.ShaderMaterial, t);
      }
      const hPx = barHeightPx(durationMs, this.pxPerMs, BAR_VERTICAL_GAP_PX);
      const y =
        yForNote({ nowMs, pxPerMs: this.pxPerMs, startMs }) +
        hPx / 2 +
        this._strikeLineY;
      const x = this.laneGeometry.laneCenterPx(pitch) - w / 2;
      group.position.set(x, y, 0);
      group.visible = y > this.camera.bottom - 50 && y < this.camera.top + 50;
    }

    for (const p of this._heldPitches) {
      const x = this.laneGeometry.laneCenterPx(p) - w * 0.5;
      this._impacts.streamAtLine(x, this._strikeLineY, dt, 36);
    }

    this.flashLayer.tick();
    this._impacts.tick(dt);
    this._bloom.composer.render();
  }
}

export type { NoteUserData } from "./note-group-factory";
export type { WaterfallTheme } from "./visual-theme";
