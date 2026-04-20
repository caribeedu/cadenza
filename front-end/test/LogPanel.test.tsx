// @vitest-environment jsdom

import {
  EventLogProvider,
  LOG_BUFFER_LIMIT,
  useEventLog,
} from "@app/providers/EventLogProvider";
import { LogPanel } from "@shared/components/LogPanel";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

interface DriverApi {
  clear: () => void;
  log: (message: string, kind?: string) => void;
}

function LogDriver({
  onReady,
}: {
  onReady: (api: DriverApi) => void;
}): null {
  const { clear, log } = useEventLog();
  onReady({ clear, log });
  return null;
}

describe("<LogPanel>", () => {
  it("renders log entries newest-first with their kind as class name", () => {
    let api: DriverApi | null = null;

    render(
      <EventLogProvider>
        <LogDriver onReady={(value) => (api = value)} />
        <LogPanel />
      </EventLogProvider>,
    );

    act(() => {
      api!.log("first", "ok");
      api!.log("second", "err");
    });

    const panels = screen.getAllByText(/first|second/);
    expect(panels).toHaveLength(2);
    expect(panels[0].textContent).toContain("second");
    expect(panels[0]).toHaveClass("err");
    expect(panels[1].textContent).toContain("first");
    expect(panels[1]).toHaveClass("ok");
  });

  it("caps the buffer at the provider's limit so long sessions stay bounded", () => {
    let api: DriverApi | null = null;

    render(
      <EventLogProvider>
        <LogDriver onReady={(value) => (api = value)} />
        <LogPanel />
      </EventLogProvider>,
    );

    act(() => {
      for (let i = 0; i < LOG_BUFFER_LIMIT + 50; ++i) api!.log(`line-${i}`);
    });

    const matches = screen.queryAllByText(/^.*line-\d+$/);
    expect(matches.length).toBeLessThanOrEqual(LOG_BUFFER_LIMIT);
  });
});
