import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../hooks/useAppState";
import { useCountdown } from "../hooks/useCountdown";
import PracticeMode from "../components/quiz/PracticeMode";
import { API_BASE } from "../lib/api";
import { createOnceRequest, requestPracticeQuestions, saveGeneratedQuestions, savePracticeAttempt } from "../lib/practiceSession";
import "./CBTRoom.css";

function getLaunch(quizSets) {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const positiveInteger = (name, fallback) => {
    const value = Number(params.get(name));
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
  };
  const count = positiveInteger("count", 10);
  const setId = params.get("setId") || "";
  return { setId, set: quizSets.find((set) => set.id === setId), count, minutes: positiveInteger("mins", count) };
}

export default function CBTRoom() {
  const [state, setState] = useAppState();
  // App remounts this page when its route changes; a launch owns one request.
  const [launch] = useState(() => getLaunch(state.quizSets || []));
  const [initialRequest] = useState(() => createOnceRequest(() => requestPracticeQuestions({ set: launch.set, count: launch.count, apiBase: API_BASE })));
  const [session, setSession] = useState(null);
  const [pendingSession, setPendingSession] = useState(null);
  const [error, setError] = useState("");
  const [resultSaveError, setResultSaveError] = useState("");
  const [generating, setGenerating] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [attemptAnswers, setAttemptAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const inFlight = useRef(true);
  const mounted = useRef(false);
  const completedAttempt = useRef(null);
  const { secondsLeft, expired, start, stop, reset } = useCountdown();

  const activeSet = session?.set || null;
  const activeSetId = activeSet?.id || null;
  const showResult = Boolean(session) && (finished || expired);
  const score = useMemo(() => (activeSet?.questions || []).reduce((total, question) => total + (attemptAnswers[question.id] === question.answer ? 1 : 0), 0), [activeSet, attemptAnswers]);

  const beginSession = useCallback((candidate) => {
    const saved = setState((previous) => saveGeneratedQuestions(previous, candidate.set.id, candidate.set.questions));
    if (!saved) {
      setPendingSession(candidate);
      setError("Your questions are ready but could not be saved. Retry saving to start without generating them again.");
      return false;
    }
    completedAttempt.current = null;
    setPendingSession(null);
    setSession(candidate);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAttemptAnswers({});
    setFinished(false);
    setError(candidate.warning || "");
    setResultSaveError("");
    start(candidate.minutes * 60);
    return true;
  }, [setState, start]);

  useEffect(() => {
    mounted.current = true;
    let subscribed = true;
    initialRequest().then((result) => {
      if (!subscribed) return;
      inFlight.current = false;
      setGenerating(false);
      beginSession({ id: crypto.randomUUID(), set: { ...launch.set, questions: result.questions }, minutes: launch.minutes, warning: result.warning });
    }).catch((failure) => {
      if (!subscribed) return;
      inFlight.current = false;
      setGenerating(false);
      setError(failure?.message || "Question generation failed.");
    });
    return () => { subscribed = false; mounted.current = false; };
  }, [initialRequest, launch, beginSession]);

  function exitPractice() {
    if (showResult && !finishAttempt()) return;
    stop();
    reset();
    window.location.hash = launch.setId ? `#/quizSet?setId=${encodeURIComponent(launch.setId)}` : "#/library";
  }

  function handleNext(answerOverride) {
    if (!activeSet || showResult) return;
    const question = activeSet.questions[currentIndex];
    const chosen = answerOverride ?? selectedAnswer ?? attemptAnswers[question.id];
    if (!chosen) return;
    setAttemptAnswers((answers) => ({ ...answers, [question.id]: chosen }));
    if (currentIndex + 1 >= activeSet.questions.length) {
      setFinished(true);
      stop();
    } else {
      setCurrentIndex((index) => index + 1);
      setSelectedAnswer(null);
    }
  }

  function handlePrevious() {
    setCurrentIndex((index) => Math.max(0, index - 1));
    setSelectedAnswer(null);
  }

  function handleJump(targetIndex) {
    if (!activeSet?.questions.length) return;
    setCurrentIndex(Math.min(Math.max(0, Number(targetIndex) || 0), activeSet.questions.length - 1));
    setSelectedAnswer(null);
  }

  function finishAttempt() {
    if (!session || !showResult) return false;
    if (!completedAttempt.current || completedAttempt.current.id !== session.id) {
      completedAttempt.current = {
        id: session.id, takenAt: new Date().toISOString(),
        questionCount: activeSet.questions.length, minutesPlanned: session.minutes,
        score, total: activeSet.questions.length, answers: { ...attemptAnswers },
        questionsSnapshot: activeSet.questions,
      };
    }
    const saved = setState((previous) => savePracticeAttempt(previous, activeSetId, completedAttempt.current));
    setResultSaveError(saved ? "" : "Your result could not be saved. Retry saving it before leaving or starting another session.");
    return saved;
  }

  async function generateNewSession() {
    if (inFlight.current) return;
    // Retaking must never discard the answers of an unsaved completed attempt.
    if (showResult && !finishAttempt()) return;
    inFlight.current = true;
    setGenerating(true);
    setError("");
    try {
      const currentSet = (state.quizSets || []).find((set) => set.id === launch.setId);
      const result = await requestPracticeQuestions({ set: currentSet, count: launch.count, apiBase: API_BASE });
      if (mounted.current) beginSession({ id: crypto.randomUUID(), set: { ...currentSet, questions: result.questions }, minutes: launch.minutes, warning: result.warning });
    } catch (failure) {
      if (mounted.current) setError(failure?.message || "Question generation failed.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setGenerating(false);
    }
  }

  if (!activeSet || pendingSession) {
    return (
      <section className="cbtShell card">
        <div className="cbtHeaderOnly">
          <h2 className="cbtTitle">Practice Session</h2>
          {generating ? (
            <div className="practiceFancyStatus" role="status">
              <div className="fancy-loader-wrapper">
                {"Generating".split("").map((letter, index) => <span key={`${letter}-${index}`} className="fancy-loader-letter" style={{ animationDelay: `${0.1 + index * 0.105}s` }}>{letter}</span>)}
                <div className="fancy-loader" />
              </div>
              <p className="cbtMuted">Preparing your questions. This may take a little while.</p>
            </div>
          ) : <p className="cbtMuted" role="alert">{error}</p>}
        </div>
        {pendingSession && <button className="cbtBack" type="button" onClick={() => beginSession(pendingSession)}>Retry Saving and Start</button>}
        {!generating && !pendingSession && launch.set && <button className="cbtBack" type="button" onClick={generateNewSession}>Try Again</button>}
        <button className="cbtBack" type="button" onClick={exitPractice}>Back to Library</button>
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
            <span className="cbtMetaItem">{activeSet.questions.length} questions</span>
            <span className="cbtMetaDot" aria-hidden="true" />
            <span className="cbtMetaItem">{session.minutes} mins</span>
          </div>
        </div>
        <div className="cbtHudRight">{(resultSaveError || error) && <div className="cbtError" role="alert">{resultSaveError || error}</div>}</div>
      </section>
      {generating && <div className="cbtLoading" role="status">Generating new questions…</div>}
      <PracticeMode
        generating={generating} activeSet={activeSet} activeSetId={activeSetId} sessionId={session.id}
        currentIndex={currentIndex} selectedAnswer={selectedAnswer} setSelectedAnswer={setSelectedAnswer}
        attemptAnswers={attemptAnswers} setAttemptAnswers={setAttemptAnswers}
        score={score} showResult={showResult}
        onNext={handleNext} onPrevious={handlePrevious} onJump={handleJump}
        onExit={exitPractice} onRetake={generateNewSession}
        secondsLeft={secondsLeft} onFinishAttempt={finishAttempt}
      />
    </div>
  );
}
