import test from "node:test";
import assert from "node:assert/strict";
import { createAppStore, getDefaultState, STORAGE_KEY } from "./storage.js";

function fixture(initial = getDefaultState()) {
  let raw = JSON.stringify(initial);
  let failure = false;
  const storage = {
    getItem: () => raw,
    setItem: (_key, next) => {
      if (failure) throw new DOMException("Full", "QuotaExceededError");
      raw = next;
    },
    removeItem: () => {
      if (failure) throw new Error("Storage blocked");
      raw = null;
    },
  };
  const events = new EventTarget();
  const store = createAppStore({ getStorage: () => storage, eventTarget: events });
  return {
    store,
    events,
    saved: () => JSON.parse(raw),
    replace: (next) => { raw = JSON.stringify(next); },
    corrupt: () => { raw = "{broken"; },
    fail: () => { failure = true; },
  };
}

test("functional updates preserve unrelated changes saved after the page opened", () => {
  const f = fixture();
  f.store.getSnapshot();
  f.replace({ ...getDefaultState(), quizSets: [{ id: "another-tab" }] });
  assert.equal(f.store.updateState((state) => ({ ...state, courses: [{ id: "new-course" }] })), true);
  assert.deepEqual(f.saved().quizSets, [{ id: "another-tab" }]);
  assert.deepEqual(f.saved().courses, [{ id: "new-course" }]);
});

test("quota failure preserves saved and visible data and reports failure to the draft form", () => {
  const f = fixture({ ...getDefaultState(), courses: [{ id: "saved" }] });
  const previous = f.store.getSnapshot().state;
  f.fail();
  assert.equal(f.store.updateState((state) => ({ ...state, courses: [] })), false);
  assert.deepEqual(f.saved().courses, [{ id: "saved" }]);
  assert.equal(f.store.getSnapshot().state, previous);
  assert.match(f.store.getSnapshot().error, /storage is full/i);
});

test("storage events refresh subscribers and unsubscribe removes the listener", () => {
  const f = fixture();
  let changes = 0;
  const unsubscribe = f.store.subscribe(() => { changes += 1; });
  f.replace({ ...getDefaultState(), quizSets: [{ id: "external" }] });
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: STORAGE_KEY });
  f.events.dispatchEvent(event);
  assert.equal(changes, 1);
  assert.equal(f.store.getSnapshot().state.quizSets[0].id, "external");
  unsubscribe();
  f.events.dispatchEvent(event);
  assert.equal(changes, 1);
});

test("a failed reset leaves data intact and exposes an error", () => {
  const f = fixture({ ...getDefaultState(), courses: [{ id: "saved" }] });
  f.store.getSnapshot();
  f.fail();
  assert.equal(f.store.resetState(), false);
  assert.equal(f.store.getSnapshot().state.courses.length, 1);
  assert.match(f.store.getSnapshot().error, /could not be reset/i);
});

test("unreadable saved data is not silently replaced by an empty state", () => {
  const f = fixture();
  f.corrupt();
  assert.match(f.store.getSnapshot().error, /not been overwritten/i);
  assert.equal(f.store.updateState(getDefaultState()), false);
  assert.throws(() => f.saved());
  assert.equal(f.store.resetState(), true);
  assert.equal(f.store.getSnapshot().error, "");
});

test("malformed saved collection entries expose a recoverable error without deleting the data", () => {
  for (const key of ["courses", "quizSets", "schedule"]) {
    const f = fixture({ ...getDefaultState(), [key]: [null] });
    assert.match(f.store.getSnapshot().error, /not been overwritten/i);
    assert.equal(f.store.updateState(getDefaultState()), false);
    assert.deepEqual(f.saved()[key], [null]);
  }
});
