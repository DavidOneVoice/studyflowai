import { useEffect, useMemo, useState } from "react";
import { generateSchedule } from "../lib/scheduler";
import { loadState, saveState } from "../lib/storage";
import { makeCourse, validateCourse } from "../lib/courses";
import { API_BASE } from "../lib/api";

import PlannerSetupCard from "../components/planner/PlannerSetupCard";
import PlannerCoursesCard from "../components/planner/PlannerCoursesCard";

import "./Planner.css";

export default function Planner() {
  const [state, setState] = useState(() => loadState());
  const [activeTab, setActiveTab] = useState("setup");

  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [workload, setWorkload] = useState(5);

  const [errors, setErrors] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [quizError, setQuizError] = useState("");

  const [takingQuizSetId, setTakingQuizSetId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const courses = useMemo(() => state.courses || [], [state.courses]);
  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  function setAvailability(nextAvailability) {
    setState((prev) => ({
      ...prev,
      availability: {
        ...(prev.availability || {}),
        ...(nextAvailability || {}),
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

    setState((prev) => ({
      ...prev,
      courses: [...(prev.courses || []), newCourse],
    }));

    setName("");
    setExamDate("");
    setWorkload(5);
    setErrors([]);
    setActiveTab("courses");
  }

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
    window.location.hash = "#/plan";
    setToast("Study plan generated ✅");
  }

  function handleClearSchedule() {
    setState((prev) => ({ ...prev, schedule: [] }));
    setScheduleError("");
  }

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
          nonce: crypto.randomUUID(),
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

      setState((prev) => ({
        ...prev,
        quizSets: (prev.quizSets || []).map((set) =>
          set.id === quizSetId ? { ...set, questions } : set,
        ),
        ui: { ...(prev.ui || {}), activeTab: "quiz", activeSetId: quizSetId },
      }));

      setToast("Practice quiz is ready ✅ Open Practice to begin.");
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
            <div className="plBadge">Study Plan</div>
            <h2 className="plTitle">Create your study plan</h2>
            <p className="plSub">
              Add your subjects, set your exam dates, choose your available
              study time, and generate a balanced reading schedule.
            </p>
          </div>

          <div className="plHeaderActions">
            <button
              className="plGhost"
              type="button"
              onClick={() => (window.location.hash = "#/plan")}
            >
              Refresh Plan
            </button>
          </div>
        </header>

        {toast && <div className="plToast">{toast}</div>}

        <div className="plTabsCard">
          <div className="plTabs">
            <button
              type="button"
              className={activeTab === "setup" ? "plTab active" : "plTab"}
              onClick={() => setActiveTab("setup")}
            >
              Setup
            </button>

            <button
              type="button"
              className={activeTab === "courses" ? "plTab active" : "plTab"}
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
