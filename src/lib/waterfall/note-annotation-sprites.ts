import * as THREE from "three";
import type { LaneGeometry } from "../geometry";
import { barHeightPx, yForNote } from "../timeline";
import {
  classifyNoteSpriteStack,
  fingerAndLabelSpriteYs,
  labelOnlySpriteY,
  resolveFingerDigit,
} from "./note-sprite-layout";
import type { ScoreNote } from "./note-factory";
import type { NoteSpriteMaterialCache } from "./sprite-material-cache";
import type { WaterfallTheme } from "./theme";

type AnnotationEntry = {
  durationMs: number;
  group: THREE.Group;
  pitch: number;
  startMs: number;
};

/** Finger/name sprites for instanced bar mode (bars alone omit annotations). */
export class NoteAnnotationSprites {
  readonly group = new THREE.Group();
  private readonly _entries: AnnotationEntry[] = [];
  private readonly _cache: NoteSpriteMaterialCache;
  private readonly _pxPerMs: number;

  constructor(
    notes: ScoreNote[],
    cache: NoteSpriteMaterialCache,
    theme: WaterfallTheme,
    pxPerMs: number,
  ) {
    this._cache = cache;
    this._pxPerMs = pxPerMs;
    const sprites = theme.noteSprites;

    for (const note of notes) {
      const height = barHeightPx(note.duration_ms, pxPerMs);
      const fingerDigit = resolveFingerDigit(note.finger);
      const stack = classifyNoteSpriteStack(height, fingerDigit, sprites);
      if (stack === "none") continue;

      const group = new THREE.Group();
      if (stack === "finger_and_label" && fingerDigit != null) {
        const { yFinger, yName } = fingerAndLabelSpriteYs(height, sprites);
        const finger = this._makeFingerSprite(fingerDigit, sprites);
        finger.position.set(0, yFinger, 0);
        finger.renderOrder = 3;
        group.add(finger);

        const label = this._makeLabelSprite(note.pitch, sprites);
        label.position.set(0, yName, 0);
        label.renderOrder = 4;
        group.add(label);
      } else if (stack === "label_only") {
        const label = this._makeLabelSprite(note.pitch, sprites);
        label.position.set(0, labelOnlySpriteY(height, sprites), 0);
        label.renderOrder = 3;
        group.add(label);
      }

      this.group.add(group);
      this._entries.push({
        durationMs: note.duration_ms,
        group,
        pitch: note.pitch,
        startMs: note.start_ms,
      });
    }
  }

  clearVisible(): void {
    for (const entry of this._entries) {
      entry.group.visible = false;
    }
  }

  updateLayout(
    nowMs: number,
    laneGeometry: LaneGeometry,
    strikeLineY: number,
    cameraBottom: number,
    cameraTop: number,
    canvasWidth: number,
  ): void {
    for (const entry of this._entries) {
      const hPx = barHeightPx(entry.durationMs, this._pxPerMs);
      const y =
        yForNote({ nowMs, pxPerMs: this._pxPerMs, startMs: entry.startMs }) +
        hPx / 2 +
        strikeLineY;
      const x = laneGeometry.laneCenterPx(entry.pitch) - canvasWidth / 2;
      entry.group.position.set(x, y, 0);
      entry.group.visible = y > cameraBottom - 50 && y < cameraTop + 50;
    }
  }

  dispose(): void {
    this.group.clear();
    this._entries.length = 0;
  }

  private _makeFingerSprite(
    digit: number,
    sprites: WaterfallTheme["noteSprites"],
  ): THREE.Sprite {
    const mat = this._cache.getFingerMaterial(String(digit), sprites);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(sprites.fingerWidthPx, sprites.fingerHeightPx, 1);
    return sprite;
  }

  private _makeLabelSprite(
    pitch: number,
    sprites: WaterfallTheme["noteSprites"],
  ): THREE.Sprite {
    const mat = this._cache.getLabelMaterial(pitch, sprites);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(sprites.labelWidthPx, sprites.labelHeightPx, 1);
    sprite.userData.pitch = pitch;
    return sprite;
  }
}
