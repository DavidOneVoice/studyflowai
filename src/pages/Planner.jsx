import { useMemo, useState } from "react";
import { generateSchedule } from "../lib/scheduler";
import { useAppState } from "../hooks/useAppState";
import { dateToIso } from "../lib/dateHelpers";
import { makeCourse, validateCourse } from "../lib/courses";

import PlannerSetupCard from "../components/planner/PlannerSetupCard";
import PlannerCoursesCard from "../components/planner/PlannerCoursesCard";

import "./Planner.css";

export default function Planner() {
  const [state, setState] = useAppState();
  const [activeTab, setActiveTab] = useState("setup");

  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [workload, setWorkload] = useState(5);

  const [errors, setErrors] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const courses = useMemo(() => state.courses || [], [state.courses]);
  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  function setAvailability(nextAvailability) {
    setState((prev) => ({
      ...prev,
      availability: {
        ...(prev.availability || {}),
        ...(typeof nextAvailability === "function" ? nextAvailability(prev.availability) : nextAvailability),
      },
    }));
  }

  function addCourse(e) {
    e.preventDefault();

    const candidate = { name, examDate, workload };
    const errs = validateCourse(candidate);

    if (errs.length) {
      setErrors(errs);
      return;
    }

    const newCourse = makeCourse(candidate);

    const saved = setState((prev) => ({
      ...prev,
      courses: [...(prev.courses || []), newCourse],
    }));
    if (!saved) return;

    setName("");
    setExamDate("");
    setWorkload(5);
    setErrors([]);
    setActiveTab("courses");
  }

  function removeCourse(id) {
    return setState((prev) => {
      const nextCourses = (prev.courses || []).filter((c) => c.id !== id);

      const nextSchedule =
        nextCourses.length === 0
          ? []
          : (prev.schedule || []).filter((s) => s.courseId !== id);

      return {
        ...prev,
        courses: nextCourses,
        schedule: nextSchedule,
        quizSets: prev.quizSets.map((set) => set.courseId === id ? { ...set, courseId: "" } : set),
      };
    });
  }

  function removeExpiredCourses() {
    const todayIso = dateToIso(new Date());
    let removedCount = 0;

    const saved = setState((prev) => {
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
        quizSets: prev.quizSets.map((set) => expiredIds.has(set.courseId) ? { ...set, courseId: "" } : set),
      };
    });

    return saved ? removedCount : false;
  }

  function handleGenerateSchedule() {
    const todayIso = dateToIso(new Date());
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

    if (!setState((prev) => ({ ...prev, schedule: result.schedule }))) return;
    setScheduleError("");
    window.location.hash = "#/schedule";
  }

  function handleClearSchedule() {
    const saved = setState((prev) => ({ ...prev, schedule: [] }));
    if (saved) setScheduleError("");
    return saved;
  }

  function takeQuizFromPlanner(quizSetId) {
    window.location.hash = `#/quizSet?setId=${encodeURIComponent(quizSetId)}&start=1`;
  }

  return (
    <div className="plPage">
      <section className="plCard card">
        <header className="plHeader">
          <div>
            <div className="plBadge">Study Plan</div>
            <h2 className="plTitle">Create your study plan</h2>
            <p className="plSub">
              Add your subjects, set your exam dates, choose your available
              study time, and generate a balanced reading schedule.
            </p>
          </div>

          {state.schedule.length > 0 && <div className="plHeaderActions">
            <button
              className="plGhost"
              type="button"
              onClick={() => (window.location.hash = "#/schedule")}
            >
              View Schedule
            </button>
          </div>}
        </header>

        <div className="plTabsCard">
          <div className="plTabs">
            <button
              type="button"
              className={activeTab === "setup" ? "plTab active" : "plTab"}
              aria-pressed={activeTab === "setup"}
              onClick={() => setActiveTab("setup")}
            >
              Setup
            </button>

            <button
              type="button"
              className={activeTab === "courses" ? "plTab active" : "plTab"}
              aria-pressed={activeTab === "courses"}
              onClick={() => setActiveTab("courses")}
            >
              Subjects
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
              onRemoveCourse={removeCourse}
              onTakeQuizFromPlanner={takeQuizFromPlanner}
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
