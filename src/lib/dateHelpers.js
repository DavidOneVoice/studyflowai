/**
 * Converts an ISO date string (YYYY-MM-DD) to a JavaScript Date object.
 * Returns null if the input is missing or invalid.
 */
export function isoToDate(iso) {
  if (!iso) return null;

  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;

  // Month is zero-based in JavaScript Date (0 = January).
  return new Date(y, m - 1, d);
}

/**
 * Converts a valid Date object to ISO format (YYYY-MM-DD).
 * Returns an empty string if the date is invalid.
 */
export function dateToIso(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converts a time string in "HH:mm" format to a Date object
 * using today's date as the base.
 * Invalid values default to 00:00.
 */
export function hhmmToDate(hhmm) {
  const base = new Date();

  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map(Number);

  base.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);

  return base;
}

/**
 * Converts a Date object to "HH:mm" (24-hour format).
 * Returns "00:00" if the date is invalid.
 */
export function dateToHHmm(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "00:00";

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${hh}:${mm}`;
}
