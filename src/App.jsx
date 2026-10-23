import { lazy, Suspense, useEffect, useState } from "react";
import { resetState } from "./lib/storage";
import { useAppState } from "./hooks/useAppState";
import ConfirmModal from "./components/common/ConfirmModal";
import "./App.css";
import "./styles/ui.css";

const Start = lazy(() => import("./pages/Start"));
const Planner = lazy(() => import("./pages/Planner"));
const Schedule = lazy(() => import("./pages/Schedule"));
const QuizBuilder = lazy(() => import("./pages/QuizBuilder"));
const Summaries = lazy(() => import("./pages/Summaries"));
const QuizSets = lazy(() => import("./pages/QuizSets"));
const QuizSetDetails = lazy(() => import("./pages/QuizSetDetails"));
const CBTRoom = lazy(() => import("./pages/CBTRoom"));

const PAGES = {
  home: { label: "Home", component: Start },
  plan: { label: "Study Plan", component: Planner },
  practice: { label: "Practice", component: QuizBuilder },
  notes: { label: "AI Notes", component: Summaries },
  library: { label: "Library", component: QuizSets },

  schedule: { label: "Schedule", component: Schedule },
  quizSet: { label: "Practice Set", component: QuizSetDetails },
  cbt: { label: "Practice Session", component: CBTRoom },
};

function normalizeHashKey(rawHash) {
  const raw = rawHash || "#/home";

  let key = raw.replace(/^#\/?/, "");
  key = key.split("?")[0].trim();
  key = key.replace(/\/+$/, "");
  const lower = key.toLowerCase();

  const ALIASES = {
    "": "home",
    start: "home",
    home: "home",

    planner: "plan",
    "study-plan": "plan",
    studyplan: "plan",
    plan: "plan",

    schedule: "schedule",
    timetable: "schedule",

    quiz: "practice",
    quizbuilder: "practice",
    practice: "practice",

    summaries: "notes",
    summary: "notes",
    notes: "notes",
    "ai-notes": "notes",
    ainotes: "notes",

    quizsets: "library",
    "quiz-sets": "library",
    library: "library",
    materials: "library",

    quizset: "quizSet",
    "quiz-set": "quizSet",
    quizsetdetails: "quizSet",
    "quiz-set-details": "quizSet",

    cbt: "cbt",
    exam: "cbt",
    cbtr: "cbt",
  };

  return ALIASES[lower] || lower;
}

function getHashPage(hash) {
  const normalized = normalizeHashKey(hash);
  return PAGES[normalized] ? normalized : "home";
}

export default function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState("");
  const [state, , storageError] = useAppState();
  const page = getHashPage(hash);
  const hasSchedule = state.schedule.length > 0;

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash);
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const ActivePage = PAGES[page].component;

  function go(to) {
    const next = PAGES[to] ? to : "home";
    setMenuOpen(false);
    window.location.hash = `#/${next}`;
    setHash(window.location.hash);
  }

  function confirmReset() {
    if (!resetState()) {
      setResetError("Your data could not be reset. Please try again.");
      return;
    }
    setResetError("");
    setShowResetConfirm(false);
    go("home");
  }

  return (
    <div className="app">
      <nav className="nav" aria-label="Main navigation">
        <div className="navLeft">
          <button
            className="brand"
            onClick={() => go("home")}
            aria-label="Go to Home"
            type="button"
          >
            <img
              src="/logo.png"
              alt="StudyFlow AI logo"
              className="brandIcon"
            />
            <span className="brandText">
              <span className="brandCram">StudyFlow</span>
              <span className="brandLess">AI</span>
            </span>
          </button>

          <p className="subtitle">Plan, learn and practice with AI.</p>
        </div>

        <button
          className="menuBtn"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="menuDot" />
          <span className="menuDot" />
          <span className="menuDot" />
        </button>

        <div
          id="main-navigation"
          className={menuOpen ? "navLinks open" : "navLinks"}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenuOpen(false);
              document.querySelector(".menuBtn")?.focus();
            }
          }}
        >
          <button
            className={page === "home" ? "navBtn active" : "navBtn"}
            onClick={() => go("home")}
            aria-current={page === "home" ? "page" : undefined}
            type="button"
          >
            Home
          </button>

          <button
            className={page === "plan" ? "navBtn active" : "navBtn"}
            onClick={() => go("plan")}
            aria-current={page === "plan" ? "page" : undefined}
            type="button"
          >
            Study Plan
          </button>

          {hasSchedule && (
            <button
              className={page === "schedule" ? "navBtn active" : "navBtn"}
              onClick={() => go("schedule")}
              aria-current={page === "schedule" ? "page" : undefined}
              type="button"
            >
              View Schedule
            </button>
          )}

          <button
            className={page === "practice" ? "navBtn active" : "navBtn"}
            onClick={() => go("practice")}
            aria-current={page === "practice" ? "page" : undefined}
            type="button"
          >
            Practice
          </button>

          <button
            className={page === "notes" ? "navBtn active" : "navBtn"}
            onClick={() => go("notes")}
            aria-current={page === "notes" ? "page" : undefined}
            type="button"
          >
            Summarize Notes
          </button>

          <button
            className={page === "library" ? "navBtn active" : "navBtn"}
            onClick={() => go("library")}
            aria-current={page === "library" ? "page" : undefined}
            type="button"
          >
            Library
          </button>

          <button
            className="navBtn danger"
            onClick={() => {
              setResetError("");
              setShowResetConfirm(true);
            }}
            type="button"
          >
            Reset Data
          </button>
        </div>
      </nav>

      <main className="page">
        {storageError && (
          <div className="appAlert" role="alert">{storageError}</div>
        )}
        <Suspense
          fallback={<p className="pageLoading" role="status">Loading {PAGES[page].label}…</p>}
        >
          <ActivePage key={hash} />
        </Suspense>
      </main>

      <ConfirmModal
        open={showResetConfirm}
        title="Reset all data?"
        message="This permanently removes your saved subjects, schedules, study materials, summaries, and practice results from this browser."
        error={resetError}
        confirmText="Reset Data"
        danger
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={confirmReset}
      />
    </div>
  );
}
