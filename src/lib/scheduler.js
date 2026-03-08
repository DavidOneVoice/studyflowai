import { toMinutes } from "./time";

/**
 * Generate study sessions between today and the latest exam date.
 *
 * Scheduling approach (v1):
 * 1) Build all available time slots (based on selected days + time window + session length).
 * 2) Compute a per-course weight:
 *      weight = workload * (1 / daysUntilExam)
 * 3) Assign each slot using a weighted rotation strategy:
 *    - each course accumulates "need" over time
 *    - the course with the highest need is chosen for the next slot
 *    - chosen course is penalized to encourage rotation across courses
 */

function isoToday() {
  const now = new Date();
  // Local date -> YYYY-MM-DD (no timezone suffix)
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns number of days between two ISO dates (YYYY-MM-DD), clamped to >= 0.
 * Uses midnight timestamps to avoid time-of-day noise.
 */
function daysBetween(aIso, bIso) {
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  const diff = b - a;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Converts a Date to a short day label used by the availability selector. */
function dayLabelFromDate(d) {
  const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return map[d.getDay()];
}

/** Returns a new Date that is `n` days after the given date (does not mutate input). */
function addDays(dateObj, n) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + n);
  return d;
}

export function generateSchedule({ courses, availability }) {
  // Validate minimal required inputs.
  if (!courses?.length)
    return { schedule: [], error: "Add at least one course." };

  const days = availability?.days || [];
  if (!days.length)
    return { schedule: [], error: "Select at least one study day." };

  const startTime = availability?.startTime || "18:00";
  const endTime = availability?.endTime || "20:00";
  const sessionMinutes = Number(availability?.sessionMinutes ?? 60);

  const startM = toMinutes(startTime);
  const endM = toMinutes(endTime);

  // Time window validation.
  if (endM <= startM) {
    return { schedule: [], error: "End time must be later than start time." };
  }
  if (sessionMinutes < 15) {
    return {
      schedule: [],
      error: "Session length must be at least 15 minutes.",
    };
  }

  // Determine how many sessions can fit into each chosen day.
  const slotsPerDay = Math.floor((endM - startM) / sessionMinutes);
  if (slotsPerDay < 1) {
    return {
      schedule: [],
      error: "Time window is too small for the session length.",
    };
  }

  // Schedule horizon runs from today until the latest exam date across courses.
  const latestExam = courses.reduce(
    (max, c) => (c.examDate > max ? c.examDate : max),
    courses[0].examDate,
  );
  const todayIso = isoToday();
  const horizonDays = daysBetween(todayIso, latestExam);

  if (horizonDays < 1) {
    return {
      schedule: [],
      error: "Your latest exam date must be in the future.",
    };
  }

  /**
   * Build all available slots from today through the horizon.
   * Slots include:
   * - date (YYYY-MM-DD)
   * - slotIndex (1-based per day)
   * - start/end minutes (from midnight)
   */
  const startDate = new Date(todayIso + "T00:00:00");
  const slots = [];
  for (let i = 0; i <= horizonDays; i++) {
    const dateObj = addDays(startDate, i);
    const dayLabel = dayLabelFromDate(dateObj);
    if (!days.includes(dayLabel)) continue;

    const iso =
      dateObj.getFullYear() +
      "-" +
      String(dateObj.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(dateObj.getDate()).padStart(2, "0");

    for (let s = 0; s < slotsPerDay; s++) {
      const start = startM + s * sessionMinutes;
      const end = start + sessionMinutes;
      slots.push({
        date: iso,
        slotIndex: s + 1,
        startMinutes: start,
        endMinutes: end,
      });
    }
  }

  /**
   * Compute per-course stats used for weighted rotation.
   * - daysUntilExam: at least 1 day to avoid division-by-zero
   * - weight: higher for heavier workload and closer exam dates
   * - need: accumulates over time to decide what gets scheduled next
   */
  const courseStats = courses.map((c) => {
    const dte = Math.max(1, daysBetween(todayIso, c.examDate));
    const weight = Number(c.workload || 5) * (1 / dte);
    return {
      id: c.id,
      name: c.name,
      examDate: c.examDate,
      workload: Number(c.workload || 5),
      daysUntilExam: dte,
      weight,
      need: weight, // initial need
    };
  });

  // Total weight is used as the "penalty" applied to the chosen course to force rotation.
  const totalWeight = courseStats.reduce((sum, c) => sum + c.weight, 0);

  /**
   * Fill each slot by repeatedly:
   * 1) Adding weight to each course's need (credit accumulation)
   * 2) Choosing the course with the highest need
   * 3) Subtracting totalWeight from the chosen course's need (rotation penalty)
   */
  const schedule = slots.map((slot) => {
    // Add "credit" each round.
    for (const cs of courseStats) cs.need += cs.weight;

    courseStats.sort((a, b) => b.need - a.need);
    const chosen = courseStats[0];

    // Subtract totalWeight to prevent the same course from dominating consecutive slots.
    chosen.need -= totalWeight;

    // Classify the session type based on proximity to the exam date.
    const daysToExam = Math.max(1, daysBetween(slot.date, chosen.examDate));

    let type = "Focused Study";
    if (daysToExam <= 3) type = "Final Review";
    else if (daysToExam <= 7) type = "Revision";

    return {
      date: slot.date,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      courseId: chosen.id,
      courseName: chosen.name,
      type,
    };
  });

  return { schedule, error: null };
}
