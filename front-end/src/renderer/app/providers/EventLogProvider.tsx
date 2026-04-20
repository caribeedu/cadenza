import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const LOG_BUFFER_LIMIT = 200;

export type LogKind = "" | "dim" | "err" | "ok" | string;

export interface LogEntry {
  id: number;
  kind: LogKind;
  message: string;
  timestamp: Date;
}

export interface EventLogContextValue {
  clear: () => void;
  entries: LogEntry[];
  log: (message: string, kind?: LogKind) => void;
}

const EventLogContext = createContext<EventLogContextValue | null>(null);

export function EventLogProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  // Auto-increment id so React keys stay stable even when two log
  // calls arrive in the same millisecond.
  const nextIdRef = useRef(1);

  const log = useCallback((message: string, kind: LogKind = "") => {
    const id = nextIdRef.current++;
    const timestamp = new Date();
    setEntries((prev) => {
      const next = [{ id, kind, message, timestamp }, ...prev];
      if (next.length > LOG_BUFFER_LIMIT) next.length = LOG_BUFFER_LIMIT;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  const value = useMemo<EventLogContextValue>(
    () => ({ clear, entries, log }),
    [entries, log, clear],
  );

  return (
    <EventLogContext.Provider value={value}>
      {children}
    </EventLogContext.Provider>
  );
}

export function useEventLog(): EventLogContextValue {
  const ctx = useContext(EventLogContext);
  if (!ctx) throw new Error("useEventLog must be used inside <EventLogProvider>");
  return ctx;
}

// Ambient subscriber: flush a "Dropped <type>" line whenever the WS
// client reports a queue overflow, so "my click vanished" surfaces in
// the log instead of nowhere.
export function useEventLogDropSubscriber(
  subscribeDropped?: (handler: (payload: unknown) => void) => () => void,
): void {
  const { log } = useEventLog();
  useEffect(() => {
    if (!subscribeDropped) return undefined;
    return subscribeDropped((payload) => {
      const type =
        (payload as null | undefined | { type?: string })?.type ?? "<unknown>";
      log(`Dropped ${type}: send queue full while WebSocket is down`, "err");
    });
  }, [subscribeDropped, log]);
}
