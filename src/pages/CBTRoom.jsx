import { useEffect, useMemo, useRef, useState } from "react";
import { loadState, saveState } from "../lib/storage";
import { useCountdown } from "../hooks/useCountdown";
import PracticeMode from "../components/quiz/PracticeMode";
import { API_BASE } from "../lib/api";
import "./CBTRoom.css";

// -------------------- helpers --------------------

/**
 * Reads a query parameter from the hash portion of the URL.
 * Expected format: #/route?key=value&key2=value2
 */
function getQueryParam(name) {
  const hash = window.location.hash || "";
  const q = hash.split("?")[1] || "";
  const params = new URLSearchParams(q);
  return params.get(name) || "";
}

/**
 * Reads a query parameter as a positive integer.
 * Falls back to the provided default when missing/invalid.
 */
function getIntParam(name, fallback) {
  const v = Number(getQueryParam(name));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}
// ------------------------------------------------

/**
 * CBTRoom is the quiz-taking screen:
 * - Loads quiz sets from local storage state
 * - Generates fresh questions from the backend (AI) for a selected set
 * - Runs a countdown timer and auto-finishes at 0
 * - Saves the most recent attempts back to the selected quiz set
 */
export default function CBTRoom() {
  const [state, setState] = useState(() => loadState());
  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  // Practice state (live quiz session)
  const [activeSetId, setActiveSetId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [attemptAnswers, setAttemptAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const { secondsLeft, isRunning, start, stop, reset } = useCountdown();

  /**
   * Persist app state whenever it changes.
   * This keeps quiz sets, attempts, and planner data in localStorage.
   */
  useEffect(() => {
    saveState(state);
  }, [state]);

  /**
   * Resolve the currently active quiz set from state.
   */
  const activeSet = useMemo(
    () => quizSets.find((s) => s.id === activeSetId) || null,
    [quizSets, activeSetId],
  );

  /**
   * Auto-finish the quiz if timer reaches 0.
   * `useCountdown` stops running at 0, so we check for isRunning false + secondsLeft 0.
   */
  useEffect(() => {
    if (activeSetId && isRunning === false && secondsLeft === 0) {
      if (!showResult) setShowResult(true);
    }
  }, [activeSetId, isRunning, secondsLeft, showResult]);

  /**
   * Initializes a fresh quiz attempt UI state for a given set.
   * (Timer is started separately.)
   */
  function startPractice(setId) {
    setActiveSetId(setId);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAttemptAnswers({});
    setScore(0);
    setShowResult(false);
  }

  /**
   * Exits CBT mode and returns to the relevant page.
   * Also stops and resets the countdown timer.
   */
  function exitPractice() {
    setActiveSetId(null);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAttemptAnswers({});
    setScore(0);
    setShowResult(false);
    stop();
    reset();

    const sid = getQueryParam("setId");
    window.location.hash = sid ? `#/quizSet?setId=${sid}` : "#/quizSets";
  }

  /**
   * Advances to the next question (or finishes the quiz at the end).
   * Uses:
   * - answerOverride (passed from child) OR
   * - currently selectedAnswer OR
   * - the stored answer for the current question
   */
  function handleNext(answerOverride) {
    if (!activeSet) return;

    const q = activeSet.questions[currentIndex];

    const chosen =
      answerOverride ?? selectedAnswer ?? attemptAnswers?.[q?.id] ?? null;

    // Do not advance unless an answer exists.
    if (!chosen) return;

    // Update score immediately for correct answers.
    if (chosen === q.answer) setScore((p) => p + 1);

    // If this was the last question, finish immediately.
    if (currentIndex + 1 >= activeSet.questions.length) {
      setShowResult(true);
      stop();
      return;
    }

    setCurrentIndex((p) => p + 1);
    setSelectedAnswer(null);
  }

  /**
   * Saves a quiz attempt into the selected set.
   * Keeps only the most recent 4 attempts.
   */
  function saveAttemptForSet({
    setId,
    score,
    total,
    answers,
    questionsSnapshot,
    minutesPlanned,
  }) {
    const takenAt = new Date().toISOString();

    const attempt = {
      id: crypto.randomUUID(),
      takenAt,
      questionCount: total,
      minutesPlanned,
      score,
      total,
      answers,
      questionsSnapshot,
    };

    setState((prev) => ({
      ...prev,
      quizSets: (prev.quizSets || []).map((set) => {
        if (set.id !== setId) return set;

        const oldAttempts = Array.isArray(set.attempts) ? set.attempts : [];
        const nextAttempts = [attempt, ...oldAttempts].slice(0, 4);

        return { ...set, attempts: nextAttempts };
      }),
    }));
  }

  /**
   * Calls the backend AI endpoint to generate MCQs for a quiz set.
   * Also tracks prompt history to reduce repeated questions across attempts.
   */
  async function generateWithAI(setId, count = 10) {
    const target = (state.quizSets || []).find((x) => x.id === setId);
    if (!target) return [];

    try {
      setGenerating(true);
      setError(
        "Generating quiz questions… This may take 30-60 seconds or more.",
      );

      const r = await fetch(`${API_BASE}/api/generate-mcqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: target.title,
          sourceText: target.sourceText,
          count,
          difficulty: "mixed",
          // Nonce helps encourage variation across repeated requests.
          nonce: crypto.randomUUID(),
          // Avoid prompts that were previously used (best-effort diversity).
          avoid: (target.promptHistory || target.questions || [])
            .map((q) => (typeof q === "string" ? q : q.prompt))
            .filter(Boolean)
            .slice(0, 60),
        }),
      });

      // Read raw text first so we can handle non-JSON responses gracefully.
      const raw = await r.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Server returned a non-JSON response." };
      }

      if (!r.ok) {
        setError(data.error || `AI generation failed (HTTP ${r.status}).`);
        return [];
      }

      const questions = Array.isArray(data.questions) ? data.questions : [];
      if (!questions.length) {
        setError("AI returned no questions. Try uploading more material.");
        return [];
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
        setError("AI returned questions in an unexpected format. Try again.");
        return [];
      }

      // Store generated questions + prompt history back into the set.
      setState((prev) => ({
        ...prev,
        quizSets: (prev.quizSets || []).map((set) => {
          if (set.id !== setId) return set;

          const newPrompts = questions.map((q) => q.prompt).filter(Boolean);
          const oldHistory = Array.isArray(set.promptHistory)
            ? set.promptHistory
            : [];

          return {
            ...set,
            questions,
            promptHistory: [...newPrompts, ...oldHistory].slice(0, 140),
          };
        }),
      }));

      setError("");
      return questions;
    } catch (err) {
      console.error(err);
      setError(err?.message || "AI generation failed.");
      return [];
    } finally {
      setGenerating(false);
    }
  }

  // Prevent double-start for the same (setId|count|mins) combination.
  const startedRef = useRef("");

  useEffect(() => {
    const setId = getQueryParam("setId");
    if (!setId) {
      setError("No quiz set selected.");
      return;
    }

    const count = getIntParam("count", 10);
    const mins = getIntParam("mins", count);

    const key = `${setId}:${count}:${mins}`;
    if (startedRef.current === key) return;
    startedRef.current = key;

    (async () => {
      const questions = await generateWithAI(setId, count);
      if (!questions.length) return;

      // Start timer (in seconds) and initialize UI state for a new attempt.
      start(mins * 60);
      startPractice(setId);

      // Normalize URL to reflect the active quiz settings.
      window.location.hash = `#/cbt?setId=${setId}&count=${count}&mins=${mins}`;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.quizSets]);

  /**
   * Retake generates a fresh set of questions again (best-effort diversity),
   * then restarts timer and resets attempt state.
   */
  async function onRetake() {
    if (!activeSetId) return;

    const count = getIntParam("count", 10);
    const mins = getIntParam("mins", count);

    const questions = await generateWithAI(activeSetId, count);
    if (!questions.length) return;

    start(mins * 60);
    startPractice(activeSetId);
  }

  // Read the configured count/mins for displaying in the HUD.
  const count = getIntParam("count", 10);
  const mins = getIntParam("mins", count);

  /**
   * Loading / error fallback UI when no active set is available yet
   * (e.g., while generating questions).
   */
  if (!activeSetId || !activeSet) {
    return (
      <section className="cbtShell card">
        <div className="cbtHeaderOnly">
          <h2 className="cbtTitle">CBT Room</h2>
          <p className="cbtMuted">
            {error || (generating ? "Preparing your quiz…" : "Loading…")}
          </p>
        </div>

        <button
          className="cbtBack"
          type="button"
          onClick={() => (window.location.hash = "#/quizSets")}
        >
          Back to Quiz Sets
        </button>
      </section>
    );
  }

  return (
    <div className="cbtPage">
      <section className="cbtHud">
        <div className="cbtHudLeft">
          <div className="cbtBadge">CBT Room</div>
          <div className="cbtSetTitle">{activeSet.title}</div>
          <div className="cbtMeta">
            <span className="cbtMetaItem">{count} questions</span>
            <span className="cbtMetaDot" aria-hidden="true" />
            <span className="cbtMetaItem">{mins} mins</span>
          </div>
        </div>

        <div className="cbtHudRight">
          {/* Surface any generation/runtime error messages */}
          {error && <div className="cbtError">{error}</div>}
        </div>
      </section>

      <PracticeMode
        activeSet={activeSet}
        currentIndex={currentIndex}
        selectedAnswer={selectedAnswer}
        setSelectedAnswer={setSelectedAnswer}
        attemptAnswers={attemptAnswers}
        setAttemptAnswers={setAttemptAnswers}
        score={score}
        showResult={showResult}
        onNext={handleNext}
        onExit={exitPractice}
        onRetake={onRetake}
        secondsLeft={secondsLeft}
        activeSetId={activeSetId}
        onFinishAttempt={() => {
          // Save attempt only when we have a valid set and questions snapshot.
          if (!activeSetId || !activeSet) return;

          saveAttemptForSet({
            setId: activeSetId,
            score,
            total: (activeSet.questions || []).length,
            answers: attemptAnswers,
            questionsSnapshot: activeSet.questions || [],
            minutesPlanned: mins,
          });
        }}
      />
    </div>
  );
}
