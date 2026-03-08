const STORAGE_KEY = "cramless_v1";

/**
 * Expected persisted state shape:
 * {
 *   courses: [],
 *   availability: {
 *     days: string[],
 *     startTime: "HH:mm",
 *     endTime: "HH:mm",
 *     sessionMinutes: number
 *   },
 *   schedule: [],
 *   quizSets: []
 * }
 */

function getDefaultState() {
  return {
    courses: [],
    availability: {
      days: [], // e.g. ["Mon", "Tue"]
      startTime: "18:00",
      endTime: "20:00",
      sessionMinutes: 60,
    },
    schedule: [],
    quizSets: [],
  };
}

/**
 * Loads app state from localStorage.
 * If nothing exists (or parsing fails), returns a safe default state.
 * Also merges defaults so missing keys in older saved data won't crash the app.
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);

    // Basic safety merge (so missing fields don’t crash)
    const base = getDefaultState();
    return {
      ...base,
      ...parsed,
      availability: { ...base.availability, ...(parsed.availability || {}) },
    };
  } catch (err) {
    console.error("loadState error:", err);
    return getDefaultState();
  }
}

/**
 * Saves the provided state object into localStorage.
 * Returns true on success, false if saving fails.
 */
export function saveState(state) {
  try {
    if (!state || typeof state !== "object") return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error("saveState error:", err);
    return false;
  }
}

/**
 * Clears the persisted app state from localStorage.
 * Useful for logout flows or "factory reset" behavior.
 */
export function resetState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("resetState error:", err);
  }
}
