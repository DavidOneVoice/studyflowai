import { useEffect, useMemo, useState } from "react";
import "./QuizSetupModal.css";

export default function QuizSetupModal({
  open,
  title = "Practice Setup",
  setTitle = "",
  defaultCount = 10,
  onClose,
  onStart,
}) {
  const presetCounts = useMemo(() => [5, 10, 15, 20, 30, 50, 75, 100], []);

  const [count, setCount] = useState(defaultCount);
  const [useAutoTime, setUseAutoTime] = useState(true);
  const [customMinutes, setCustomMinutes] = useState("");

  useEffect(() => {
    if (!open) return;
    setCount(defaultCount);
    setUseAutoTime(true);
    setCustomMinutes("");
  }, [open, defaultCount]);

  const autoMinutes = Math.max(1, Number(count || 1));
  const minutes = useAutoTime
    ? autoMinutes
    : Math.max(1, Number(customMinutes || 1));

  if (!open) return null;

  return (
    <div
      className="qsmOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => onClose?.()}
    >
      <div className="qsmCard" onClick={(e) => e.stopPropagation()}>
        <header className="qsmHeader">
          <div className="qsmHeaderLeft">
            <div className="qsmTitle">{title}</div>

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
              More questions usually need more time and more source material. If
              the document is short, very high question counts may not generate
              successfully.
            </p>
          </section>

          <section className="qsmSection">
            <div className="qsmLabelRow">
              <div className="qsmLabel">Practice duration</div>
              <div className="qsmMiniHint">
                {useAutoTime
                  ? `${autoMinutes} mins (auto)`
                  : `${minutes} mins (custom)`}
              </div>
            </div>

            <div className="qsmTimeModes">
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
                    Auto (recommended)
                    <span className="qsmStrong"> {autoMinutes} mins</span>
                  </div>
                  <div className="qsmModeSub">
                    {count} questions → {count} mins
                  </div>
                </div>
              </label>

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
                    Choose your own timer for practice sessions
                  </div>
                </div>
              </label>

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
              Recommended: choose a question count that matches how much
              material you uploaded. Larger counts work best with longer
              documents.
            </p>
          </section>
        </div>

        <div className="qsmTip">
          Tip: If your file is short and the app cannot generate enough unique
          questions, reduce the number of questions and try again.
        </div>

        <footer className="qsmActions">
          <button className="qsmBtn" type="button" onClick={() => onClose?.()}>
            Cancel
          </button>

          <button
            className="qsmBtn qsmPrimary"
            type="button"
            onClick={() =>
              onStart?.({
                count,
                minutes,
                mode: useAutoTime ? "auto" : "custom",
              })
            }
          >
            Start Practice
          </button>
        </footer>
      </div>
    </div>
  );
}
