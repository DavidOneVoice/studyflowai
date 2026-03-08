import { useEffect, useMemo, useState } from "react";
import { loadState } from "../lib/storage";
import { fromMinutes } from "../lib/time";
import "./Schedule.css";

/**
 * Schedule page:
 * - Displays the generated study schedule from localStorage state
 * - Supports filtering by course
 * - Supports copying/exporting schedule as TXT or CSV
 *
 * Note: This page only reads from storage (no saveState call here),
 * and refreshes its state whenever the hash route changes.
 */
export default function Schedule() {
  const [state, setState] = useState(() => loadState());
  const [filterCourseId, setFilterCourseId] = useState("");
  const [copied, setCopied] = useState(false);

  /**
   * Refresh state whenever hash route changes (planner -> schedule, etc.)
   * This ensures the schedule view always reflects the latest saved data.
   */
  useEffect(() => {
    function onHashChange() {
      setState(loadState());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  /**
   * Auto-hide the "Copied" UI flag after a short delay.
   */
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  // Pull schedule/courses from persisted state.
  const schedule = useMemo(() => state.schedule || [], [state.schedule]);
  const courses = useMemo(() => state.courses || [], [state.courses]);

  /**
   * Safety: if a course was deleted, hide any leftover schedule entries
   * that reference missing courseIds.
   */
  const validCourseIds = useMemo(
    () => new Set(courses.map((c) => c.id)),
    [courses],
  );

  const cleanedSchedule = useMemo(() => {
    return schedule.filter((s) => validCourseIds.has(s.courseId));
  }, [schedule, validCourseIds]);

  /**
   * Filtered schedule based on selected course (optional).
   */
  const filtered = useMemo(() => {
    if (!filterCourseId) return cleanedSchedule;
    return cleanedSchedule.filter((s) => s.courseId === filterCourseId);
  }, [cleanedSchedule, filterCourseId]);

  /**
   * If the currently selected filter course no longer exists, reset the filter.
   */
  useEffect(() => {
    if (!filterCourseId) return;
    if (!validCourseIds.has(filterCourseId)) setFilterCourseId("");
  }, [filterCourseId, validCourseIds]);

  /**
   * Downloads a string as a file in the browser.
   * Uses an object URL backed by a Blob.
   */
  function downloadFile(filename, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  /**
   * Serializes schedule sessions into a human-friendly TXT format.
   */
  function toScheduleTxt(sc) {
    const lines = sc.map((s) => {
      const time = `${fromMinutes(s.startMinutes)}–${fromMinutes(s.endMinutes)}`;
      return `${s.date} | ${time} | ${s.courseName} | ${s.type}`;
    });

    return [
      "CramLess — Generated Study Schedule",
      "----------------------------------",
      ...lines,
    ].join("\n");
  }

  /**
   * Escapes a value for safe CSV output.
   * Wraps in quotes if it contains commas, quotes, or newlines.
   */
  function escapeCsv(v) {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /**
   * Serializes schedule sessions into CSV format for Excel/Sheets.
   */
  function toScheduleCsv(sc) {
    const header = ["Date", "Start", "End", "Course", "Type"];

    const rows = sc.map((s) => [
      s.date,
      fromMinutes(s.startMinutes),
      fromMinutes(s.endMinutes),
      s.courseName || "",
      s.type || "",
    ]);

    return [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
  }

  const hasSchedule = cleanedSchedule.length > 0;

  return (
    <div className="schPage">
      <section className="schCard card">
        <header className="schHeader">
          <div>
            <div className="schBadge">Schedule</div>
            <h2 className="schTitle">Your Study Schedule</h2>
            <p className="schSub">
              A clean view of your generated sessions. Filter, copy, and export
              anytime.
            </p>
          </div>

          <div className="schHeaderActions">
            <button
              className="schGhost"
              type="button"
              onClick={() => (window.location.hash = "#/planner")}
            >
              Back to Planner
            </button>
          </div>
        </header>

        {!hasSchedule ? (
          // Empty state when no schedule exists yet.
          <div className="schEmpty">
            <div className="schEmptyIcon" aria-hidden="true" />
            <div>
              <div className="schEmptyTitle">No schedule yet</div>
              <div className="schEmptySub">
                Go to Planner and click “Generate Schedule”.
              </div>
              <button
                className="schPrimary schCTA"
                type="button"
                onClick={() => (window.location.hash = "#/planner")}
              >
                Go to Planner
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="schToolbar">
              <div className="schFilter field">
                <label>Filter by course (optional)</label>
                <select
                  value={filterCourseId}
                  onChange={(e) => setFilterCourseId(e.target.value)}
                >
                  <option value="">All courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schTools">
                <div className="schToolRow">
                  {/* Copy schedule to clipboard in TXT format */}
                  <button
                    className="schGhost"
                    type="button"
                    disabled={!filtered.length}
                    onClick={async () => {
                      if (!filtered.length) return;
                      const txt = toScheduleTxt(filtered);
                      try {
                        await navigator.clipboard.writeText(txt);
                      } finally {
                        setCopied(true);
                      }
                    }}
                  >
                    Copy
                  </button>

                  {/* Export schedule as TXT */}
                  <button
                    className="schGhost"
                    type="button"
                    disabled={!filtered.length}
                    onClick={() => {
                      if (!filtered.length) return;
                      const txt = toScheduleTxt(filtered);
                      downloadFile("cramless-schedule.txt", txt, "text/plain");
                    }}
                  >
                    Export TXT
                  </button>

                  {/* Export schedule as CSV (Excel-friendly) */}
                  <button
                    className="schGhost"
                    type="button"
                    disabled={!filtered.length}
                    onClick={() => {
                      if (!filtered.length) return;
                      const csv = toScheduleCsv(filtered);
                      downloadFile("cramless-schedule.csv", csv, "text/csv");
                    }}
                  >
                    Export CSV
                  </button>

                  {copied && <span className="schCopied">Copied ✅</span>}
                </div>

                <div className="schCount">
                  Showing <strong>{filtered.length}</strong> session(s)
                </div>
              </div>
            </div>

            <div className="schTableWrap">
              <div className="table schTable">
                <div className="row head schedule">
                  <div>Date</div>
                  <div>Time</div>
                  <div>Course</div>
                  <div>Type</div>
                </div>

                {filtered.map((s, idx) => {
                  // Used to style "today" and "past" rows.
                  const todayIso = new Date().toISOString().slice(0, 10);
                  const isToday = s.date === todayIso;
                  const isPast = s.date < todayIso;

                  return (
                    <div
                      className={[
                        "row",
                        "schedule",
                        isToday ? "isToday" : "",
                        isPast ? "isPast" : "",
                      ].join(" ")}
                      key={idx}
                    >
                      <div>{s.date}</div>
                      <div>
                        {fromMinutes(s.startMinutes)}–
                        {fromMinutes(s.endMinutes)}
                      </div>
                      <div>{s.courseName}</div>
                      <div>{s.type}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="schFoot">
              Tip: Export CSV if you want to open it in Excel.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
