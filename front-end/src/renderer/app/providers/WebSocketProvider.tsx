import type { DecodedMessage } from "@shared/lib/protocol";

import { CadenzaClient } from "@shared/lib/ws-client";
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

import { DEFAULT_BACKEND_URL } from "../constants";

export type WebSocketStatus = "closed" | "error" | "idle" | "open";

export type MessageHandler = (message: DecodedMessage) => void;
export type DropHandler = (payload: unknown) => void;

export interface WebSocketContextValue {
  backendUrl: string;
  lastError: null | string;
  reconnect: (url: string) => void;
  send: (message: unknown) => boolean;
  setLastError: (err: null | string) => void;
  status: WebSocketStatus;
  subscribe: (type: "*" | string, handler: MessageHandler) => () => void;
  subscribeDropped: (handler: DropHandler) => () => void;
}

const WebSocketContext = createContext<null | WebSocketContextValue>(null);

// Preload injects the backend URL via contextBridge. Fall back to the
// hardcoded default when the preload hasn't run (e.g. during Vitest
// with jsdom), so consumers never see ``undefined`` on first render.
function resolveInitialUrl(): string {
  if (typeof window === "undefined") return DEFAULT_BACKEND_URL;
  return window.cadenza?.defaultBackendUrl ?? DEFAULT_BACKEND_URL;
}

export function WebSocketProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [backendUrl, setBackendUrl] = useState<string>(resolveInitialUrl);
  const [status, setStatus] = useState<WebSocketStatus>("idle");
  const [lastError, setLastError] = useState<null | string>(null);

  // ``messageHandlersRef`` stores { type, handler } entries so multiple
  // features can subscribe to the same inbound message without trampling
  // each other. A Set would work too but an array keeps dispatch order
  // deterministic, which matters for the diagnostic log.
  const messageHandlersRef = useRef<
    { handler: MessageHandler; type: string }[]
  >([]);
  const dropHandlersRef = useRef<DropHandler[]>([]);

  const client = useMemo(
    () => new CadenzaClient({ url: backendUrl }),
    // Rebuild the client *only* when the URL changes; status changes
    // re-render consumers without unmounting the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const onOpen = () => setStatus("open");
    const onClose = () => setStatus("closed");
    const onError = () => setStatus("error");
    const onMessage = (event: Event) => {
      const msg = (event as CustomEvent<DecodedMessage>).detail;
      for (const { handler, type } of messageHandlersRef.current) {
        if (type === "*" || type === msg.type) handler(msg);
      }
    };
    const onDropped = (event: Event) => {
      const payload = (event as CustomEvent<unknown>).detail;
      for (const handler of dropHandlersRef.current) handler(payload);
    };

    client.addEventListener("open", onOpen);
    client.addEventListener("close", onClose);
    client.addEventListener("error", onError);
    client.addEventListener("message", onMessage);
    client.addEventListener("send-dropped", onDropped);

    client.connect(backendUrl);

    return () => {
      client.removeEventListener("open", onOpen);
      client.removeEventListener("close", onClose);
      client.removeEventListener("error", onError);
      client.removeEventListener("message", onMessage);
      client.removeEventListener("send-dropped", onDropped);
      client.disconnect();
    };
  }, [client, backendUrl]);

  // Reconnection whenever the user edits the URL. We keep the same
  // client instance but tell it to tear down and reopen.
  const reconnect = useCallback(
    (nextUrl: string) => {
      const target = nextUrl?.trim();
      if (!target) return;
      setBackendUrl(target);
      setLastError(null);
      client.disconnect();
      client.connect(target);
    },
    [client],
  );

  const send = useCallback(
    (message: unknown) => client.send(message),
    [client],
  );

  // Subscribe/unsubscribe pair returned from ``subscribe`` keeps
  // consumers' ``useEffect`` cleanups symmetric. ``type`` accepts
  // ``"*"`` for a wildcard listener (used by the diagnostic log).
  const subscribe = useCallback(
    (type: "*" | string, handler: MessageHandler) => {
      const entry = { handler, type };
      messageHandlersRef.current.push(entry);
      return () => {
        messageHandlersRef.current = messageHandlersRef.current.filter(
          (e) => e !== entry,
        );
      };
    },
    [],
  );

  const subscribeDropped = useCallback((handler: DropHandler) => {
    dropHandlersRef.current.push(handler);
    return () => {
      dropHandlersRef.current = dropHandlersRef.current.filter(
        (h) => h !== handler,
      );
    };
  }, []);

  const value = useMemo<WebSocketContextValue>(
    () => ({
      backendUrl,
      lastError,
      reconnect,
      send,
      setLastError,
      status,
      subscribe,
      subscribeDropped,
    }),
    [
      backendUrl,
      status,
      lastError,
      reconnect,
      send,
      subscribe,
      subscribeDropped,
    ],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx)
    throw new Error("useWebSocket must be used inside <WebSocketProvider>");
  return ctx;
}
