import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type { NoteSpritesDims } from "@app/theme/ui-theme";

import type { LaneGeometry } from "../../types/geometry";
import type { ScoreNote } from "../../types/score";

import { pendingNoteColorHex } from "../note-hand-colors";
import { barHeightPx, isAccidental, nameForPitch, noteMeshKey } from "../timeline";
import { createNoteBarMaterial } from "./bar-material";
import { pendingColorForTheme } from "./fire-pending-color";
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
import { visualThemeConfig, type WaterfallTheme } from "./visual-theme";

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
  if (visualThemeConfig(theme).pendingColorMode === "gradient") {
    return pendingColorForTheme(theme, pitch);
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

  private makeFingerSprite(digit: number, sprites: NoteSpritesDims): THREE.Sprite {
    const text = String(digit);
    const mat = this.spriteCache.getFingerMaterial(text, sprites);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(sprites.fingerWidthPx, sprites.fingerHeightPx, 1);
    return sprite;
  }

  private makeLabelSprite(pitch: number, sprites: NoteSpritesDims): THREE.Sprite {
    const text = nameForPitch(pitch);
    const mat = this.spriteCache.getLabelMaterial(text, sprites);
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(sprites.labelWidthPx, sprites.labelHeightPx, 1);
    return sprite;
  }

  createGroup(note: ScoreNote): { group: THREE.Group; key: null | string } {
    const wf = visualThemeConfig(this.theme);
    const laneWidth = this.laneGeometry.laneWidthPx(note.pitch);
    const bg = wf.noteBarGeometry;
    const sprites = wf.noteSprites;
    const width = Math.max(3, laneWidth * bg.laneWidthFactor);
    const height = barHeightPx(note.duration_ms, this.pxPerMs);
    const isBlack = isAccidental(note.pitch);
    const staff = note.staff ?? 0;
    const cornerRadius = Math.min(
      bg.cornerRadiusCap,
      width * bg.cornerRadiusWidthFactor,
      Math.max(bg.cornerRadiusHeightMin, height * bg.cornerRadiusHeightFactor),
    );

    const isLava = wf.lavaBars;
    const group = new THREE.Group();
    const geom = new RoundedBoxGeometry(
      width,
      height,
      bg.depth,
      2,
      cornerRadius,
    );
    const mat = isLava
      ? (() => {
          const m = createLavaBarMaterial(note.pitch, this.theme);
          initLavaBarFeedbackUniforms(m, this.theme);
          return m;
        })()
      : createNoteBarMaterial(
          pendingFillColor(this.theme, staff, note.pitch).clone(),
        );
    const bar = new THREE.Mesh(geom, mat);
    group.add(bar);
    group.renderOrder = isBlack ? 2 : 1;

    const fingerDigit = resolveFingerDigit(note.finger);
    const stack = classifyNoteSpriteStack(height, fingerDigit, sprites);

    if (stack === "finger_and_label" && fingerDigit != null) {
      const { yFinger, yName } = fingerAndLabelSpriteYs(height, sprites);
      const fSprite = this.makeFingerSprite(fingerDigit, sprites);
      fSprite.position.set(0, yFinger, 0);
      fSprite.renderOrder = 3;
      group.add(fSprite);

      const sprite = this.makeLabelSprite(note.pitch, sprites);
      sprite.position.set(0, yName, 0);
      sprite.renderOrder = 4;
      group.add(sprite);
    } else if (stack === "label_only") {
      const sprite = this.makeLabelSprite(note.pitch, sprites);
      sprite.position.set(0, labelOnlySpriteY(height, sprites), 0);
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
