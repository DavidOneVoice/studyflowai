import test from "node:test";
import assert from "node:assert/strict";
import { daysBetween, generateSchedule } from "./scheduler.js";
import { dateToIso, isoToDate } from "./dateHelpers.js";

const availability = {
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  startTime: "09:00", endTime: "12:00", sessionMinutes: 60,
};
const course = (id, examDate, workload = 5) => ({ id, name: id, examDate, workload });

test("each subject stops receiving study sessions after its own exam", () => {
  const courses = [course("early", "2026-06-02", 10), course("later", "2026-06-06")];
  const result = generateSchedule({ courses, availability, now: new Date(2026, 5, 1, 8) });
  assert.equal(result.error, null);
  assert.ok(result.schedule.some((session) => session.courseId === "early"));
  for (const session of result.schedule) {
    assert.ok(session.date <= courses.find((item) => item.id === session.courseId).examDate);
    assert.equal(session.endMinutes - session.startMinutes, 60);
  }
  assert.ok(result.schedule.filter((session) => session.date > "2026-06-02").every((session) => session.courseId === "later"));
});

test("today's elapsed sessions are skipped while later sessions still fit", () => {
  const result = generateSchedule({ courses: [course("today", "2026-06-01")], availability, now: new Date(2026, 5, 1, 10, 15) });
  assert.equal(result.error, null);
  assert.deepEqual(result.schedule.map((session) => session.startMinutes), [660]);
});

test("past exams and nonmatching study days return actionable errors", () => {
  const now = new Date(2026, 5, 1, 8);
  assert.match(generateSchedule({ courses: [course("past", "2026-05-31")], availability, now }).error, /future/);
  assert.match(generateSchedule({ courses: [course("today", "2026-06-01")], availability: { ...availability, days: ["Sun"] }, now }).error, /No future study sessions/);
});

test("invalid times, lengths, and dates cannot create malformed or endless schedules", () => {
  const base = { courses: [course("valid", "2026-06-06")], availability, now: new Date(2026, 5, 1, 8) };
  for (const change of [{ sessionMinutes: NaN }, { sessionMinutes: 0 }, { sessionMinutes: Infinity }, { startTime: "25:00" }, { endTime: "bad" }]) {
    assert.ok(generateSchedule({ ...base, availability: { ...availability, ...change } }).error);
  }
  assert.equal(isoToDate("2026-02-30"), null);
  assert.ok(generateSchedule({ ...base, courses: [course("bad", "2026-02-30")] }).error);
});

test("calendar-day urgency is independent of daylight-saving transitions", () => {
  assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
  assert.equal(daysBetween("2026-10-31", "2026-11-02"), 2);
  assert.equal(dateToIso(new Date(2026, 5, 1, 0, 15)), "2026-06-01");
});
