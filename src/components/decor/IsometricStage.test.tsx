// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";
import { IsometricStage } from "./IsometricStage";

describe("IsometricStage", () => {
  it("renders piano art without pipeline on home variant", () => {
    const host = document.createElement("div");
    const dispose = render(() => <IsometricStage variant="home" />, host);
    expect(host.querySelector(".iso-stage__art svg")).not.toBeNull();
    expect(host.querySelector(".iso-pipeline")).toBeNull();
    dispose();
  });

  it("renders pipeline below art on load variant", () => {
    const host = document.createElement("div");
    const dispose = render(() => <IsometricStage variant="load" />, host);
    expect(host.querySelector(".iso-stage__art svg")).not.toBeNull();
    const pipeline = host.querySelector(".iso-pipeline");
    expect(pipeline).not.toBeNull();
    expect(pipeline?.textContent).toContain("MuseScore");
    expect(pipeline?.textContent).toContain("Cadenza");
    dispose();
  });
});
