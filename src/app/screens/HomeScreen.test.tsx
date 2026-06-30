// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "solid-js/web";
import { AppProvider } from "../AppProvider";
import { HomeScreen } from "./HomeScreen";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => undefined)),
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders theme cards and continue button", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    render(
      () => (
        <AppProvider>
          <HomeScreen onContinue={() => undefined} />
        </AppProvider>
      ),
      root,
    );

    await Promise.resolve();

    expect(root.textContent).toContain("Cadenza");
    expect(root.textContent).toContain("Lava stage");
    expect(root.textContent).toContain("Aurora ice");
    expect(root.querySelector(".home-continue")).not.toBeNull();
    expect(root.querySelectorAll(".theme-card").length).toBe(2);

    root.remove();
  });
});
