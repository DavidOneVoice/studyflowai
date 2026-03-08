import { useEffect, useMemo, useState } from "react";
import "./QuizSetupModal.css";

/**
 * QuizSetupModal collects quiz configuration before starting:
 * - Number of questions (preset options)
 * - Duration mode: auto (recommended) or custom minutes
 *
 * When the user clicks "Start Quiz", it calls onStart with:
 * { count, minutes, mode: "auto" | "custom" }
 */
export default function QuizSetupModal({
  open,
  title = "Quiz Setup",
  setTitle = "",
  defaultCount = 10,
  onClose,
  onStart,
}) {
  // Preset counts for quick selection (memoized to avoid recreating array on each render).
  const presetCounts = useMemo(() => [5, 10, 15, 20, 30, 50, 75, 100], []);

  const [count, setCount] = useState(defaultCount);
  const [useAutoTime, setUseAutoTime] = useState(true);
  const [customMinutes, setCustomMinutes] = useState("");

  /**
   * Reset modal state whenever it opens (or when defaultCount changes),
   * so each new open starts from predictable defaults.
   */
  useEffect(() => {
    if (!open) return;
    setCount(defaultCount);
    setUseAutoTime(true);
    setCustomMinutes("");
  }, [open, defaultCount]);

  // Auto duration rule: 1 minute per question (minimum of 1 minute).
  const autoMinutes = Math.max(1, Number(count || 1));

  // Final minutes depends on selected mode (auto vs custom), always clamped to >= 1.
  const minutes = useAutoTime
    ? autoMinutes
    : Math.max(1, Number(customMinutes || 1));

  // Do not render if the modal is closed.
  if (!open) return null;

  return (
    <div
      className="qsmOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // Clicking outside the card closes the modal.
      onClick={() => onClose?.()}
    >
      {/* Stop click propagation so clicks inside the card do not close the modal */}
      <div className="qsmCard" onClick={(e) => e.stopPropagation()}>
        <header className="qsmHeader">
          <div className="qsmHeaderLeft">
            <div className="qsmTitle">{title}</div>
            {/* Show the quiz set title when provided */}
            {setTitle ? (
              <div className="qsmSetTitle">
                <span className="qsmSetPill">Set</span>
                <strong>{setTitle}</strong>
              </div>
            ) : null}
          </div>

          <button
            className="qsmClose"
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="qsmBody">
          <section className="qsmSection">
            <div className="qsmLabelRow">
              <div className="qsmLabel">Number of questions</div>
              <div className="qsmMiniHint">{count} selected</div>
            </div>

            <select
              className="qsmSelect"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {presetCounts.map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </select>

            <p className="qsmNote">
              Tip: More questions usually need more time.
            </p>
          </section>

          <section className="qsmSection">
            <div className="qsmLabelRow">
              <div className="qsmLabel">Quiz duration</div>
              <div className="qsmMiniHint">
                {useAutoTime
                  ? `${autoMinutes} mins (auto)`
                  : `${minutes} mins (custom)`}
              </div>
            </div>

            <div className="qsmTimeModes">
              {/* Auto duration mode */}
              <label className={useAutoTime ? "qsmMode active" : "qsmMode"}>
                <input
                  className="qsmRadio"
                  type="radio"
                  name="timeMode"
                  checked={useAutoTime}
                  onChange={() => setUseAutoTime(true)}
                />
                <div className="qsmModeText">
                  <div className="qsmModeTitle">
                    Auto (recommended){" "}
                    <span className="qsmStrong">{autoMinutes} mins</span>
                  </div>
                  <div className="qsmModeSub">
                    {count} questions → {count} mins
                  </div>
                </div>
              </label>

              {/* Custom duration mode */}
              <label className={!useAutoTime ? "qsmMode active" : "qsmMode"}>
                <input
                  className="qsmRadio"
                  type="radio"
                  name="timeMode"
                  checked={!useAutoTime}
                  onChange={() => setUseAutoTime(false)}
                />
                <div className="qsmModeText">
                  <div className="qsmModeTitle">Custom duration</div>
                  <div className="qsmModeSub">
                    For serious exam practice (e.g. 100 questions in 120 mins)
                  </div>
                </div>
              </label>

              {/* Custom minutes input only appears when custom mode is selected */}
              {!useAutoTime && (
                <div className="qsmCustomRow">
                  <input
                    className="qsmNumber"
                    type="number"
                    min="1"
                    placeholder="e.g. 120"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                  />
                  <div className="qsmUnit">minutes</div>
                </div>
              )}
            </div>

            <p className="qsmNote">
              Example: 100 questions for 120 mins (2 hours).
            </p>
          </section>
        </div>

        <footer className="qsmActions">
          <button className="qsmBtn" type="button" onClick={() => onClose?.()}>
            Cancel
          </button>

          <button
            className="qsmBtn qsmPrimary"
            type="button"
            // Start the quiz with the selected configuration.
            onClick={() =>
              onStart?.({
                count,
                minutes,
                mode: useAutoTime ? "auto" : "custom",
              })
            }
          >
            Start Quiz
          </button>
        </footer>
      </div>
    </div>
  );
}
