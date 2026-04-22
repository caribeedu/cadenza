import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type { LaneGeometry } from "../../types/geometry";
import type { ScoreNote } from "../../types/score";

import { pendingNoteColorHex } from "../note-hand-colors";
import { barHeightPx, isAccidental, nameForPitch, noteMeshKey } from "../timeline";
import { createNoteBarMaterial } from "./bar-material";
import {
  FINGER_HEIGHT_PX,
  FINGER_WIDTH_PX,
  LABEL_HEIGHT_PX,
  LABEL_WIDTH_PX,
} from "./constants";
import { firePendingColorForPitch } from "./fire-pending-color";
import {
  createLavaBarMaterial,
  initLavaBarFeedbackUniforms,
} from "./lava-bar-material";
import {
  classifyNoteSpriteStack,
  fingerAndLabelSpriteYs,
  labelOnlySpriteY,
  resolveFingerDigit,
} from "./note-sprite-layout";
import type { NoteSpriteMaterialCache } from "./sprite-material-cache";
import type { WaterfallTheme } from "./visual-theme";

export type NoteStatus = "bad" | "good" | "pending";

export interface NoteUserData {
  bar: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  durationMs: number;
  id?: number;
  isLava: boolean;
  pitch: number;
  staff: number;
  startMs: number;
  status: NoteStatus;
}

function pendingFillColor(
  theme: WaterfallTheme,
  staff: number,
  pitch: number,
): THREE.Color {
  if (theme === "fire") {
    return firePendingColorForPitch(pitch);
  }
  return new THREE.Color(pendingNoteColorHex(staff, pitch));
}

/** Builds rounded note bars with optional pitch / finger sprites. */
export class WaterfallNoteGroupFactory {
  constructor(
    private readonly laneGeometry: LaneGeometry,
    private readonly pxPerMs: number,
    private readonly spriteCache: NoteSpriteMaterialCache,
    private readonly theme: WaterfallTheme,
  ) {}

  private makeFingerSprite(digit: number): THREE.Sprite {
    const text = String(digit);
    const mat = this.spriteCache.getFingerMaterial(text);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(FINGER_WIDTH_PX, FINGER_HEIGHT_PX, 1);
    return sprite;
  }

  private makeLabelSprite(pitch: number): THREE.Sprite {
    const text = nameForPitch(pitch);
    const mat = this.spriteCache.getLabelMaterial(text);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(LABEL_WIDTH_PX, LABEL_HEIGHT_PX, 1);
    return sprite;
  }

  createGroup(note: ScoreNote): { group: THREE.Group; key: null | string } {
    const laneWidth = this.laneGeometry.laneWidthPx(note.pitch);
    const width = Math.max(3, laneWidth * 0.85);
    const height = barHeightPx(note.duration_ms, this.pxPerMs);
    const isBlack = isAccidental(note.pitch);
    const staff = note.staff ?? 0;
    const cornerRadius = Math.min(
      6,
      width * 0.14,
      Math.max(2, height * 0.12),
    );

    const isLava = this.theme === "fire";
    const group = new THREE.Group();
    const geom = new RoundedBoxGeometry(width, height, 2, 2, cornerRadius);
    const mat = isLava
      ? (() => {
          const m = createLavaBarMaterial(note.pitch);
          initLavaBarFeedbackUniforms(m);
          return m;
        })()
      : createNoteBarMaterial(
          pendingFillColor(this.theme, staff, note.pitch).clone(),
        );
    const bar = new THREE.Mesh(geom, mat);
    group.add(bar);
    group.renderOrder = isBlack ? 2 : 1;

    const fingerDigit = resolveFingerDigit(note.finger);
    const stack = classifyNoteSpriteStack(height, fingerDigit);

    if (stack === "finger_and_label" && fingerDigit != null) {
      const { yFinger, yName } = fingerAndLabelSpriteYs(height);
      const fSprite = this.makeFingerSprite(fingerDigit);
      fSprite.position.set(0, yFinger, 0);
      fSprite.renderOrder = 3;
      group.add(fSprite);

      const sprite = this.makeLabelSprite(note.pitch);
      sprite.position.set(0, yName, 0);
      sprite.renderOrder = 4;
      group.add(sprite);
    } else if (stack === "label_only") {
      const sprite = this.makeLabelSprite(note.pitch);
      sprite.position.set(0, labelOnlySpriteY(height), 0);
      sprite.renderOrder = 3;
      group.add(sprite);
    }

    const userData: NoteUserData = {
      bar,
      durationMs: note.duration_ms,
      id: note.id,
      isLava,
      pitch: note.pitch,
      staff,
      startMs: note.start_ms,
      status: "pending",
    };
    group.userData = userData;
    return { group, key: noteMeshKey(note) };
  }
}
