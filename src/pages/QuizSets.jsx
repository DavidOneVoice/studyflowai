import { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "../lib/storage";
import QuizSetsTable from "../components/quiz/QuizSetsTable";
import ConfirmModal from "../components/common/ConfirmModal";
import "./QuizSets.css";

export default function QuizSets() {
  const [state, setState] = useState(() => loadState());
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  useEffect(() => {
    function onHashChange() {
      setState(loadState());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  function openSet(setId) {
    window.location.hash = `#/quizSet?setId=${setId}`;
  }

  function confirmRemove(setId) {
    setConfirmRemoveId(setId);
  }

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
            <h2 className="qsTitle">Library</h2>
            <p className="qsSub">
              View your saved practice sets, reopen them anytime, and manage
              your stored learning materials.
            </p>
          </div>

          <div className="qsActions">
            <button
              className="qsPrimary"
              type="button"
              onClick={() => (window.location.hash = "#/practice")}
            >
              + New Practice Set
            </button>

            <button
              className="qsGhost"
              type="button"
              onClick={() => (window.location.hash = "#/notes")}
            >
              Open AI Notes
            </button>
          </div>
        </div>

        <div className="qsHintRow" aria-hidden="true">
          <span className="qsPill">Saved materials</span>
          <span className="qsPill qsPillAlt">Practice sets</span>
          <span className="qsPill">Attempt history</span>
        </div>
      </section>

      <QuizSetsTable
        quizSets={quizSets}
        onOpenSet={openSet}
        onRemoveSet={confirmRemove}
      />

      <ConfirmModal
        open={!!confirmRemoveId}
        title="Delete practice set?"
        message="This will permanently remove this practice set, including its questions, summary, and attempt history from this browser."
        confirmText="Yes, delete it"
        cancelText="Cancel"
        danger
        onCancel={() => setConfirmRemoveId(null)}
        onConfirm={handleRemoveConfirmed}
      />
    </div>
  );
}
