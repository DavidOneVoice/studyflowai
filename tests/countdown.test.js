import test from "node:test";
import assert from "node:assert/strict";
import { createDeadlineCountdown } from "../src/lib/countdown.js";

test("missed callbacks consume real elapsed time, including background-tab expiry", () => {
  let clock = 100_000;
  const timer = createDeadlineCountdown(() => clock);
  timer.start(120);
  clock += 75_250;
  timer.tick();
  assert.equal(timer.getSnapshot().secondsLeft, 45);
  clock += 60_000;
  timer.tick();
  assert.deepEqual(timer.getSnapshot(), { secondsLeft: 0, isRunning: false, expired: true });
});

test("stop preserves actual remaining time and reset/start clears old expiry", () => {
  let clock = 0;
  const timer = createDeadlineCountdown(() => clock);
  timer.start(10);
  clock = 2_400;
  timer.stop();
  assert.deepEqual(timer.getSnapshot(), { secondsLeft: 8, isRunning: false, expired: false });
  clock = 20_000;
  timer.tick();
  assert.equal(timer.getSnapshot().secondsLeft, 8);
  timer.reset();
  assert.deepEqual(timer.getSnapshot(), { secondsLeft: 0, isRunning: false, expired: false });
  timer.start(3);
  clock += 3_000;
  timer.tick();
  timer.start(60);
  assert.deepEqual(timer.getSnapshot(), { secondsLeft: 60, isRunning: true, expired: false });
});

test("duplicate ticks do not publish unstable snapshots", () => {
  let clock = 0;
  const timer = createDeadlineCountdown(() => clock);
  let notifications = 0;
  const unsubscribe = timer.subscribe(() => notifications++);
  timer.start(10);
  const snapshot = timer.getSnapshot();
  timer.tick();
  assert.equal(timer.getSnapshot(), snapshot);
  assert.equal(notifications, 1);
  clock = 1_000;
  timer.tick();
  assert.equal(notifications, 2);
  unsubscribe();
  timer.reset();
  assert.equal(notifications, 2);
});
