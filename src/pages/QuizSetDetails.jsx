import { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "../lib/storage";
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
  const [state, setState] = useState(() => loadState());
  const setId = getQueryParam("setId");
  const [setupOpen, setSetupOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const set = useMemo(() => {
    return (state.quizSets || []).find((s) => s.id === setId) || null;
  }, [state.quizSets, setId]);

  const attempts = Array.isArray(set?.attempts) ? set.attempts : [];
  const best = attempts.reduce(
    (acc, a) => Math.max(acc, Number(a.score || 0)),
    0,
  );
  const lastAttempt = attempts[0] || null;

  function go(to) {
    window.location.hash = `#/${to}`;
  }

  function goToNotes() {
    window.location.hash = `#/notes?setId=${setId}`;
  }

  async function generateSummary() {
    if (!set) return;

    if (set.summary) {
      goToNotes();
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

      const raw = await r.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Server returned a non-JSON response." };
      }

      if (!r.ok) {
        setError(data.error || "AI notes generation failed.");
        return;
      }

      const summary = String(data.summary || "").trim();

      if (!summary) {
        setError("AI returned an empty note.");
        return;
      }

      setState((prev) => {
        const nextState = {
          ...prev,
          quizSets: (prev.quizSets || []).map((x) =>
            x.id === setId ? { ...x, summary } : x,
          ),
        };

        saveState(nextState);
        setTimeout(() => goToNotes(), 0);

        return nextState;
      });
    } catch (e) {
      setError(e?.message || "AI notes generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function startPractice() {
    setSetupOpen(true);
  }

  function clearAttempts() {
    if (!set) return;
    setConfirmClearOpen(true);
  }

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
                {set.summary ? "AI notes ready" : "No AI notes yet"}
              </span>

              <span className="qsdPill">
                {attempts.length
                  ? `${attempts.length} attempt(s)`
                  : "No attempts yet"}
              </span>

              {attempts.length ? (
                <span className="qsdPill">
                  Best: <strong>{best}</strong>/{lastAttempt?.total || "-"}
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
              disabled={busy}
            >
              Start Practice
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
                  ? "View AI Notes"
                  : "Generate AI Notes"}
            </button>

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
              onClick={() => go("library")}
              disabled={busy}
            >
              Back to Library
            </button>
          </div>
        </div>

        {error && <div className="qsdError">{error}</div>}
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
          window.location.hash = `#/cbt?setId=${setId}&count=${count}&mins=${minutes}`;
        }}
      />
    </div>
  );
}
