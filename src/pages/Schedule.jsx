import { useEffect, useMemo, useState } from "react";
import { loadState } from "../lib/storage";
import { fromMinutes } from "../lib/time";
import "./Schedule.css";

export default function Schedule() {
  const [state, setState] = useState(() => loadState());
  const [filterCourseId, setFilterCourseId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onHashChange() {
      setState(loadState());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const schedule = useMemo(() => state.schedule || [], [state.schedule]);
  const courses = useMemo(() => state.courses || [], [state.courses]);

  const validCourseIds = useMemo(
    () => new Set(courses.map((c) => c.id)),
    [courses],
  );

  const cleanedSchedule = useMemo(() => {
    return schedule.filter((s) => validCourseIds.has(s.courseId));
  }, [schedule, validCourseIds]);

  const filtered = useMemo(() => {
    if (!filterCourseId) return cleanedSchedule;
    return cleanedSchedule.filter((s) => s.courseId === filterCourseId);
  }, [cleanedSchedule, filterCourseId]);

  useEffect(() => {
    if (!filterCourseId) return;
    if (!validCourseIds.has(filterCourseId)) setFilterCourseId("");
  }, [filterCourseId, validCourseIds]);

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

  function toScheduleTxt(sc) {
    const lines = sc.map((s) => {
      const time = `${fromMinutes(s.startMinutes)}–${fromMinutes(s.endMinutes)}`;
      return `${s.date} | ${time} | ${s.courseName} | ${s.type}`;
    });

    return [
      "StudyFlow AI — Study Plan",
      "-------------------------",
      ...lines,
    ].join("\n");
  }

  function escapeCsv(v) {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toScheduleCsv(sc) {
    const header = ["Date", "Start", "End", "Subject", "Session Type"];

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
            <div className="schBadge">Study Plan</div>
            <h2 className="schTitle">Your reading schedule</h2>
            <p className="schSub">
              View your generated study sessions, filter by subject, and export
              your plan anytime.
            </p>
          </div>

          <div className="schHeaderActions">
            <button
              className="schGhost"
              type="button"
              onClick={() => (window.location.hash = "#/plan")}
            >
              Back to Study Plan
            </button>
          </div>
        </header>

        {!hasSchedule ? (
          <div className="schEmpty">
            <div className="schEmptyIcon" aria-hidden="true" />
            <div>
              <div className="schEmptyTitle">No study plan yet</div>
              <div className="schEmptySub">
                Go to Study Plan and generate your reading schedule.
              </div>
              <button
                className="schPrimary schCTA"
                type="button"
                onClick={() => (window.location.hash = "#/plan")}
              >
                Go to Study Plan
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="schToolbar">
              <div className="schFilter field">
                <label>Filter by subject</label>
                <select
                  value={filterCourseId}
                  onChange={(e) => setFilterCourseId(e.target.value)}
                >
                  <option value="">All subjects</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schTools">
                <div className="schToolRow">
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

                  <button
                    className="schGhost"
                    type="button"
                    disabled={!filtered.length}
                    onClick={() => {
                      if (!filtered.length) return;
                      const txt = toScheduleTxt(filtered);
                      downloadFile(
                        "studyflow-study-plan.txt",
                        txt,
                        "text/plain",
                      );
                    }}
                  >
                    Export TXT
                  </button>

                  <button
                    className="schGhost"
                    type="button"
                    disabled={!filtered.length}
                    onClick={() => {
                      if (!filtered.length) return;
                      const csv = toScheduleCsv(filtered);
                      downloadFile("studyflow-study-plan.csv", csv, "text/csv");
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
                  <div>Subject</div>
                  <div>Session Type</div>
                </div>

                {filtered.map((s, idx) => {
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
              Tip: Export CSV if you want to open your study plan in Excel.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
