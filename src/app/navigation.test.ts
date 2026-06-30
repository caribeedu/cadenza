import { describe, expect, it } from "vitest";
import { continueTarget, shouldAutoNavigateToPlayer } from "./navigation";

describe("navigation", () => {
  it("continueTarget routes to load without score", () => {
    expect(continueTarget(false)).toBe("load");
  });

  it("continueTarget routes to player with score", () => {
    expect(continueTarget(true)).toBe("player");
  });

  it("shouldAutoNavigateToPlayer when score arrives on load or home", () => {
    expect(shouldAutoNavigateToPlayer(true, "load")).toBe(true);
    expect(shouldAutoNavigateToPlayer(true, "home")).toBe(true);
    expect(shouldAutoNavigateToPlayer(true, "player")).toBe(false);
    expect(shouldAutoNavigateToPlayer(false, "load")).toBe(false);
  });
});
