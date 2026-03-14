import { useEffect, useMemo, useRef, useState } from "react";
import { loadState, saveState } from "../lib/storage";
import { useCountdown } from "../hooks/useCountdown";
import PracticeMode from "../components/quiz/PracticeMode";
import { API_BASE } from "../lib/api";
import "./CBTRoom.css";

function getQueryParam(name) {
  const hash = window.location.hash || "";
  const q = hash.split("?")[1] || "";
  const params = new URLSearchParams(q);
  return params.get(name) || "";
}

function getIntParam(name, fallback) {
  const v = Number(getQueryParam(name));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export default function CBTRoom() {
  const [state, setState] = useState(() => loadState());
  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const [activeSetId, setActiveSetId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [attemptAnswers, setAttemptAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);

  const { secondsLeft, isRunning, start, stop, reset } = useCountdown();

  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeSet = useMemo(
    () => quizSets.find((s) => s.id === activeSetId) || null,
    [quizSets, activeSetId],
  );

  const requestedCount = getIntParam("count", 10);
  const mins = getIntParam("mins", requestedCount);
  const actualQuestionCount = activeSet?.questions?.length || 0;

  useEffect(() => {
    if (activeSetId && isRunning === false && secondsLeft === 0) {
      if (!showResult) setShowResult(true);
    }
  }, [activeSetId, isRunning, secondsLeft, showResult]);

  function startPractice(setId) {
    setActiveSetId(setId);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAttemptAnswers({});
    setShowResult(false);
  }

  function exitPractice() {
    setActiveSetId(null);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAttemptAnswers({});
    setShowResult(false);
    stop();
    reset();

    const sid = getQueryParam("setId");
    window.location.hash = sid ? `#/quizSet?setId=${sid}` : "#/library";
  }

  function handleNext(answerOverride) {
    if (!activeSet) return;

    const q = activeSet.questions[currentIndex];
    const chosen =
      answerOverride ?? selectedAnswer ?? attemptAnswers?.[q?.id] ?? null;

    if (!chosen) return;

    if (currentIndex + 1 >= activeSet.questions.length) {
      setShowResult(true);
      stop();
      return;
    }

    setCurrentIndex((p) => p + 1);
    setSelectedAnswer(null);
  }

  function handlePrevious() {
    setCurrentIndex((idx) => Math.max(0, idx - 1));
    setSelectedAnswer(null);
  }

  function handleJump(targetIndex) {
    if (!activeSet?.questions?.length) return;

    const safeIndex = Math.min(
      Math.max(0, Number(targetIndex) || 0),
      activeSet.questions.length - 1,
    );

    setCurrentIndex(safeIndex);
    setSelectedAnswer(null);
  }

  const score = useMemo(() => {
    if (!activeSet?.questions?.length) return 0;

    return activeSet.questions.reduce((total, q) => {
      if (attemptAnswers?.[q.id] && attemptAnswers[q.id] === q.answer) {
        return total + 1;
      }

      return total;
    }, 0);
  }, [activeSet, attemptAnswers]);

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

  async function generateWithAI(setId, count = 10) {
    const target = (state.quizSets || []).find((x) => x.id === setId);
    if (!target) return null;

    try {
      setGenerating(true);
      setError("");

      console.log("QUIZ sourceText length:", target.sourceText?.length || 0);
      console.log("Requested count:", count);
      console.log("API_BASE:", API_BASE);
      console.log("MCQ endpoint:", `${API_BASE}/api/generate-mcqs`);

      const r = await fetch(`${API_BASE}/api/generate-mcqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: target.title,
          sourceText: target.sourceText,
          count,
          difficulty: "mixed",
          nonce: crypto.randomUUID(),

          // temporary test
          avoid: [],
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
        setError(data.error || `AI generation failed (HTTP ${r.status}).`);
        return null;
      }

      const questions = Array.isArray(data.questions) ? data.questions : [];

      if (!questions.length) {
        setError("AI returned no questions. Try uploading more material.");
        return null;
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
        setError("AI returned questions in an unexpected format. Try again.");
        return null;
      }

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

      if (data.warning) {
        setError(data.warning);
      } else {
        setError("");
      }

      return questions;
    } catch (err) {
      console.error(err);
      setError(err?.message || "AI generation failed.");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  const startedRef = useRef("");

  useEffect(() => {
    const setId = getQueryParam("setId");
    if (!setId) {
      setError("No practice set selected.");
      return;
    }

    const count = getIntParam("count", 10);
    const durationMins = getIntParam("mins", count);

    const key = `${setId}:${count}:${durationMins}`;
    if (startedRef.current === key) return;
    startedRef.current = key;

    (async () => {
      const questions = await generateWithAI(setId, count);
      if (!questions || !questions.length) return;

      start(durationMins * 60);
      startPractice(setId);

      window.location.hash = `#/cbt?setId=${setId}&count=${count}&mins=${durationMins}`;
    })();
  }, [start]);

  async function onRetake() {
    if (!activeSetId) return;

    const count = getIntParam("count", 10);
    const durationMins = getIntParam("mins", count);

    setError("Generating new practice questions…");

    const questions = await generateWithAI(activeSetId, count);

    if (!questions || !questions.length) return;

    setError("");
    start(durationMins * 60);
    startPractice(activeSetId);
  }

  if (!activeSetId || !activeSet) {
    return (
      <section className="cbtShell card">
        <div className="cbtHeaderOnly">
          <h2 className="cbtTitle">Practice Session</h2>

          {error ? (
            <p className="cbtMuted">{error}</p>
          ) : generating ? (
            <div className="practiceFancyStatus">
              <div className="fancy-loader-wrapper">
                {"Generating".split("").map((letter, index) => (
                  <span
                    key={`${letter}-${index}`}
                    className="fancy-loader-letter"
                    style={{ animationDelay: `${0.1 + index * 0.105}s` }}
                  >
                    {letter}
                  </span>
                ))}
                <div className="fancy-loader"></div>
              </div>

              <div className="bubbleEffectWrap">
                <div className="Strich1">
                  <div className="Strich2">
                    <div className="bubble"></div>
                    <div className="bubble1"></div>
                    <div className="bubble2"></div>
                    <div className="bubble3"></div>
                  </div>
                </div>
              </div>

              <div className="glitchLoader">
                <div data-glitch="Loading..." className="glitch">
                  Loading...
                </div>
              </div>

              <p className="cbtMuted">This may take a little while.</p>
            </div>
          ) : (
            <p className="cbtMuted">Loading…</p>
          )}
        </div>

        <button
          className="cbtBack"
          type="button"
          onClick={() => (window.location.hash = "#/library")}
        >
          Back to Library
        </button>
      </section>
    );
  }

  return (
    <div className="cbtPage">
      <section className="cbtHud">
        <div className="cbtHudLeft">
          <div className="cbtBadge">Practice Mode</div>
          <div className="cbtSetTitle">{activeSet.title}</div>
          <div className="cbtMeta">
            <span className="cbtMetaItem">{actualQuestionCount} questions</span>
            <span className="cbtMetaDot" aria-hidden="true" />
            <span className="cbtMetaItem">{mins} mins</span>
          </div>
        </div>

        <div className="cbtHudRight">
          {error && <div className="cbtError">{error}</div>}
        </div>
      </section>

      {generating && (
        <div className="cbtLoading">Generating new questions…</div>
      )}

      <PracticeMode
        generating={generating}
        activeSet={activeSet}
        currentIndex={currentIndex}
        selectedAnswer={selectedAnswer}
        setSelectedAnswer={setSelectedAnswer}
        attemptAnswers={attemptAnswers}
        setAttemptAnswers={setAttemptAnswers}
        score={score}
        showResult={showResult}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onJump={handleJump}
        onExit={exitPractice}
        onRetake={onRetake}
        secondsLeft={secondsLeft}
        activeSetId={activeSetId}
        onFinishAttempt={() => {
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
