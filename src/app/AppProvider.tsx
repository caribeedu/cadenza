import { createContext, useContext, type ParentProps } from "solid-js";
import { createAppStore, type AppStore } from "./useAppStore";

const AppStoreContext = createContext<AppStore>();

export function AppProvider(props: ParentProps) {
  const store = createAppStore();
  return (
    <AppStoreContext.Provider value={store}>{props.children}</AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStore {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppProvider");
  return ctx;
}
