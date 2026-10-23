import { useEffect, useState, useSyncExternalStore } from "react";
import { createDeadlineCountdown } from "../lib/countdown.js";

export function useCountdown() {
  const [timer] = useState(() => createDeadlineCountdown());
  const snapshot = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);

  useEffect(() => {
    if (!snapshot.isRunning) return;
    const interval = window.setInterval(timer.tick, 1000);
    document.addEventListener("visibilitychange", timer.tick);
    window.addEventListener("focus", timer.tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", timer.tick);
      window.removeEventListener("focus", timer.tick);
    };
  }, [timer, snapshot.isRunning]);

  return { ...snapshot, start: timer.start, stop: timer.stop, reset: timer.reset };
}
