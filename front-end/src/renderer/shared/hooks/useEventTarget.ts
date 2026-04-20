import { type DependencyList, useEffect } from "react";

// Subscribe to a `CustomEvent` stream from any EventTarget-compatible
// object for the lifetime of the calling component. Handler identity
// is captured by the effect's dependency list so parent re-renders
// that produce new handler closures automatically re-subscribe.
export function useEventTarget<TEvent extends Event = Event>(
  target: EventTarget | null | undefined,
  eventName: string,
  handler: ((event: TEvent) => void) | null | undefined,
  deps: DependencyList = [],
): void {
  useEffect(() => {
    if (!target || !handler) return undefined;
    const listener: EventListener = (event) => handler(event as TEvent);
    target.addEventListener(eventName, listener);
    return () => target.removeEventListener(eventName, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, eventName, ...deps]);
}
