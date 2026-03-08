import { useEffect, useState } from "react";

/**
 * useCountdown is a reusable countdown timer hook.
 *
 * Exposes:
 * - secondsLeft: current remaining time (in seconds)
 * - isRunning: whether the timer is active
 * - start(seconds): begin countdown from a given number of seconds
 * - stop(): pause the countdown
 * - reset(): stop and reset to 0
 * - setSecondsLeft: manual override (advanced use)
 */
export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  /**
   * Effect handles the ticking logic.
   * - Runs only when the timer is active.
   * - Decrements once per second.
   * - Stops automatically when it reaches 0.
   */
  useEffect(() => {
    if (!isRunning) return;

    if (secondsLeft <= 0) {
      setIsRunning(false);
      return;
    }

    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [isRunning, secondsLeft]);

  /**
   * Starts the countdown from a specified number of seconds.
   * Ensures the value is numeric and non-negative.
   */
  function start(seconds) {
    setSecondsLeft(Math.max(0, Number(seconds || 0)));
    setIsRunning(true);
  }

  /** Pauses the countdown without resetting the remaining time. */
  function stop() {
    setIsRunning(false);
  }

  /** Stops the countdown and resets the timer to 0. */
  function reset() {
    setSecondsLeft(0);
    setIsRunning(false);
  }

  return { secondsLeft, isRunning, start, stop, reset, setSecondsLeft };
}
