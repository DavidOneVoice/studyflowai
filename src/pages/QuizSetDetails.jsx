import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../hooks/useAppState";
import { getBestAttempt } from "../lib/practiceSession";
import ConfirmModal from "../components/common/ConfirmModal";
import QuizSetupModal from "../components/quiz/QuizSetupModal";
import { API_BASE } from "../lib/api";
import "./QuizSetDetails.css";

function getQueryParam(name) {
  const hash = window.location.hash || "";
  const q = hash.split("?")[1] || "";
  const params = new URLSearchParams(q);
  return params.get(name) || "";
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function QuizSetDetails() {
  const [state, setState] = useAppState();
  const setId = getQueryParam("setId");
  const [setupOpen, setSetupOpen] = useState(() => getQueryParam("start") === "1");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [pendingSummary, setPendingSummary] = useState("");
  const pendingRequest = useRef(false);
  const mounted = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const set = useMemo(() => {
    return (state.quizSets || []).find((s) => s?.id === setId) || null;
  }, [state.quizSets, setId]);

  const attempts = Array.isArray(set?.attempts)
    ? set.attempts.filter((attempt) => attempt && typeof attempt === "object" && !Array.isArray(attempt))
    : [];
  const best = getBestAttempt(attempts);
  const lastAttempt = attempts[0] || null;

  function go(to) {
    window.location.hash = `#/${to}`;
  }

  function goToNotes() {
    window.location.hash = `#/notes?setId=${encodeURIComponent(setId)}`;
  }

  function persistSummary(summary) {
    const saved = setState((previous) => {
      if (!previous.quizSets?.some((item) => item?.id === setId)) {
        throw new Error("This practice set was removed. Return to the library to choose another set.");
      }
      return {
        ...previous,
        quizSets: previous.quizSets.map((item) => item?.id === setId ? { ...item, summary } : item),
      };
    });
    if (saved) goToNotes();
    else {
      setPendingSummary(summary);
      setError("Your summary is ready but could not be saved. Retry saving after resolving the storage error.");
    }
  }

  async function generateSummary() {
    if (!set || pendingRequest.current) return;
    if (set.summary) { goToNotes(); return; }
    if (pendingSummary) { persistSummary(pendingSummary); return; }
    pendingRequest.current = true;
    setBusy("summary");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: set.title, sourceText: set.sourceText }),
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error("The server returned an unreadable response. Please try again."); }
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The server returned an unreadable response. Please try again.");
      if (!response.ok) throw new Error(data.error || "Summary generation failed.");
      const summary = typeof data.summary === "string" ? data.summary.trim() : "";
      if (!summary) throw new Error("AI returned an empty note. Please try again.");
      if (mounted.current) persistSummary(summary);
    } catch (error) {
      if (mounted.current) setError(error?.message || "Summary generation failed.");
    } finally {
      pendingRequest.current = false;
      if (mounted.current) setBusy("");
    }
  }

  function startPractice() {
    setSetupOpen(true);
  }

  function clearAttempts() {
    if (!set) return;
    setConfirmClearOpen(true);
  }

  async function handleExportPdf() {
    if (!set || pendingRequest.current) return;

    const latestAttempt = lastAttempt;
    const questions =
      (Array.isArray(set.questions) && set.questions.length
        ? set.questions
        : latestAttempt?.questionsSnapshot) || [];

    if (!questions.length) {
      setError("No questions available to export yet. Start practice first.");
      return;
    }

    try {
      setError("");
      pendingRequest.current = true;
      setBusy("pdf");
      const { exportQuestionsAsPdf } = await import("../lib/quizPdf");
      await exportQuestionsAsPdf({ title: set.title, questions });
    } catch (e) {
      if (mounted.current) setError(e?.message || "Export failed. Please try again.");
    } finally {
      pendingRequest.current = false;
      if (mounted.current) setBusy("");
    }
  }

  function handleClearConfirmed() {
    if (!set) return;

    const saved = setState((prev) => ({
      ...prev,
      quizSets: (prev.quizSets || []).map((x) =>
        x?.id === setId ? { ...x, attempts: [] } : x,
      ),
    }));

    if (saved) setConfirmClearOpen(false);
  }

  if (!setId) {
    return (
      <section className="qsdCard card">
        <h2 className="qsdTitle">Practice Set</h2>
        <p className="qsdMuted">No practice set selected.</p>
        <button
          className="qsdGhost"
          type="button"
          onClick={() => go("library")}
        >
          Back to Library
        </button>
      </section>
    );
  }

  if (!set) {
    return (
      <section className="qsdCard card">
        <h2 className="qsdTitle">Practice Set</h2>
        <p className="qsdMuted">This practice set could not be found.</p>
        <button
          className="qsdGhost"
          type="button"
          onClick={() => go("library")}
        >
          Back to Library
        </button>
      </section>
    );
  }

  return (
    <div className="qsdPage">
      <section className="qsdCard card">
        <div className="qsdHeader">
          <div>
            <div className="qsdBadge">Practice Set</div>
            <h2 className="qsdSetTitle">{set.title}</h2>

            <div className="qsdStatusRow">
              <span className="qsdPill">
                Questions are generated when you start
              </span>

              <span className={set.summary ? "qsdPill ok2" : "qsdPill"}>
                {set.summary ? "Summary ready" : "No Summary yet"}
              </span>

              <span className="qsdPill">
                {attempts.length
                  ? `${attempts.length} attempt(s)`
                  : "No attempts yet"}
              </span>

              {best ? (
                <span className="qsdPill">
                  Best: <strong>{best.score}/{best.total}</strong> ({Math.round(Number(best.score) / Number(best.total) * 100)}%)
                </span>
              ) : null}

              {lastAttempt?.takenAt ? (
                <span className="qsdPill">
                  Last: <strong>{fmtDate(lastAttempt.takenAt)}</strong>
                </span>
              ) : null}
            </div>
          </div>

          <div className="qsdActions">
            <button
              className="qsdPrimary"
              type="button"
              onClick={startPractice}
              disabled={Boolean(busy)}
            >
              Start Practice
            </button>

            <button
              className="qsdGhost"
              type="button"
              onClick={generateSummary}
              disabled={Boolean(busy)}
            >
              {busy === "summary"
                ? "Generating Summary..."
                : pendingSummary
                  ? "Retry Saving Summary"
                : set.summary
                  ? "View Summary"
                  : "Generate Summary"}
            </button>

            <button
              className="qsdGhost"
              type="button"
              onClick={handleExportPdf}
              disabled={Boolean(busy)}
            >
              {busy === "pdf" ? "Preparing PDF..." : "Export Questions as PDF"}
            </button>

            {attempts.length > 0 && (
              <button
                className="qsdDanger"
                type="button"
                onClick={clearAttempts}
                disabled={Boolean(busy)}
              >
                Clear Attempts
              </button>
            )}

            <button
              className="qsdGhost"
              type="button"
              onClick={() => go("library")}
              disabled={Boolean(busy)}
            >
              Back to Library
            </button>
          </div>
        </div>

        {getQueryParam("intent") === "summary" && !set.summary && (
          <p className="qsdMuted">Your material is saved. Select Generate Summary to create your notes.</p>
        )}
        {error && <div className="qsdError" role="alert">{error}</div>}
      </section>

      <section className="qsdAttempts">
        <div className="qsdAttemptsTop">
          <div className="qsdAttemptsTitle">Recent Attempts</div>
          <div className="qsdAttemptsHint">Saved locally in this browser</div>
        </div>

        {attempts.length === 0 ? (
          <div className="qsdEmpty">
            <div className="qsdEmptyIcon" aria-hidden="true" />
            <div>
              <div className="qsdEmptyTitle">No attempts yet</div>
              <div className="qsdEmptySub">
                Start a practice session to begin tracking your progress.
              </div>
            </div>
          </div>
        ) : (
          <div className="qsdAttemptGrid">
            {attempts.slice(0, 4).map((a, idx) => (
              <div className="qsdAttemptCard" key={a.id}>
                <div className="qsdAttemptLeft">
                  <div className="qsdAttemptLabel">
                    Attempt #{attempts.length - idx}
                  </div>
                  <div className="qsdAttemptDate">{fmtDate(a.takenAt)}</div>
                </div>

                <div className="qsdAttemptRight">
                  <div className="qsdAttemptScore">
                    Score:{" "}
                    <strong>
                      {a.score} / {a.total}
                    </strong>
                  </div>
                  <div className="qsdAttemptTime">
                    Time: <strong>{a.minutesPlanned || "-"} mins</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={confirmClearOpen}
        title="Clear attempts?"
        message="This will delete all saved attempts for this practice set in this browser. This cannot be undone."
        confirmText="Yes, clear"
        cancelText="Cancel"
        danger
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={handleClearConfirmed}
      />

      <QuizSetupModal
        open={setupOpen}
        title="Start Practice"
        setTitle={set.title}
        defaultCount={10}
        onClose={() => setSetupOpen(false)}
        onStart={({ count, minutes }) => {
          setSetupOpen(false);
          window.location.hash = `#/cbt?setId=${encodeURIComponent(setId)}&count=${count}&mins=${minutes}`;
        }}
      />
    </div>
  );
}
