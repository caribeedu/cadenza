// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusChip } from "./StatusChip";

describe("<StatusChip>", () => {
  it("renders the label with the 'chip-on' class when state is 'on'", () => {
    render(<StatusChip label="WS: connected" state="on" />);
    const chip = screen.getByText("WS: connected");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass("chip");
    expect(chip).toHaveClass("chip-on");
  });

  it("falls back to the off palette when the state is unknown", () => {
    render(<StatusChip label="?" state="bogus" />);
    const chip = screen.getByText("?");
    expect(chip).toHaveClass("chip-off");
  });

  it("defaults to off state when no state prop is passed", () => {
    render(<StatusChip label="MIDI: none" />);
    const chip = screen.getByText("MIDI: none");
    expect(chip).toHaveClass("chip-off");
  });
});
