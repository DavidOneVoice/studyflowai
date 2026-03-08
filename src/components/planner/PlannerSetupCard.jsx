import DatePicker from "react-datepicker";
import {
  dateToHHmm,
  dateToIso,
  hhmmToDate,
  isoToDate,
} from "../../lib/dateHelpers";
import "./PlannerSetupCard.css";

/**
 * Planner setup UI for:
 * - Step 1: Adding a course (name, exam date, priority/workload)
 * - Step 2: Defining study availability (days + time window + session length)
 *
 * All form state is controlled by the parent component via props.
 */
export default function PlannerSetupCard({
  // course form
  name,
  setName,
  examDate,
  setExamDate,
  workload,
  setWorkload,
  onAddCourse,

  // availability + state
  availability,
  setAvailability,

  // errors
  errors = [],
}) {
  return (
    <div className="pscCard card">
      <header className="pscHeader">
        <div className="pscBadge">Step 1</div>
        <h3 className="pscTitle">Add a Course</h3>
        <p className="pscSub">
          Add your course name, exam date, and priority. Priority helps the
          planner allocate time.
        </p>
      </header>

      {/* Course creation form (submit handled by parent via onAddCourse) */}
      <form onSubmit={onAddCourse} className="pscFormGrid">
        <div className="field">
          <label>Course name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., CSC 101 - Intro to Computing"
          />
          <p className="pscHint">Enter your course name</p>
        </div>

        <div className="field">
          <label>Exam date</label>
          <DatePicker
            // DatePicker uses Date objects; helpers convert between ISO strings and Date.
            selected={isoToDate(examDate)}
            onChange={(d) => setExamDate(dateToIso(d))}
            placeholderText="Select exam date"
            dateFormat="yyyy-MM-dd"
            className="input"
            isClearable
            showPopperArrow={false}
          />
          <p className="pscHint">
            This helps the scheduler prioritize what’s closer.
          </p>
        </div>

        <div className="field">
          <label>Priority level (1–10)</label>
          <select
            value={workload}
            onChange={(e) => setWorkload(Number(e.target.value))}
          >
            {/* Generate priority options 1..10 */}
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option id="priority-option" key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className="pscHint">10 = most important / heavy course.</p>
        </div>

        <div className="pscCTA">
          <button className="primaryBtn" type="submit">
            Add course
          </button>
        </div>
      </form>

      <div className="pscDivider" />

      <header className="pscHeader">
        <div className="pscBadge pscBadge2">Step 2</div>
        <h3 className="pscTitle">Study Availability</h3>
        <p className="pscSub">
          Choose the days you can study and your preferred time window. This is
          used to generate your schedule.
        </p>
      </header>

      <div className="pscAvailability">
        <div className="pscDays">
          {/* Day-of-week chip selector (stored as array of short day strings) */}
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
            const selected = (availability?.days || []).includes(d);

            return (
              <button
                key={d}
                type="button"
                className={selected ? "pscChip active" : "pscChip"}
                onClick={() => {
                  // Toggle selected day in the availability.days array.
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
              // Times are stored as "HH:mm" strings; helpers convert to/from Date objects.
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
                  // Store as a number to simplify schedule calculations.
                  sessionMinutes: Number(e.target.value),
                })
              }
            />
            <p className="pscHint">Common: 45–90 mins.</p>
          </div>
        </div>

        <div className="pscNote">
          Example: If you choose <strong>18:00–20:00</strong> with{" "}
          <strong>60 mins</strong> sessions, you’ll have{" "}
          <strong>2 study slots</strong> per selected day.
        </div>
      </div>

      {/* Validation errors from parent (shown as a list) */}
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
