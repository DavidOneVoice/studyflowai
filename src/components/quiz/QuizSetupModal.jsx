import { useId, useState } from "react";
import AccessibleModal from "../common/AccessibleModal";
import "./QuizSetupModal.css";

export default function QuizSetupModal({ open, ...props }) {
  // Each opening starts a fresh setup without resetting state in an effect.
  return open ? <QuizSetupContent {...props} /> : null;
}

function QuizSetupContent({
  title = "Practice Setup",
  setTitle = "",
  defaultCount = 10,
  onClose,
  onStart,
}) {
  const id = useId();
  const [count, setCount] = useState(defaultCount);
  const [useAutoTime, setUseAutoTime] = useState(true);
  const [customMinutes, setCustomMinutes] = useState("");
  const presetCounts = [
    ...new Set([5, 10, 15, 20, 30, 50, 75, 100, defaultCount]),
  ].sort((a, b) => a - b);
  const autoMinutes = Math.max(1, Number(count || 1));
  const minutes = useAutoTime ? autoMinutes : Number(customMinutes);
  const validDuration = Number.isFinite(minutes) && minutes >= 1;

  return (
    <AccessibleModal
      open
      onClose={onClose}
      labelledBy={`${id}-title`}
      overlayClassName="qsmOverlay"
      className="qsmCard"
    >
      <header className="qsmHeader">
        <div className="qsmHeaderLeft">
          <h2 className="qsmTitle" id={`${id}-title`}>{title}</h2>
          {setTitle && (
            <div className="qsmSetTitle">
              <span className="qsmSetPill">Set</span>
              <strong>{setTitle}</strong>
            </div>
          )}
        </div>
        <button className="qsmClose" type="button" onClick={onClose} aria-label="Close practice setup">
          ✕
        </button>
      </header>

      <div className="qsmBody">
        <section className="qsmSection">
          <div className="qsmLabelRow">
            <label className="qsmLabel" htmlFor={`${id}-count`}>Number of questions</label>
            <div className="qsmMiniHint">{count} selected</div>
          </div>
          <select
            id={`${id}-count`}
            className="qsmSelect"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {presetCounts.map((n) => <option key={n} value={n}>{n} questions</option>)}
          </select>
          <p className="qsmNote">
            More questions usually need more time and more source material. If
            the document is short, very high question counts may not generate
            successfully.
          </p>
        </section>

        <section className="qsmSection">
          <div className="qsmLabelRow">
            <div className="qsmLabel" id={`${id}-duration`}>Practice duration</div>
            <div className="qsmMiniHint">
              {useAutoTime
                ? `${autoMinutes} mins (auto)`
                : validDuration
                  ? `${minutes} mins (custom)`
                  : "Enter minutes"}
            </div>
          </div>
          <div className="qsmTimeModes" role="radiogroup" aria-labelledby={`${id}-duration`}>
            <label className={useAutoTime ? "qsmMode active" : "qsmMode"}>
              <input
                className="qsmRadio"
                type="radio"
                name={`${id}-time-mode`}
                checked={useAutoTime}
                onChange={() => setUseAutoTime(true)}
              />
              <span className="qsmModeText">
                <span className="qsmModeTitle">
                  Auto (recommended)<span className="qsmStrong"> {autoMinutes} mins</span>
                </span>
                <span className="qsmModeSub">{count} questions → {count} mins</span>
              </span>
            </label>
            <label className={!useAutoTime ? "qsmMode active" : "qsmMode"}>
              <input
                className="qsmRadio"
                type="radio"
                name={`${id}-time-mode`}
                checked={!useAutoTime}
                onChange={() => setUseAutoTime(false)}
              />
              <span className="qsmModeText">
                <span className="qsmModeTitle">Custom duration</span>
                <span className="qsmModeSub">Choose your own timer for practice sessions</span>
              </span>
            </label>
          </div>
          {!useAutoTime && (
            <div className="qsmCustomRow">
              <input
                id={`${id}-minutes`}
                className="qsmNumber"
                type="number"
                min="1"
                placeholder="e.g. 120"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                aria-invalid={customMinutes !== "" && !validDuration}
              />
              <label className="qsmUnit" htmlFor={`${id}-minutes`}>minutes</label>
            </div>
          )}
          <p className="qsmNote">
            Recommended: choose a question count that matches how much
            material you uploaded. Larger counts work best with longer documents.
          </p>
        </section>
      </div>

      <div className="qsmTip">
        Tip: If your file is short and the app cannot generate enough unique
        questions, reduce the number of questions and try again.
      </div>
      <footer className="qsmActions">
        <button className="qsmBtn" type="button" onClick={onClose}>Cancel</button>
        <button
          className="qsmBtn qsmPrimary"
          type="button"
          disabled={!validDuration}
          onClick={() => onStart?.({ count, minutes, mode: useAutoTime ? "auto" : "custom" })}
        >
          Start Practice
        </button>
      </footer>
    </AccessibleModal>
  );
}
