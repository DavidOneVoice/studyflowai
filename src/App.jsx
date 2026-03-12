import { useEffect, useMemo, useState } from "react";
import { resetState } from "./lib/storage";
import "./App.css";
import "./styles/ui.css";

import Start from "./pages/Start";
import Planner from "./pages/Planner";
import Schedule from "./pages/Schedule";
import QuizBuilder from "./pages/QuizBuilder";
import Summaries from "./pages/Summaries";
import QuizSets from "./pages/QuizSets";
import QuizSetDetails from "./pages/QuizSetDetails";
import CBTRoom from "./pages/CBTRoom";

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

function getHashPage() {
  const normalized = normalizeHashKey(window.location.hash);
  return PAGES[normalized] ? normalized : "home";
}

export default function App() {
  const [page, setPage] = useState(() => getHashPage());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => setPage(getHashPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [page]);

  const ActivePage = useMemo(() => PAGES[page].component, [page]);

  function go(to) {
    const next = PAGES[to] ? to : "home";
    setPage(next);
    window.location.hash = `#/${next}`;
  }

  return (
    <div className="app">
      <nav className="nav">
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

          <p className="subtitle">Plan, learn, and practice with AI.</p>
        </div>

        <button
          className="menuBtn"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="menuDot" />
          <span className="menuDot" />
          <span className="menuDot" />
        </button>

        <div className={menuOpen ? "navLinks open" : "navLinks"}>
          <button
            className={page === "home" ? "navBtn active" : "navBtn"}
            onClick={() => go("home")}
            type="button"
          >
            Home
          </button>

          <button
            className={page === "plan" ? "navBtn active" : "navBtn"}
            onClick={() => go("plan")}
            type="button"
          >
            Study Plan
          </button>

          <button
            className={page === "practice" ? "navBtn active" : "navBtn"}
            onClick={() => go("practice")}
            type="button"
          >
            Practice
          </button>

          <button
            className={page === "notes" ? "navBtn active" : "navBtn"}
            onClick={() => go("notes")}
            type="button"
          >
            Summarize Notes
          </button>

          <button
            className={page === "library" ? "navBtn active" : "navBtn"}
            onClick={() => go("library")}
            type="button"
          >
            Library
          </button>

          <button
            className="navBtn danger"
            onClick={() => {
              resetState();
              window.location.hash = "#/home";
              window.location.reload();
            }}
            type="button"
          >
            Reset Data
          </button>
        </div>
      </nav>

      <main className="page">
        <ActivePage />
      </main>
    </div>
  );
}
