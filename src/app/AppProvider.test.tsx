// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import { AppProvider } from "./AppProvider";

describe("AppProvider", () => {
  it("provides store to children", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <p class="child">ok</p>
        </AppProvider>
      ),
      root,
    );
    expect(root.querySelector(".child")?.textContent).toBe("ok");
    root.remove();
  });
});
