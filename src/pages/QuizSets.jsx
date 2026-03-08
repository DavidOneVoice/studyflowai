import { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "../lib/storage";
import QuizSetsTable from "../components/quiz/QuizSetsTable";
import ConfirmModal from "../components/common/ConfirmModal";
import "./QuizSets.css";

/**
 * QuizSets page:
 * - Lists all saved quiz sets (stored locally in this browser)
 * - Allows opening a set's details page
 * - Allows deleting a set (with confirmation)
 * - Provides shortcuts to create a new set and to view summaries
 */
export default function QuizSets() {
  const [state, setState] = useState(() => loadState());

  // Stores the set id that is pending deletion confirmation.
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  /**
   * Keep this page in sync when navigation changes the hash route.
   * This is useful because other pages may modify localStorage state,
   * and returning here should reflect the latest saved data.
   */
  useEffect(() => {
    function onHashChange() {
      setState(loadState());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  /**
   * Persist state changes to localStorage.
   */
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Memoize the quizSets list for stable rendering.
  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  /** Navigates to the quiz set details page. */
  function openSet(setId) {
    window.location.hash = `#/quizSet?setId=${setId}`;
  }

  /** Opens the delete confirmation modal for a specific set id. */
  function confirmRemove(setId) {
    setConfirmRemoveId(setId);
  }

  /**
   * Deletes the selected quiz set after confirmation.
   * This removes the set along with its saved questions, summary, and attempts.
   */
  function handleRemoveConfirmed() {
    if (!confirmRemoveId) return;

    setState((prev) => ({
      ...prev,
      quizSets: (prev.quizSets || []).filter((s) => s.id !== confirmRemoveId),
    }));

    setConfirmRemoveId(null);
  }

  return (
    <div className="qsPage">
      <section className="qsHeader card">
        <div className="qsHeaderTop">
          <div className="qsTitleBlock">
            <h2 className="qsTitle">Quiz Sets</h2>
            <p className="qsSub">
              Open a set to take quizzes, manage summaries, and view attempts.
            </p>
          </div>

          <div className="qsActions">
            {/* Navigate to the Quiz Builder page */}
            <button
              className="qsPrimary"
              type="button"
              onClick={() => (window.location.hash = "#/quiz")}
            >
              + Create Quiz Set
            </button>

            {/* Navigate to Summaries page */}
            <button
              className="qsGhost"
              type="button"
              onClick={() => (window.location.hash = "#/summaries")}
            >
              Go to Summaries
            </button>
          </div>
        </div>

        {/* Visual hints only (not needed for screen readers) */}
        <div className="qsHintRow" aria-hidden="true">
          <span className="qsPill">Save materials</span>
          <span className="qsPill qsPillAlt">Generate MCQs</span>
          <span className="qsPill">Track attempts</span>
        </div>
      </section>

      <QuizSetsTable
        quizSets={quizSets}
        onOpenSet={openSet}
        onRemoveSet={confirmRemove}
      />

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!confirmRemoveId}
        title="Delete Quiz Set?"
        message="This will permanently remove this quiz set, its questions, summary, and attempts from this browser."
        confirmText="Yes, delete it"
        cancelText="Cancel"
        danger
        onCancel={() => setConfirmRemoveId(null)}
        onConfirm={handleRemoveConfirmed}
      />
    </div>
  );
}
