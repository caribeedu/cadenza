// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import { Slider } from "./Slider";

describe("Slider", () => {
  it("renders label, display value, and range input", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <Slider
          label="Speed"
          value={1}
          displayValue="1.00×"
          min={0.25}
          max={2}
          step={0.05}
          onChange={() => undefined}
        />
      ),
      host,
    );
    expect(host.textContent).toContain("Speed");
    expect(host.textContent).toContain("1.00×");
    expect(host.querySelector('input[type="range"]')).not.toBeNull();
    dispose();
  });
});
