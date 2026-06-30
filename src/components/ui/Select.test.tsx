// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("renders label, trigger, and option buttons", () => {
    const host = document.createElement("div");
    const onChange = vi.fn();
    const dispose = render(
      () => (
        <Select
          label="Device"
          value="a"
          options={[
            { value: "", label: "Pick…" },
            { value: "a", label: "Port A" },
          ]}
          onChange={onChange}
        />
      ),
      host,
    );
    expect(host.textContent).toContain("Device");
    expect(host.textContent).toContain("Port A");
    expect(host.querySelector(".select-trigger")).not.toBeNull();
    expect(host.querySelector(".select-wrap")).not.toBeNull();
    dispose();
  });
});
