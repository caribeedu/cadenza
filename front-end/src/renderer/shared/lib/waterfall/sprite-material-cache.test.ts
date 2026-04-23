// @vitest-environment jsdom

import { DEFAULT_UI_THEME, UI_THEMES } from "@app/theme/ui-theme";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteSpriteMaterialCache } from "./sprite-material-cache";

/** jsdom has no 2D canvas; stub enough of CanvasRenderingContext2D for texture generation. */
function stubCanvas2d(): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (type) => {
      if (type !== "2d") return null;
      const noop = (): void => {};
      return {
        clearRect: noop,
        fillStyle: "",
        fillText: noop,
        font: "",
        lineJoin: "",
        lineWidth: 0,
        miterLimit: 0,
        restore: noop,
        save: noop,
        shadowBlur: 0,
        shadowColor: "",
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        strokeStyle: "",
        strokeText: noop,
        textAlign: "",
        textBaseline: "",
      } as unknown as CanvasRenderingContext2D;
    },
  );
}

const S = UI_THEMES[DEFAULT_UI_THEME].waterfall.noteSprites;

describe("NoteSpriteMaterialCache", () => {
  beforeEach(() => {
    stubCanvas2d();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the same label material instance for repeated text (cache hit)", () => {
    const cache = new NoteSpriteMaterialCache();
    const a = cache.getLabelMaterial("C", S);
    const b = cache.getLabelMaterial("C", S);
    expect(a).toBe(b);
  });

  it("returns distinct label materials for different text keys", () => {
    const cache = new NoteSpriteMaterialCache();
    const c = cache.getLabelMaterial("C", S);
    const d = cache.getLabelMaterial("D", S);
    expect(c).not.toBe(d);
  });

  it("returns the same finger material instance for repeated digit strings", () => {
    const cache = new NoteSpriteMaterialCache();
    const a = cache.getFingerMaterial("3", S);
    const b = cache.getFingerMaterial("3", S);
    expect(a).toBe(b);
  });

  it("dispose disposes label and finger materials and their textures", () => {
    const cache = new NoteSpriteMaterialCache();
    const label = cache.getLabelMaterial("E", S);
    const finger = cache.getFingerMaterial("2", S);
    const disposeLabelMap = vi.spyOn(label.map!, "dispose");
    const disposeLabelMat = vi.spyOn(label, "dispose");
    const disposeFingerMap = vi.spyOn(finger.map!, "dispose");
    const disposeFingerMat = vi.spyOn(finger, "dispose");

    cache.dispose();

    expect(disposeLabelMap).toHaveBeenCalled();
    expect(disposeLabelMat).toHaveBeenCalled();
    expect(disposeFingerMap).toHaveBeenCalled();
    expect(disposeFingerMat).toHaveBeenCalled();

    const cache2 = new NoteSpriteMaterialCache();
    const label2 = cache2.getLabelMaterial("E", S);
    expect(label2).not.toBe(label);
  });
});
