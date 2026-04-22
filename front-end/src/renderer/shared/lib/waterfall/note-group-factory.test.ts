import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { UI_THEME_IDS, UI_THEMES } from "@app/theme/ui-theme";

import type { ScoreNote } from "../../types/score";
import {
  barHeightPx,
  DEFAULT_PX_PER_MS,
} from "../timeline";
import { minBarHeightForFingerPx, minBarHeightForLabelPx } from "./constants";
import { WaterfallNoteGroupFactory } from "./note-group-factory";
import type { NoteSpriteMaterialCache } from "./sprite-material-cache";

function makeMockSpriteCache(): NoteSpriteMaterialCache {
  return {
    getLabelMaterial: vi.fn(() => new THREE.SpriteMaterial()),
    getFingerMaterial: vi.fn(() => new THREE.SpriteMaterial()),
  } as unknown as NoteSpriteMaterialCache;
}

function baseNote(overrides: Partial<ScoreNote> = {}): ScoreNote {
  return {
    id: 1,
    duration_ms: 5000,
    pitch: 60,
    start_ms: 0,
    ...overrides,
  };
}

describe("WaterfallNoteGroupFactory", () => {
  const lane = {
    laneCenterPx: () => 100,
    laneWidthPx: () => 40,
  };

  const lightSprites = UI_THEMES[UI_THEME_IDS.CadenzaLight].waterfall.noteSprites;

  it("createGroup attaches userData with score fields and mesh key from id", () => {
    const factory = new WaterfallNoteGroupFactory(
      lane,
      DEFAULT_PX_PER_MS,
      makeMockSpriteCache(),
      "cadenza-light",
    );
    const { group, key } = factory.createGroup(baseNote({ id: 42 }));

    expect(key).toBe("#42");
    const ud = group.userData as {
      durationMs: number;
      pitch: number;
      staff: number;
      startMs: number;
      status: string;
    };
    expect(ud.durationMs).toBe(5000);
    expect(ud.pitch).toBe(60);
    expect(ud.staff).toBe(0);
    expect(ud.startMs).toBe(0);
    expect(ud.status).toBe("pending");
  });

  it("adds only the bar when the bar is too short for any sprite stack", () => {
    const factory = new WaterfallNoteGroupFactory(
      lane,
      DEFAULT_PX_PER_MS,
      makeMockSpriteCache(),
      "cadenza-light",
    );
    // Very short duration → bar height below label threshold
    const { group } = factory.createGroup(
      baseNote({ duration_ms: 10, finger: 1 }),
    );
    const h = barHeightPx(10, DEFAULT_PX_PER_MS);
    expect(h).toBeLessThan(minBarHeightForLabelPx(lightSprites));
    expect(group.children.length).toBe(1);
  });

  it("adds label sprite only when tall enough for label but not finger stack", () => {
    const cache = makeMockSpriteCache();
    const factory = new WaterfallNoteGroupFactory(
      lane,
      DEFAULT_PX_PER_MS,
      cache,
      "cadenza-light",
    );
    // Tall enough for a pitch label, too short for finger+label stack (see constants).
    const durationMs = 128;
    const height = barHeightPx(durationMs, DEFAULT_PX_PER_MS);
    expect(height).toBeGreaterThanOrEqual(minBarHeightForLabelPx(lightSprites));
    expect(height).toBeLessThan(minBarHeightForFingerPx(lightSprites));

    const { group } = factory.createGroup(
      baseNote({ duration_ms: durationMs, finger: null }),
    );
    expect(group.children.length).toBe(2);
    expect(cache.getLabelMaterial).toHaveBeenCalledWith(
      expect.any(String),
      lightSprites,
    );
    expect(cache.getFingerMaterial).not.toHaveBeenCalled();
  });

  it("adds finger + label sprites when height and fingering allow the stack", () => {
    const cache = makeMockSpriteCache();
    const factory = new WaterfallNoteGroupFactory(
      lane,
      DEFAULT_PX_PER_MS,
      cache,
      "cadenza-light",
    );
    const durationMs = 400;
    const height = barHeightPx(durationMs, DEFAULT_PX_PER_MS);
    expect(height).toBeGreaterThanOrEqual(minBarHeightForFingerPx(lightSprites));

    const { group } = factory.createGroup(
      baseNote({ duration_ms: durationMs, finger: 3 }),
    );
    expect(group.children.length).toBe(3);
    expect(cache.getFingerMaterial).toHaveBeenCalledWith("3", lightSprites);
    expect(cache.getLabelMaterial).toHaveBeenCalledWith(
      expect.any(String),
      lightSprites,
    );
  });

  it("sets higher renderOrder for black-key (accidental) lanes", () => {
    const factory = new WaterfallNoteGroupFactory(
      lane,
      DEFAULT_PX_PER_MS,
      makeMockSpriteCache(),
      "cadenza-light",
    );
    const white = factory.createGroup(baseNote({ pitch: 60 })).group;
    const black = factory.createGroup(baseNote({ pitch: 61 })).group;
    expect(white.renderOrder).toBe(1);
    expect(black.renderOrder).toBe(2);
  });
});
