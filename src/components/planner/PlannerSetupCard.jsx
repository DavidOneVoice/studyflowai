import DatePicker from "react-datepicker";
import {
  dateToHHmm,
  dateToIso,
  hhmmToDate,
  isoToDate,
} from "../../lib/dateHelpers";
import "./PlannerSetupCard.css";

export default function PlannerSetupCard({
  name,
  setName,
  examDate,
  setExamDate,
  workload,
  setWorkload,
  onAddCourse,
  availability,
  setAvailability,
  errors = [],
}) {
  return (
    <div className="pscCard card">
      <header className="pscHeader">
        <div className="pscBadge">Study Setup</div>
        <h3 className="pscTitle">Add a subject</h3>
        <p className="pscSub">
          Enter your subject, exam date, and priority so StudyFlow AI can build
          your reading plan.
        </p>
      </header>

      <form onSubmit={onAddCourse} className="pscFormGrid">
        <div className="field">
          <label>Subject name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., CSC 101 - Intro to Computing"
          />
          <p className="pscHint">Enter the subject you want to prepare for</p>
        </div>

        <div className="field">
          <label>Exam date</label>
          <DatePicker
            selected={isoToDate(examDate)}
            onChange={(d) => setExamDate(dateToIso(d))}
            placeholderText="Select exam date"
            dateFormat="yyyy-MM-dd"
            className="input"
            isClearable
            showPopperArrow={false}
          />
          <p className="pscHint">
            Your exam date helps the app decide what needs attention first.
          </p>
        </div>

        <div className="field">
          <label>Priority level (1–10)</label>
          <select
            value={workload}
            onChange={(e) => setWorkload(Number(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option id="priority-option" key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className="pscHint">10 = highest priority or most difficult.</p>
        </div>

        <div className="pscCTA">
          <button className="primaryBtn" type="submit">
            Add Subject
          </button>
        </div>
      </form>

      <div className="pscDivider" />

      <header className="pscHeader">
        <div className="pscBadge pscBadge2">Availability</div>
        <h3 className="pscTitle">Set your reading time</h3>
        <p className="pscSub">
          Choose the days and time range when you are available to study.
        </p>
      </header>

      <div className="pscAvailability">
        <div className="pscDays">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
            const selected = (availability?.days || []).includes(d);

            return (
              <button
                key={d}
                type="button"
                className={selected ? "pscChip active" : "pscChip"}
                onClick={() => {
                  const currentDays = availability?.days || [];
                  const nextDays = selected
                    ? currentDays.filter((x) => x !== d)
                    : [...currentDays, d];

                  setAvailability({ ...(availability || {}), days: nextDays });
                }}
              >
                {d}
              </button>
            );
          })}
        </div>

        <div className="pscTimeGrid">
          <div className="field">
            <label>Start time</label>
            <DatePicker
              selected={hhmmToDate(availability?.startTime || "18:00")}
              onChange={(d) =>
                setAvailability({
                  ...(availability || {}),
                  startTime: dateToHHmm(d),
                })
              }
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={5}
              timeCaption="Time"
              dateFormat="HH:mm"
              className="input"
              showPopperArrow={false}
            />
          </div>

          <div className="field">
            <label>End time</label>
            <DatePicker
              selected={hhmmToDate(availability?.endTime || "20:00")}
              onChange={(d) =>
                setAvailability({
                  ...(availability || {}),
                  endTime: dateToHHmm(d),
                })
              }
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={5}
              timeCaption="Time"
              dateFormat="HH:mm"
              className="input"
              showPopperArrow={false}
            />
          </div>

          <div className="field">
            <label>Session length (mins)</label>
            <input
              type="number"
              min="15"
              max="240"
              value={availability?.sessionMinutes ?? 60}
              onChange={(e) =>
                setAvailability({
                  ...(availability || {}),
                  sessionMinutes: Number(e.target.value),
                })
              }
            />
            <p className="pscHint">A common range is 45–90 minutes.</p>
          </div>
        </div>

        <div className="pscNote">
          Example: If you choose <strong>18:00–20:00</strong> with{" "}
          <strong>60 mins</strong> sessions, you’ll get{" "}
          <strong>2 study sessions</strong> per selected day.
        </div>
      </div>

      {errors.length > 0 && (
        <div className="errorBox pscError">
          <strong>Please fix:</strong>
          <ul>
            {errors.map((er) => (
              <li key={er}>{er}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
