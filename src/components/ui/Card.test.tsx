// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children inside card container", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <Card glow class="custom">
          Card body
        </Card>
      ),
      host,
    );
    const card = host.querySelector(".card");
    expect(card?.textContent).toContain("Card body");
    expect(card?.className).toContain("card--glow");
    expect(card?.className).toContain("custom");
    dispose();
  });
});
