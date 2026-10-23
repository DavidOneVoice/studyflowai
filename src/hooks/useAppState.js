import { useSyncExternalStore } from "react";
import { appStore } from "../lib/storage.js";

export function useAppState() {
  const snapshot = useSyncExternalStore(appStore.subscribe, appStore.getSnapshot);
  return [snapshot.state, appStore.updateState, snapshot.error];
}
