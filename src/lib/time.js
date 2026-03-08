/**
 * Converts a time string in "HH:mm" format to total minutes from midnight.
 * Example: "18:30" → 1110
 */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts total minutes from midnight back to "HH:mm" format (24-hour).
 * Example: 1110 → "18:30"
 */
export function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");

  return `${hh}:${mm}`;
}

/**
 * Restricts a number `n` within the inclusive range [min, max].
 * Commonly used to enforce safe numeric bounds.
 */
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
