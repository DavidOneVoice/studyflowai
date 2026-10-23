import { useId } from "react";
import { getQuizMinutes } from "../../utils/quizTime";
import "./QuizControls.css";

export default function QuizControls({
  questionCount,
  setQuestionCount,
  useAutoTime,
  setUseAutoTime,
  customMinutes,
  setCustomMinutes,
}) {
  const id = useId();
  return (
    <div className="qcWrapper">
      <div className="qcCard">
        <div className="qcSection">
          <label className="qcLabel" htmlFor={`${id}-count`}>Questions</label>

          <select
            id={`${id}-count`}
            className="qcSelect"
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          >
            {[5, 10, 15, 20, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </select>
        </div>

        <div className="qcSection">
          <div className="qcLabel">Timer</div>

          <div className="qcTimerBlock">
            <label className="qcToggle">
              <input
                type="checkbox"
                checked={useAutoTime}
                onChange={(e) => setUseAutoTime(e.target.checked)}
              />
              <span className="qcToggleSlider" />
              <span className="qcToggleText">
                Auto ({getQuizMinutes(questionCount)} mins)
              </span>
            </label>

            {!useAutoTime && (
              <div className="qcCustomTime">
                <input
                  className="qcNumber"
                  type="number"
                  aria-label="Custom timer duration in minutes"
                  min="1"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                />
                <span className="qcUnit">mins</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
