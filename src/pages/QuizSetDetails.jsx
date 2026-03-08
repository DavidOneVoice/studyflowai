import { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "../lib/storage";
import ConfirmModal from "../components/common/ConfirmModal";
import QuizSetupModal from "../components/quiz/QuizSetupModal";
import { API_BASE } from "../lib/api";
import "./QuizSetDetails.css";

/**
 * Reads a query parameter from the hash portion of the URL.
 * Expected format: #/route?key=value&key2=value2
 */
function getQueryParam(name) {
  const hash = window.location.hash || "";
  const q = hash.split("?")[1] || "";
  const params = new URLSearchParams(q);
  return params.get(name) || "";
}

/**
 * Formats an ISO date/time string into a readable local date/time string.
 * Falls back to the input string if parsing fails.
 */
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * QuizSetDetails page:
 * - Shows a single saved quiz set summary (status pills + attempts)
 * - Lets user start a quiz (via QuizSetupModal)
 * - Lets user generate/view an AI summary
 * - Lets user clear attempts (with confirmation)
 *
 * Note: all data is stored locally in this browser via localStorage state.
 */
export default function QuizSetDetails() {
  const [state, setState] = useState(() => loadState());
  const setId = getQueryParam("setId");

  // Modals + UI state
  const [setupOpen, setSetupOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Busy/error state for async actions (e.g. summary generation)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /**
   * Persist state whenever it changes.
   */
  useEffect(() => {
    saveState(state);
  }, [state]);

  /**
   * Resolve the selected quiz set by id from local state.
   */
  const set = useMemo(() => {
    return (state.quizSets || []).find((s) => s.id === setId) || null;
  }, [state.quizSets, setId]);

  // Attempts summary metrics
  const attempts = Array.isArray(set?.attempts) ? set.attempts : [];
  const best = attempts.reduce(
    (acc, a) => Math.max(acc, Number(a.score || 0)),
    0,
  );
  const lastAttempt = attempts[0] || null;

  /** Simple hash navigation helper. */
  function go(to) {
    window.location.hash = `#/${to}`;
  }

  /** Navigates to the summaries page for this quiz set. */
  function goToSummaries() {
    window.location.hash = `#/summaries?setId=${setId}`;
  }

  /**
   * Generates an AI summary for this quiz set (if not already present).
   * If summary already exists, just navigates to the summaries page.
   */
  async function generateSummary() {
    if (!set) return;

    // If already exists, just open it.
    if (set.summary) {
      goToSummaries();
      return;
    }

    try {
      setBusy(true);
      setError("");

      const r = await fetch(`${API_BASE}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: set.title, sourceText: set.sourceText }),
      });

      // Read as text first to handle non-JSON server responses gracefully.
      const raw = await r.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Server returned a non-JSON response." };
      }

      if (!r.ok) {
        setError(data.error || "Summary failed.");
        return;
      }

      const summary = String(data.summary || "").trim();
      if (!summary) {
        setError("AI returned an empty summary.");
        return;
      }

      /**
       * Update React state and localStorage together.
       * Then navigate after saving so the Summaries page can load immediately.
       */
      setState((prev) => {
        const nextState = {
          ...prev,
          quizSets: (prev.quizSets || []).map((x) =>
            x.id === setId ? { ...x, summary } : x,
          ),
        };

        saveState(nextState);

        // Navigate AFTER saving (microtask) to ensure the new summary is available.
        setTimeout(() => goToSummaries(), 0);

        return nextState;
      });
    } catch (e) {
      setError(e?.message || "Summary failed.");
    } finally {
      setBusy(false);
    }
  }

  /** Opens the quiz setup modal (count + time selection). */
  function takeQuiz() {
    setSetupOpen(true);
  }

  /** Opens the confirmation modal for clearing attempts. */
  function clearAttempts() {
    if (!set) return;
    setConfirmClearOpen(true);
  }

  /**
   * Clears all attempts for this quiz set after confirmation.
   * (This affects only local browser storage.)
   */
  function handleClearConfirmed() {
    if (!set) return;

    setState((prev) => ({
      ...prev,
      quizSets: (prev.quizSets || []).map((x) =>
        x.id === setId ? { ...x, attempts: [] } : x,
      ),
    }));

    setConfirmClearOpen(false);
  }

  // Guard: missing setId in URL.
  if (!setId) {
    return (
      <section className="qsdCard card">
        <h2 className="qsdTitle">Quiz Set Details</h2>
        <p className="qsdMuted">No set selected.</p>
        <button
          className="qsdGhost"
          type="button"
          onClick={() => go("quizSets")}
        >
          Back to Quiz Sets
        </button>
      </section>
    );
  }

  // Guard: setId exists but set cannot be found (possibly deleted).
  if (!set) {
    return (
      <section className="qsdCard card">
        <h2 className="qsdTitle">Quiz Set Details</h2>
        <p className="qsdMuted">Set not found (maybe deleted).</p>
        <button
          className="qsdGhost"
          type="button"
          onClick={() => go("quizSets")}
        >
          Back to Quiz Sets
        </button>
      </section>
    );
  }

  const questionCount = (set.questions || []).length;

  return (
    <div className="qsdPage">
      <section className="qsdCard card">
        <div className="qsdHeader">
          <div>
            <div className="qsdBadge">Quiz Set</div>
            <h2 className="qsdSetTitle">{set.title}</h2>

            <div className="qsdStatusRow">
              {/* Questions status */}
              <span className={questionCount ? "qsdPill ok" : "qsdPill"}>
                {questionCount
                  ? `${questionCount} questions ready`
                  : "No questions yet"}
              </span>

              {/* Summary status */}
              <span className={set.summary ? "qsdPill ok2" : "qsdPill"}>
                {set.summary ? "Summary ready" : "No summary yet"}
              </span>

              {/* Attempts status */}
              <span className="qsdPill">
                {attempts.length
                  ? `${attempts.length} attempt(s)`
                  : "No attempts yet"}
              </span>

              {/* Best score badge */}
              {attempts.length ? (
                <span className="qsdPill">
                  Best: <strong>{best}</strong>/{lastAttempt?.total || "-"}
                </span>
              ) : null}

              {/* Last attempt timestamp */}
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
              onClick={takeQuiz}
              disabled={busy}
            >
              Take Quiz
            </button>

            <button
              className="qsdGhost"
              type="button"
              onClick={generateSummary}
              disabled={busy}
            >
              {busy
                ? "Working..."
                : set.summary
                  ? "View Summary"
                  : "Generate Summary"}
            </button>

            {/* Only show clear attempts when there is at least one attempt */}
            {attempts.length > 0 && (
              <button
                className="qsdDanger"
                type="button"
                onClick={clearAttempts}
                disabled={busy}
              >
                Clear Attempts
              </button>
            )}

            <button
              className="qsdGhost"
              type="button"
              onClick={() => go("quizSets")}
              disabled={busy}
            >
              Back to Quiz Sets
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && <div className="qsdError">{error}</div>}
      </section>

      <section className="qsdAttempts">
        <div className="qsdAttemptsTop">
          <div className="qsdAttemptsTitle">Recent Attempts</div>
          <div className="qsdAttemptsHint">Stored locally in this browser</div>
        </div>

        {/* Empty state for attempts */}
        {attempts.length === 0 ? (
          <div className="qsdEmpty">
            <div className="qsdEmptyIcon" aria-hidden="true" />
            <div>
              <div className="qsdEmptyTitle">No attempts yet</div>
              <div className="qsdEmptySub">
                Take a quiz to start tracking your progress.
              </div>
            </div>
          </div>
        ) : (
          <div className="qsdAttemptGrid">
            {/* Display up to 4 most recent attempts */}
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

      {/* Confirmation for clearing attempts */}
      <ConfirmModal
        open={confirmClearOpen}
        title="Clear attempts?"
        message="This will delete all attempts for this quiz set in this browser. This cannot be undone."
        confirmText="Yes, clear"
        cancelText="Cancel"
        danger
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={handleClearConfirmed}
      />

      {/* Setup modal for starting a quiz */}
      <QuizSetupModal
        open={setupOpen}
        title="Take Quiz"
        setTitle={set.title}
        defaultCount={10}
        onClose={() => setSetupOpen(false)}
        onStart={({ count, minutes }) => {
          // Close modal then navigate to CBT route with chosen configuration.
          setSetupOpen(false);
          window.location.hash = `#/cbt?setId=${setId}&count=${count}&mins=${minutes}`;
        }}
      />
    </div>
  );
}
