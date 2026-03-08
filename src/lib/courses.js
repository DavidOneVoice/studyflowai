/**
 * Validates a course object before creation.
 *
 * Rules:
 * - Name must exist and be at least 2 characters.
 * - Exam date must be provided.
 * - Workload must be a number between 1 and 10.
 *
 * Returns an array of error messages (empty if valid).
 */
export function validateCourse(course) {
  const errors = [];

  if (!course.name || course.name.trim().length < 2) {
    errors.push("Course name is required (min 2 characters).");
  }

  if (!course.examDate) {
    errors.push("Exam date is required.");
  }

  const workload = Number(course.workload);
  if (Number.isNaN(workload) || workload < 1 || workload > 10) {
    errors.push("Workload must be a number between 1 and 10.");
  }

  return errors;
}

/**
 * Creates a normalized course object.
 *
 * - Generates a unique id using crypto.randomUUID().
 * - Trims the course name.
 * - Ensures workload is stored as a number.
 * - Adds a createdAt timestamp (ISO string).
 */
export function makeCourse({ name, examDate, workload }) {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    examDate,
    workload: Number(workload),
    createdAt: new Date().toISOString(),
  };
}
