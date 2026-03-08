import { useEffect, useRef } from "react";
import "./PracticeMode.css";

/**
 * PracticeMode renders an interactive quiz experience:
 * - Live mode: shows questions, records chosen answers, advances through quiz
 * - Result mode: shows score + per-question review with correct answers/explanations
 *
 * The parent component owns most state; this component focuses on UI + small side-effects.
 */
export default function PracticeMode({
  activeSetId,
  activeSet,
  currentIndex,
  selectedAnswer,
  setSelectedAnswer,
  attemptAnswers,
  setAttemptAnswers,
  score,
  showResult,
  onNext,
  onExit,
  onRetake,
  secondsLeft,
  onFinishAttempt,
}) {
  // Prevent saving/finishing the same attempt multiple times when results are shown.
  const savedAttemptRef = useRef(false);

  // Tracks the "identity" of the current quiz set to reset savedAttemptRef when the set changes.
  const lastAttemptKeyRef = useRef("");

  useEffect(() => {
    // Build a lightweight key that changes when the active quiz set changes.
    // Includes: set id + question count + first question id (helps detect refreshed sets).
    const key = `${activeSetId || ""}:${(activeSet?.questions || []).length}:${String(
      activeSet?.questions?.[0]?.id || "",
    )}`;

    // If quiz set changes, allow finishing/saving again for the new attempt.
    if (key && key !== lastAttemptKeyRef.current) {
      lastAttemptKeyRef.current = key;
      savedAttemptRef.current = false;
    }
  }, [activeSetId, activeSet]);

  useEffect(() => {
    // Only trigger finish/save once:
    // - we have an active set
    // - results screen is visible
    // - we haven't already saved this attempt
    if (!activeSetId) return;
    if (!activeSet) return;
    if (!showResult) return;
    if (savedAttemptRef.current) return;

    savedAttemptRef.current = true;
    onFinishAttempt?.();
  }, [activeSetId, activeSet, showResult, onFinishAttempt]);

  // Do not render practice UI unless an active quiz set exists.
  if (!activeSetId || !activeSet) return null;

  const questions = activeSet.questions || [];
  if (!questions.length) return null;

  const currentQuestion = questions[currentIndex];

  /** Formats seconds as m:ss (e.g., 2:05). */
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  const total = questions.length;
  const progressPct = Math.round(((currentIndex + 1) / total) * 100);
  const isLast = currentIndex === total - 1;

  // Determine the currently chosen answer:
  // - prefer the live "selectedAnswer"
  // - fall back to the stored attemptAnswers for this question (if any)
  const chosen =
    selectedAnswer ?? attemptAnswers?.[currentQuestion?.id] ?? null;

  return (
    <section className="pmShell">
      <header className="pmTop">
        <div className="pmTopLeft">
          <div className="pmTitleRow">
            <h3 className="pmTitle">Practice Mode</h3>
            <span className="pmBadge">{showResult ? "Results" : "Live"}</span>
          </div>

          <div className="pmMeta">
            <span className="pmMetaItem">
              Question <strong>{currentIndex + 1}</strong> / {total}
            </span>
            <span className="pmDot" aria-hidden="true" />
            <span className="pmMetaItem">
              Time left <strong>{formatTime(secondsLeft)}</strong>
            </span>
          </div>
        </div>

        <div className="pmTopRight">
          <div className="pmProgressWrap" aria-label="Progress">
            <div className="pmProgressTrack">
              <div
                className="pmProgressFill"
                // In results view, force progress to 100% to indicate completion.
                style={{ width: `${showResult ? 100 : progressPct}%` }}
              />
            </div>
            <div className="pmProgressText">
              {showResult ? "Completed" : `${progressPct}%`}
            </div>
          </div>
        </div>
      </header>

      {!showResult ? (
        <div className="pmBody">
          <div className="pmQuestion">
            <div className="pmQLabel">Question</div>
            <div className="pmPrompt">{currentQuestion.prompt}</div>
          </div>

          <div className="pmOptions" role="list">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedAnswer === opt;

              return (
                <button
                  key={opt}
                  className={isSelected ? "pmOption selected" : "pmOption"}
                  type="button"
                  onClick={() => {
                    // Update the currently selected answer (UI state).
                    setSelectedAnswer(opt);

                    // Persist the chosen answer for this question in the attempt map.
                    setAttemptAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.id]: opt,
                    }));
                  }}
                >
                  <span className="pmRadio" aria-hidden="true" />
                  <span className="pmOptionText">{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="pmActions">
            <button
              className="pmPrimary"
              type="button"
              onClick={() => onNext?.(chosen)}
              // Prevent moving forward until an option is chosen.
              disabled={!chosen}
            >
              {isLast ? "Finish" : "Next"}
            </button>

            <button className="pmGhost" type="button" onClick={onExit}>
              Exit
            </button>
          </div>
        </div>
      ) : (
        <div className="pmBody">
          <div className="pmScoreCard">
            <div className="pmScoreLeft">
              <div className="pmScoreTitle">Your Score</div>
              <div className="pmScoreValue">
                {score} <span className="pmScoreTotal">/ {total}</span>
              </div>
              <div className="pmScoreSub">
                Review what you missed and retake for improvement.
              </div>
            </div>

            <div className="pmScoreBadge">
              <div className="pmScorePct">
                {Math.round((score / total) * 100)}%
              </div>
              <div className="pmScoreBadgeText">Accuracy</div>
            </div>
          </div>

          <div className="pmReview">
            <h4 className="pmReviewTitle">Review</h4>

            <div className="pmReviewGrid">
              {questions.map((q, idx) => {
                // User's stored answer for this question (if any).
                const yourAns = attemptAnswers[q.id];
                const correct = yourAns === q.answer;

                return (
                  <article
                    key={q.id}
                    className={correct ? "pmReviewCard ok" : "pmReviewCard bad"}
                  >
                    <div className="pmReviewQ">
                      <span className="pmReviewNum">{idx + 1}</span>
                      <span className="pmReviewPrompt">{q.prompt}</span>
                    </div>

                    <div className="pmReviewAns">
                      <span className="pmReviewLabel">Your answer</span>
                      <span className="pmReviewValue">
                        {yourAns || "No answer"}{" "}
                        <span className="pmMark">{correct ? "✅" : "❌"}</span>
                      </span>
                    </div>

                    {/* Only show the correct answer block when the user was wrong */}
                    {!correct && (
                      <div className="pmReviewAns">
                        <span className="pmReviewLabel">Correct</span>
                        <span className="pmReviewValue strong">{q.answer}</span>
                      </div>
                    )}

                    {/* Show explanation when provided by the question data */}
                    {q.explanation && (
                      <div className="pmExplain">
                        <span className="pmReviewLabel">Explanation</span>
                        <div className="pmExplainText">{q.explanation}</div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="pmActions">
            <button className="pmPrimary" type="button" onClick={onRetake}>
              Retake Quiz
            </button>

            <button className="pmGhost" type="button" onClick={onExit}>
              Exit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
