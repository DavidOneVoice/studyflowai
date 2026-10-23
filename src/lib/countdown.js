// The deadline is the source of truth, even if a background tab misses ticks.
export function createDeadlineCountdown(now = Date.now) {
  let deadline = null;
  let snapshot = { secondsLeft: 0, isRunning: false, expired: false };
  const listeners = new Set();
  function publish(next) {
    if (Object.keys(next).every((key) => next[key] === snapshot[key])) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  function tick() {
    if (deadline === null) return;
    const remaining = Math.max(0, Math.ceil((deadline - now()) / 1000));
    if (!remaining) deadline = null;
    publish({ secondsLeft: remaining, isRunning: remaining > 0, expired: remaining === 0 });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    tick,
    start(seconds) {
      const numeric = Number(seconds);
      const duration = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
      deadline = now() + duration * 1000;
      tick();
    },
    stop() {
      tick();
      deadline = null;
      publish({ ...snapshot, isRunning: false });
    },
    reset() {
      deadline = null;
      publish({ secondsLeft: 0, isRunning: false, expired: false });
    },
  };
}
