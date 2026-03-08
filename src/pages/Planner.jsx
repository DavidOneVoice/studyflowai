import { useEffect, useMemo, useState } from "react";
import { generateSchedule } from "../lib/scheduler";
import { loadState, saveState } from "../lib/storage";
import { makeCourse, validateCourse } from "../lib/courses";
import { API_BASE } from "../lib/api";

import PlannerSetupCard from "../components/planner/PlannerSetupCard";
import PlannerCoursesCard from "../components/planner/PlannerCoursesCard";

import "./Planner.css";

/**
 * Planner page:
 * - Step 1: Collect course details + study availability (Scheduler Setup tab)
 * - Step 2: Manage courses, generate schedule, and launch linked quizzes (Your Courses tab)
 *
 * State is persisted via localStorage using loadState/saveState.
 */
export default function Planner() {
  const [state, setState] = useState(() => loadState());
  const [activeTab, setActiveTab] = useState("setup");

  // Course form fields (controlled locally, saved into state.courses on submit)
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [workload, setWorkload] = useState(5);

  // Validation + runtime errors
  const [errors, setErrors] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [quizError, setQuizError] = useState("");

  // Quiz integration state (used to disable buttons while generating)
  const [takingQuizSetId, setTakingQuizSetId] = useState(null);

  // UI feedback (short-lived toast messages)
  const [toast, setToast] = useState("");

  /**
   * Persist planner/app state on every change.
   */
  useEffect(() => {
    saveState(state);
  }, [state]);

  /**
   * Auto-dismiss toast after a short delay.
   */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // Memoized slices for stable props and rendering.
  const courses = useMemo(() => state.courses || [], [state.courses]);
  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  /**
   * Updates availability inside the persisted state.
   * Merges partial updates to avoid overwriting other keys.
   */
  function setAvailability(nextAvailability) {
    setState((prev) => ({
      ...prev,
      availability: {
        ...(prev.availability || {}),
        ...(nextAvailability || {}),
      },
    }));
  }

  /**
   * Adds a new course after validating the input.
   * Switches user to "Your Courses" tab on success.
   */
  function addCourse(e) {
    e.preventDefault();

    const candidate = { name, examDate, workload };
    const errs = validateCourse(candidate);
    if (errs.length) {
      setErrors(errs);
      return;
    }

    const newCourse = makeCourse(candidate);

    setState((prev) => ({
      ...prev,
      courses: [...(prev.courses || []), newCourse],
    }));

    // Reset form after adding.
    setName("");
    setExamDate("");
    setWorkload(5);
    setErrors([]);

    setActiveTab("courses");
  }

  /**
   * Removes a single course.
   * Also removes schedule entries associated with the removed course.
   * If no courses remain, the schedule is cleared.
   */
  function removeCourse(id) {
    setState((prev) => {
      const nextCourses = (prev.courses || []).filter((c) => c.id !== id);

      const nextSchedule =
        nextCourses.length === 0
          ? []
          : (prev.schedule || []).filter((s) => s.courseId !== id);

      return {
        ...prev,
        courses: nextCourses,
        schedule: nextSchedule,
      };
    });
  }

  /**
   * Removes all courses whose exam date has passed.
   * Also removes their schedule sessions.
   * Returns the number of removed courses (used for toast messaging).
   */
  function removeExpiredCourses() {
    const todayIso = new Date().toISOString().slice(0, 10);

    let removedCount = 0;

    setState((prev) => {
      const expiredIds = new Set(
        (prev.courses || [])
          .filter((c) => String(c.examDate || "") < todayIso)
          .map((c) => c.id),
      );

      removedCount = expiredIds.size;

      if (expiredIds.size === 0) return prev;

      const nextCourses = (prev.courses || []).filter(
        (c) => !expiredIds.has(c.id),
      );

      const nextSchedule = (prev.schedule || []).filter(
        (s) => !expiredIds.has(s.courseId),
      );

      return {
        ...prev,
        courses: nextCourses,
        schedule: nextSchedule,
      };
    });

    return removedCount;
  }

  /**
   * Generates a schedule using only non-expired courses.
   * Navigates to the schedule page on success.
   */
  function handleGenerateSchedule() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const activeCourses = (state.courses || []).filter(
      (c) => String(c.examDate || "") >= todayIso,
    );

    const result = generateSchedule({
      courses: activeCourses,
      availability: state.availability || {},
    });

    if (result.error) {
      setScheduleError(result.error);
      return;
    }

    setState((prev) => ({ ...prev, schedule: result.schedule }));
    setScheduleError("");
    window.location.hash = "#/schedule";
  }

  /**
   * Clears the generated schedule but keeps courses and availability.
   */
  function handleClearSchedule() {
    setState((prev) => ({ ...prev, schedule: [] }));
    setScheduleError("");
  }

  /**
   * Generates a quiz for a specific quiz set and stores it in local state,
   * allowing the user to launch it later from the Quiz Builder/CBT flow.
   */
  async function takeQuizFromPlanner(quizSetId, count = 10) {
    const target = (state.quizSets || []).find((q) => q.id === quizSetId);
    if (!target) return;

    try {
      setTakingQuizSetId(quizSetId);
      setQuizError("");

      const r = await fetch(`${API_BASE}/api/generate-mcqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: target.title,
          sourceText: target.sourceText,
          count,
          difficulty: "mixed",
          // Nonce encourages variation between attempts.
          nonce: crypto.randomUUID(),
          // Avoid repeating prior prompts (best-effort diversity).
          avoid: (target.promptHistory || target.questions || [])
            .map((q) => (typeof q === "string" ? q : q.prompt))
            .filter(Boolean)
            .slice(0, 40),
        }),
      });

      const raw = await r.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Server returned a non-JSON response." };
      }

      if (!r.ok) {
        setQuizError(data.error || `AI generation failed (HTTP ${r.status}).`);
        return;
      }

      const questions = Array.isArray(data.questions) ? data.questions : [];
      if (!questions.length) {
        setQuizError("AI returned no questions. Try uploading more material.");
        return;
      }

      // Minimal validation of expected question format.
      const looksValid = questions.every(
        (q) =>
          q &&
          typeof q.prompt === "string" &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          typeof q.answer === "string",
      );

      if (!looksValid) {
        setQuizError(
          "AI returned questions in an unexpected format. Try again.",
        );
        return;
      }

      // Store generated questions on the set so they can be used by the quiz flow.
      setState((prev) => ({
        ...prev,
        quizSets: (prev.quizSets || []).map((set) =>
          set.id === quizSetId ? { ...set, questions } : set,
        ),
        // UI hints for other pages (optional; depends on your app's navigation usage).
        ui: { ...(prev.ui || {}), activeTab: "quiz", activeSetId: quizSetId },
      }));

      setToast("Quiz generated ✅ Open Quiz Builder to take it.");
    } catch (err) {
      console.error(err);
      setQuizError(err?.message || "Failed to generate quiz.");
    } finally {
      setTakingQuizSetId(null);
    }
  }

  return (
    <div className="plPage">
      <section className="plCard card">
        <header className="plHeader">
          <div>
            <div className="plBadge">Planner</div>
            <h2 className="plTitle">Study Planner</h2>
            <p className="plSub">
              Add your courses and exam dates. Then set your availability to
              generate a balanced study schedule.
            </p>
          </div>

          <div className="plHeaderActions">
            <button
              className="plGhost"
              type="button"
              onClick={() => (window.location.hash = "#/schedule")}
            >
              View Schedule
            </button>
          </div>
        </header>

        {/* Short toast feedback (auto-dismissed by effect above) */}
        {toast && <div className="plToast">{toast}</div>}

        <div className="plTabsCard">
          <div className="plTabs">
            <button
              type="button"
              className={activeTab === "setup" ? "plTab active" : "plTab"}
              onClick={() => setActiveTab("setup")}
            >
              Scheduler Setup
            </button>

            <button
              type="button"
              className={activeTab === "courses" ? "plTab active" : "plTab"}
              onClick={() => setActiveTab("courses")}
            >
              Your Courses
            </button>
          </div>
        </div>

        <div className="plBody">
          {activeTab === "setup" && (
            <PlannerSetupCard
              name={name}
              setName={setName}
              examDate={examDate}
              setExamDate={setExamDate}
              workload={workload}
              setWorkload={setWorkload}
              onAddCourse={addCourse}
              availability={state.availability || {}}
              setAvailability={setAvailability}
              errors={errors}
            />
          )}

          {activeTab === "courses" && (
            <PlannerCoursesCard
              courses={courses}
              quizSets={quizSets}
              takingQuizSetId={takingQuizSetId}
              onRemoveCourse={removeCourse}
              onTakeQuizFromPlanner={takeQuizFromPlanner}
              quizError={quizError}
              scheduleError={scheduleError}
              onGenerateSchedule={handleGenerateSchedule}
              onClearSchedule={handleClearSchedule}
              onRemoveExpiredCourses={removeExpiredCourses}
            />
          )}
        </div>
      </section>
    </div>
  );
}
