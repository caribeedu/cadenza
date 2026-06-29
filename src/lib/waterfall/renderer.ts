import * as THREE from "three";
import type { LaneGeometry } from "../geometry";
import {
  BAR_VERTICAL_GAP_PX,
  barHeightPx,
  DEFAULT_PX_PER_MS,
  noteMeshKey,
  yForNote,
} from "../timeline";
import { applyBarFeedback, applyBarPending } from "./bar-feedback";
import { createWaterfallBloomPipeline, type WaterfallBloomPipeline } from "./bloom-pipeline";
import { applyHitLineTheme, createHitLine } from "./hit-line";
import { WaterfallImpactParticles } from "./impact-particles";
import { setLavaBarTime } from "./lava-bar-material";
import {
  InstancedNoteBars,
  shouldUseNoteInstancing,
} from "./instanced-note-bars";
import { createNoteGroup, type NoteUserData, type ScoreNote } from "./note-factory";
import { WaterfallReactiveBackground } from "./reactive-background";
import { NoteSpriteMaterialCache } from "./sprite-material-cache";
import {
  getWaterfallTheme,
  MAX_DEVICE_PIXEL_RATIO,
  WATERFALL_THEME_IDS,
  type WaterfallTheme,
  type WaterfallThemeId,
} from "./theme";
import { VirtualPlayhead } from "./virtual-playhead";

export type { WaterfallThemeId } from "./theme";

export type NotePlayed = {
  correct: boolean | null;
  played_pitch: number;
  delta_ms?: number | null;
  expected_id?: number | null;
  expected_pitch?: number | null;
  expected_time_ms?: number | null;
};

export type ScoreTimeline = {
  bpm: number;
  duration_ms: number;
  notes: ScoreNote[];
};

export class WaterfallRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly hitLine: THREE.Group;
  readonly noteGroup: THREE.Group;
  readonly noteMeshes = new Map<string, THREE.Group>();
  laneGeometry: LaneGeometry;
  score: ScoreTimeline = { bpm: 120, duration_ms: 0, notes: [] };

  private readonly playhead: VirtualPlayhead;
  private readonly pxPerMs: number;
  private readonly spriteCache = new NoteSpriteMaterialCache();
  private readonly _reactiveBg: WaterfallReactiveBackground;
  private readonly _impacts: WaterfallImpactParticles;
  private readonly _ambientLight: THREE.AmbientLight;
  private readonly _hemiLight: THREE.HemisphereLight;
  private _bloom: WaterfallBloomPipeline;
  private _themeId: WaterfallThemeId;
  private _theme: WaterfallTheme;
  private _heldPitches: number[] = [];
  private _strikeLineY = 0;
  private _lastFrameT = 0;
  private _resizeObserver: ResizeObserver;
  private _instanced: InstancedNoteBars | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    laneGeometry: LaneGeometry,
    playbackSpeed = 1,
    pxPerMs = DEFAULT_PX_PER_MS,
    themeId: WaterfallThemeId = WATERFALL_THEME_IDS.LavaStage,
  ) {
    this.canvas = canvas;
    this.laneGeometry = laneGeometry;
    this.pxPerMs = pxPerMs;
    this.playhead = new VirtualPlayhead(playbackSpeed);
    this._themeId = themeId;
    this._theme = getWaterfallTheme(themeId);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DEVICE_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this._reactiveBg = new WaterfallReactiveBackground(this._theme);
    this.scene.add(this._reactiveBg.mesh);
    this.scene.fog = new THREE.Fog(
      this._theme.fog.color,
      this._theme.fog.near,
      this._theme.fog.far * 1.06,
    );

    this._ambientLight = new THREE.AmbientLight(
      this._theme.ambientLight.color,
      this._theme.ambientLight.intensity,
    );
    this._hemiLight = new THREE.HemisphereLight(
      this._theme.hemiLight.sky,
      this._theme.hemiLight.ground,
      this._theme.hemiLight.intensity,
    );
    this.scene.add(this._ambientLight, this._hemiLight);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.hitLine = createHitLine(this._theme);
    this.hitLine.visible = false;
    this.scene.add(this.hitLine);

    this.noteGroup = new THREE.Group();
    this.scene.add(this.noteGroup);

    this._impacts = new WaterfallImpactParticles(this._theme);
    this.scene.add(this._impacts.object);

    this._bloom = createWaterfallBloomPipeline(
      this.renderer,
      this.scene,
      this.camera,
      this._theme,
    );

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  get themeId(): WaterfallThemeId {
    return this._themeId;
  }

  setTheme(themeId: WaterfallThemeId) {
    if (themeId === this._themeId) return;
    this._themeId = themeId;
    this._theme = getWaterfallTheme(themeId);

    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(this._theme.fog.color);
    fog.near = this._theme.fog.near;
    fog.far = this._theme.fog.far * 1.06;

    this._ambientLight.color.setHex(this._theme.ambientLight.color);
    this._ambientLight.intensity = this._theme.ambientLight.intensity;
    this._hemiLight.color.setHex(this._theme.hemiLight.sky);
    this._hemiLight.groundColor.setHex(this._theme.hemiLight.ground);
    this._hemiLight.intensity = this._theme.hemiLight.intensity;

    this._reactiveBg.applyTheme(this._theme);
    this._impacts.applyTheme(this._theme);
    this._instanced?.applyTheme(this._theme);
    applyHitLineTheme(this.hitLine, this._theme);

    this._bloom.dispose();
    this._bloom = createWaterfallBloomPipeline(
      this.renderer,
      this.scene,
      this.camera,
      this._theme,
    );
    const w = this._canvasWidthPx();
    const h = this.canvas.clientHeight || this.canvas.height || 1;
    const dpr = Math.min(window.devicePixelRatio, MAX_DEVICE_PIXEL_RATIO);
    this._bloom.syncSize(w, h, dpr);

    this.rebuildNotes();
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this._disposeNoteMeshes();
    this.spriteCache.dispose();
    this._impacts.dispose();
    this._reactiveBg.dispose();
    this._bloom.dispose();
    this.renderer.dispose();
  }

  setLaneGeometry(next: LaneGeometry) {
    this.laneGeometry = next;
    this.rebuildNotes();
  }

  setScore(score: ScoreTimeline) {
    this.stop();
    this.score = score;
    this.rebuildNotes();
  }

  setPlaybackSpeed(speed: number, alignToVirtualMs?: number) {
    this.playhead.setPlaybackSpeed(speed, alignToVirtualMs);
  }

  start() {
    this.playhead.start();
    this.resetBarsPending();
  }

  startAt(virtualMs: number) {
    this.playhead.startAt(virtualMs);
    this.resetBarsPending();
  }

  pauseAt(virtualMs: number) {
    this.playhead.pauseAt(virtualMs);
  }

  resume() {
    this.playhead.resume();
  }

  stop() {
    this.playhead.stop();
  }

  setHeldPitches(pitches: readonly number[]) {
    this._heldPitches = pitches.length ? [...pitches] : [];
    this._reactiveBg.setHeldKeyCount(this._heldPitches.length);
    if (this._heldPitches.length === 0) {
      this._impacts.resetSustainEmission();
    }
  }

  reportPlayback(msg: NotePlayed) {
    const w = this._canvasWidthPx();
    const { correct, played_pitch } = msg;

    if (played_pitch != null) {
      const rippleU = this.laneGeometry.laneCenterPx(played_pitch) / Math.max(1, w);
      const denom = this.camera.top - this.camera.bottom;
      const rippleV =
        denom > 1e-6 ? (this._strikeLineY - this.camera.bottom) / denom : 0.72;
      this._reactiveBg.onNotePlayed(msg, rippleU, rippleV);

      this._impacts.burst(
        this.laneGeometry.laneCenterPx(played_pitch) - w * 0.5,
        this._strikeLineY,
        16,
      );
    }

    if (correct !== true && correct !== false) return;
    const lookupKey = noteMeshKey({
      expected_id: msg.expected_id,
      expected_pitch: msg.expected_pitch,
      expected_time_ms: msg.expected_time_ms,
      pitch: played_pitch,
    });
    if (!lookupKey) return;

    if (this._instanced) {
      this._instanced.setStatusByKey(lookupKey, msg.correct ? "good" : "bad");
      return;
    }

    const group = this.noteMeshes.get(lookupKey);
    if (!group) return;
    const data = group.userData as NoteUserData;
    data.status = msg.correct ? "good" : "bad";
    applyBarFeedback(data.bar, data.isLava, this._theme, msg.correct ? "good" : "bad");
  }

  private resetBarsPending() {
    if (this._instanced) {
      this._instanced.resetAllPending();
      return;
    }
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.status = "pending";
      applyBarPending(data.bar, data.isLava, this._theme, data.staff, data.pitch);
    }
  }

  private rebuildNotes() {
    this._disposeNoteMeshes();
    this.noteGroup.clear();

    if (shouldUseNoteInstancing(this.score.notes.length, this._theme.lavaBars)) {
      this._instanced = new InstancedNoteBars(
        this.score.notes,
        this.laneGeometry,
        this.pxPerMs,
        this._theme,
      );
      this.noteGroup.add(this._instanced.mesh);
      return;
    }

    for (const n of this.score.notes) {
      const { group, key } = createNoteGroup(
        n,
        this.laneGeometry,
        this.pxPerMs,
        this.spriteCache,
        this._theme,
      );
      if (key) this.noteMeshes.set(key, group);
      this.noteGroup.add(group);
    }
  }

  private _disposeNoteMeshes() {
    if (this._instanced) {
      this._instanced.dispose();
      this._instanced = null;
    }
    for (const group of this.noteMeshes.values()) {
      const data = group.userData as NoteUserData;
      data.bar.geometry.dispose();
      (data.bar.material as THREE.Material).dispose();
    }
    this.noteMeshes.clear();
  }

  private _canvasWidthPx(): number {
    return this.canvas.clientWidth || this.canvas.width || 1;
  }

  private resize() {
    const w = this._canvasWidthPx();
    const h = this.canvas.clientHeight || this.canvas.height || 1;
    const dpr = Math.min(window.devicePixelRatio, MAX_DEVICE_PIXEL_RATIO);
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(dpr);
    this._bloom.syncSize(w, h, dpr);

    const hitLineOffset = h * 0.15;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h - hitLineOffset;
    this.camera.bottom = -hitLineOffset;
    this.camera.updateProjectionMatrix();

    this._strikeLineY = this.camera.bottom;
    this.hitLine.position.y = this._strikeLineY;

    const centerY = (this.camera.top + this.camera.bottom) * 0.5;
    this._reactiveBg.setFrustum(w, h, centerY, -8);

    this.rebuildNotes();
  }

  private tick() {
    const t = performance.now() * 0.001;
    const dt = this._lastFrameT > 0 ? t - this._lastFrameT : 0;
    this._lastFrameT = t;

    const nowMs = this.playhead.getVirtualNowMs();
    const w = this._canvasWidthPx();

    if (this._instanced) {
      this._instanced.setLavaTime(t);
      this._instanced.updateLayout(
        nowMs,
        this.laneGeometry,
        this.pxPerMs,
        this._strikeLineY,
        this.camera.bottom,
        this.camera.top,
        w,
      );
    } else {
      for (const group of this.noteMeshes.values()) {
        const data = group.userData as NoteUserData;
        if (data.isLava) {
          setLavaBarTime(data.bar.material as THREE.ShaderMaterial, t);
        }
        const hPx = barHeightPx(data.durationMs, this.pxPerMs, BAR_VERTICAL_GAP_PX);
        const y =
          yForNote({ nowMs, pxPerMs: this.pxPerMs, startMs: data.startMs }) +
          hPx / 2 +
          this._strikeLineY;
        const x = this.laneGeometry.laneCenterPx(data.pitch) - w / 2;
        group.position.set(x, y, 0);
        group.visible = y > this.camera.bottom - 50 && y < this.camera.top + 50;
      }
    }

    if (this._heldPitches.length > 0) {
      const xs: number[] = [];
      for (const p of this._heldPitches) {
        xs.push(this.laneGeometry.laneCenterPx(p) - w * 0.5);
      }
      this._impacts.streamHeldLanes(xs, this._strikeLineY, dt, 36);
    }

    this._impacts.tick(dt);
    this._reactiveBg.tick(dt);
    this._bloom.composer.render();
  }
}
