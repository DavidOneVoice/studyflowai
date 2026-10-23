import { toMinutes } from "./time.js";
import { dateToIso, isoToDate } from "./dateHelpers.js";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Calendar dates, rather than elapsed local milliseconds, avoid DST off-by-one errors.
export function daysBetween(aIso, bIso) {
  const toDay = (iso) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  return Math.max(0, toDay(bIso) - toDay(aIso));
}

export function generateSchedule({ courses, availability, now = new Date() }) {
  const fail = (error) => ({ schedule: [], error });
  if (!Array.isArray(courses) || !courses.length) return fail("Add at least one course.");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return fail("The current date is invalid.");

  const days = Array.isArray(availability?.days) ? availability.days : [];
  if (!days.some((day) => DAY_LABELS.includes(day))) return fail("Select at least one study day.");
  const startMinutes = toMinutes(availability?.startTime ?? "18:00");
  const endMinutes = toMinutes(availability?.endTime ?? "20:00");
  const sessionMinutes = Number(availability?.sessionMinutes ?? 60);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return fail("Choose valid start and end times.");
  }
  if (endMinutes <= startMinutes) return fail("End time must be later than start time.");
  if (!Number.isInteger(sessionMinutes) || sessionMinutes < 15) {
    return fail("Session length must be a whole number of at least 15 minutes.");
  }
  const slotsPerDay = Math.floor((endMinutes - startMinutes) / sessionMinutes);
  if (slotsPerDay < 1) return fail("Time window is too small for the session length.");

  if (courses.some((course) => !course?.id || !course.name || !isoToDate(course.examDate)
    || !Number.isFinite(Number(course.workload)) || Number(course.workload) <= 0)) {
    return fail("Check each subject's name, exam date, and workload before generating a plan.");
  }

  const today = dateToIso(now);
  const stats = courses.filter((course) => course.examDate >= today)
    .map((course) => ({ ...course, workload: Number(course.workload), need: 0 }));
  if (!stats.length) return fail("Add a subject with an exam today or in the future.");
  const latestExam = stats.reduce((latest, course) => course.examDate > latest ? course.examDate : latest, today);
  const horizon = daysBetween(today, latestExam);
  const firstDay = isoToDate(today);
  const schedule = [];

  for (let offset = 0; offset <= horizon; offset += 1) {
    const day = new Date(firstDay);
    day.setDate(day.getDate() + offset);
    if (!days.includes(DAY_LABELS[day.getDay()])) continue;
    const date = dateToIso(day);
    // No exam time is collected, so the exam date itself remains eligible.
    const eligible = stats.filter((course) => course.examDate >= date);
    if (!eligible.length) continue;
    const weights = eligible.map((course) => course.workload / Math.max(1, daysBetween(date, course.examDate)));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    for (let slot = 0; slot < slotsPerDay; slot += 1) {
      const start = startMinutes + slot * sessionMinutes;
      const sessionStart = new Date(day);
      sessionStart.setHours(Math.floor(start / 60), start % 60, 0, 0);
      if (sessionStart.getTime() < now.getTime()) continue;

      let chosen = eligible[0];
      eligible.forEach((course, index) => {
        course.need += weights[index] / totalWeight;
        if (course.need > chosen.need) chosen = course;
      });
      chosen.need -= 1;
      const remainingDays = daysBetween(date, chosen.examDate);
      schedule.push({
        date,
        startMinutes: start,
        endMinutes: start + sessionMinutes,
        courseId: chosen.id,
        courseName: chosen.name,
        type: remainingDays <= 3 ? "Final Review" : remainingDays <= 7 ? "Revision" : "Focused Study",
      });
    }
  }
  return schedule.length
    ? { schedule, error: null }
    : fail("No future study sessions fit before your exams. Choose another study day or time.");
}
