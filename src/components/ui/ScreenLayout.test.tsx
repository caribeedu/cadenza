// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import { ScreenLayout } from "./ScreenLayout";

describe("ScreenLayout", () => {
  it("renders body and optional footer", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <ScreenLayout footer="Footer text">
          <p>Main content</p>
        </ScreenLayout>
      ),
      host,
    );
    expect(host.querySelector(".screen__body")?.textContent).toContain("Main content");
    expect(host.querySelector(".screen__footer")?.textContent).toBe("Footer text");
    dispose();
  });
});
