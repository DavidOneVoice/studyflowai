import { useEffect, useId, useRef, useState } from "react";
import "./PracticeMode.css";

function AttemptSaveStatus({ onFinishAttempt }) {
  const attemptedRef = useRef(false);
  const savedRef = useRef(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Defer the write so Strict Mode's cancelled setup cannot save twice.
    queueMicrotask(() => {
      if (cancelled || attemptedRef.current) return;
      attemptedRef.current = true;
      try {
        savedRef.current = onFinishAttempt?.() !== false;
      } catch {
        savedRef.current = false;
      }
      setSaveFailed(!savedRef.current);
    });
    return () => { cancelled = true; };
  }, [onFinishAttempt]);

  if (!saveFailed) return null;

  return (
    <div className="pmSaveError" role="alert">
      <p>Your result could not be saved. Keep this page open and try again.</p>
      <button
        className="pmGhost"
        type="button"
        onClick={() => {
          if (savedRef.current) return;
          try {
            savedRef.current = onFinishAttempt?.() !== false;
          } catch {
            savedRef.current = false;
          }
          setSaveFailed(!savedRef.current);
        }}
      >
        Retry saving result
      </button>
    </div>
  );
}

export default function PracticeMode({
  generating = false,
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
  onPrevious,
  onJump,
  onExit,
  onRetake,
  secondsLeft,
  onFinishAttempt,
  sessionId,
}) {
  const id = useId();

  if (!activeSetId || !activeSet) return null;

  const questions = activeSet.questions || [];
  if (!questions.length) return null;

  const currentQuestion = questions[currentIndex];

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  const total = questions.length;
  const progressPct = Math.round(((currentIndex + 1) / total) * 100);
  const isLast = currentIndex === total - 1;

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
          <div
            className="pmProgressWrap"
            role="progressbar"
            aria-label="Practice progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={showResult ? 100 : progressPct}
          >
            <div className="pmProgressTrack">
              <div
                className="pmProgressFill"
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
            <div className="pmPrompt" id={`${id}-question`}>{currentQuestion.prompt}</div>
          </div>

          <div className="pmOptions" role="group" aria-labelledby={`${id}-question`}>
            {currentQuestion.options.map((opt, index) => {
              const isSelected = chosen === opt;

              return (
                <button
                  key={`${index}-${opt}`}
                  className={isSelected ? "pmOption selected" : "pmOption"}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={generating}
                  onClick={() => {
                    setSelectedAnswer(opt);
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
              className="pmGhost"
              type="button"
              onClick={onPrevious}
              disabled={currentIndex === 0 || generating}
            >
              Previous
            </button>

            <button
              className="pmPrimary"
              type="button"
              onClick={() => onNext?.(chosen)}
              disabled={!chosen || generating}
            >
              {isLast ? "Finish" : "Next"}
            </button>

            <button
              className="pmGhost"
              type="button"
              onClick={onExit}
              disabled={generating}
            >
              Exit
            </button>
          </div>

          <div className="pmQuestionJump" aria-label="Jump to question">
            {questions.map((q, idx) => {
              const answered = Boolean(attemptAnswers?.[q.id]);
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  className={
                    isCurrent
                      ? "pmJumpBtn current"
                      : answered
                        ? "pmJumpBtn answered"
                        : "pmJumpBtn"
                  }
                  type="button"
                  onClick={() => onJump?.(idx)}
                  aria-label={`Go to question ${idx + 1}, ${answered ? "answered" : "unanswered"}`}
                  aria-current={isCurrent ? "true" : undefined}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="pmBody">
          <AttemptSaveStatus
            key={sessionId || `${activeSetId}:${questions[0]?.id}`}
            onFinishAttempt={onFinishAttempt}
          />
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
                        {yourAns || "No answer"}
                        <span className="pmMark">{correct ? "✅" : "❌"}</span>
                      </span>
                    </div>

                    {!correct && (
                      <div className="pmReviewAns">
                        <span className="pmReviewLabel">Correct</span>
                        <span className="pmReviewValue strong">{q.answer}</span>
                      </div>
                    )}

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
            <button
              className="pmPrimary"
              type="button"
              onClick={onRetake}
              disabled={generating}
            >
              {generating ? "Generating…" : "Retake Practice"}
            </button>

            <button
              className="pmGhost"
              type="button"
              onClick={onExit}
              disabled={generating}
            >
              Exit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
