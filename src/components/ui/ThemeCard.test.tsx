// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it, vi } from "vitest";
import { ThemeCard, ThemeGrid } from "./ThemeCard";
import { WATERFALL_THEME_IDS } from "../../lib/waterfall/theme";

describe("ThemeCard", () => {
  it("marks selected theme", () => {
    const host = document.createElement("div");
    const onSelect = vi.fn();
    const dispose = render(
      () => (
        <ThemeCard
          id={WATERFALL_THEME_IDS.LavaStage}
          selected
          onSelect={onSelect}
        />
      ),
      host,
    );
    const card = host.querySelector(".theme-card");
    expect(card?.className).toContain("theme-card--selected");
    expect(card?.getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("Lava stage");
    dispose();
  });
});

describe("ThemeGrid", () => {
  it("renders a card per theme id", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <ThemeGrid
          ids={[WATERFALL_THEME_IDS.LavaStage, WATERFALL_THEME_IDS.AuroraIce]}
          selected={WATERFALL_THEME_IDS.AuroraIce}
          onSelect={() => undefined}
        />
      ),
      host,
    );
    expect(host.querySelectorAll(".theme-card").length).toBe(2);
    dispose();
  });
});
