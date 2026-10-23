export const STORAGE_KEY = "cramless_v1";

export function getDefaultState() {
  return {
    courses: [],
    availability: {
      days: [],
      startTime: "18:00",
      endTime: "20:00",
      sessionMinutes: 60,
    },
    schedule: [],
    quizSets: [],
  };
}

function normalizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saved data is not a valid study plan.");
  }
  const defaults = getDefaultState();
  for (const key of ["courses", "quizSets", "schedule"]) {
    if (value[key] === undefined) continue;
    if (!Array.isArray(value[key]) || value[key].some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) {
      throw new Error(`Saved ${key} data is malformed.`);
    }
  }
  const availability = value.availability && typeof value.availability === "object"
    ? value.availability
    : {};
  return {
    ...defaults,
    ...value,
    courses: Array.isArray(value.courses) ? value.courses : [],
    quizSets: Array.isArray(value.quizSets) ? value.quizSets : [],
    schedule: Array.isArray(value.schedule) ? value.schedule : [],
    availability: {
      ...defaults.availability,
      ...availability,
      days: Array.isArray(availability.days) ? availability.days : [],
    },
  };
}

function errorMessage(error, action) {
  if (error?.name === "QuotaExceededError") {
    return "Your browser storage is full. Your latest changes were not saved. Keep this page open and free some browser storage, then try again.";
  }
  if (action === "read") {
    return "Your saved study data could not be read. It has not been overwritten. Check browser storage access or restore a backup before making changes.";
  }
  return action === "reset"
    ? "Your saved data could not be reset. Please check browser storage access and try again."
    : "Your changes could not be saved. Keep this page open, check browser storage access, and try again.";
}

/** A single store shared by every page; dependencies are injectable for offline tests. */
export function createAppStore({
  getStorage = () => globalThis.localStorage,
  eventTarget = globalThis.window,
} = {}) {
  let snapshot;
  const listeners = new Set();

  function readState() {
    const raw = getStorage().getItem(STORAGE_KEY);
    return raw === null ? getDefaultState() : normalizeState(JSON.parse(raw));
  }

  function getSnapshot() {
    if (!snapshot) {
      try {
        snapshot = { state: readState(), error: "" };
      } catch (error) {
        snapshot = { state: getDefaultState(), error: errorMessage(error, "read") };
      }
    }
    return snapshot;
  }

  function publish(state, error = "") {
    snapshot = { state, error };
    for (const listener of listeners) listener();
  }

  function fail(error, action) {
    publish(getSnapshot().state, errorMessage(error, action));
    return false;
  }

  function updateState(updater) {
    let latest;
    try {
      // Read at commit time to preserve other pages' and tabs' saved changes.
      latest = readState();
    } catch (error) {
      return fail(error, "read");
    }
    try {
      const next = normalizeState(typeof updater === "function" ? updater(latest) : updater);
      getStorage().setItem(STORAGE_KEY, JSON.stringify(next));
      publish(next);
      return true;
    } catch (error) {
      return fail(error, "save");
    }
  }

  function resetState() {
    try {
      getStorage().removeItem(STORAGE_KEY);
      publish(getDefaultState());
      return true;
    } catch (error) {
      return fail(error, "reset");
    }
  }

  function onStorage(event) {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try {
      publish(readState());
    } catch (error) {
      fail(error, "read");
    }
  }

  function subscribe(listener) {
    if (listeners.size === 0) eventTarget?.addEventListener("storage", onStorage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) eventTarget?.removeEventListener("storage", onStorage);
    };
  }

  return { getSnapshot, subscribe, updateState, resetState };
}

export const appStore = createAppStore();
export const loadState = () => appStore.getSnapshot().state;
export const saveState = appStore.updateState;
export const resetState = appStore.resetState;
