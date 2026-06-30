// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children and applies variant classes", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <Button variant="primary" size="lg" class="extra">
          Go
        </Button>
      ),
      host,
    );
    const btn = host.querySelector("button");
    expect(btn?.textContent).toBe("Go");
    expect(btn?.className).toContain("btn--primary");
    expect(btn?.className).toContain("btn--lg");
    expect(btn?.className).toContain("extra");
    dispose();
  });

  it("defaults to standard button styling", () => {
    const host = document.createElement("div");
    const dispose = render(() => <Button>Click</Button>, host);
    const btn = host.querySelector("button");
    expect(btn?.className).toContain("btn");
    expect(btn?.className).not.toContain("btn--primary");
    dispose();
  });
});
