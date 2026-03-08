import "./QuizSetsTable.css";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * QuizSetsTable displays all saved quiz sets and provides actions to:
 * - Open a set (enter the CBT room for that set)
 * - Remove a set
 */
export default function QuizSetsTable({
  quizSets = [],
  onOpenSet,
  onRemoveSet,
}) {
  return (
    <section className="qstCard">
      <div className="qstTop">
        <h3 className="qstTitle">Saved Sets</h3>
        {/* Display count with correct pluralization */}
        <div className="qstCount">
          {quizSets.length} set{quizSets.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Empty state when no sets exist */}
      {quizSets.length === 0 ? (
        <div className="qstEmpty">
          <div className="qstEmptyIcon" aria-hidden="true" />
          <div className="qstEmptyText">
            <div className="qstEmptyTitle">No saved sets yet</div>
            <div className="qstEmptySub">
              Create a quiz set to generate MCQs anytime.
            </div>
          </div>
        </div>
      ) : (
        // Table-like structure using ARIA roles for accessibility.
        <div className="qstTable" role="table" aria-label="Quiz sets table">
          <div className="qstRow qstHead" role="row">
            <div role="columnheader">Title</div>
            <div role="columnheader">Actions</div>
          </div>

          {quizSets.map((s) => (
            <div className="qstRow" role="row" key={s.id}>
              <div className="qstName" role="cell">
                {s.title}
              </div>

              <div className="qstActions" role="cell">
                {/* Opens the selected set (parent decides what "open" does) */}
                <button
                  className="qstOpen"
                  type="button"
                  onClick={() => onOpenSet?.(s.id)}
                >
                  CBT Room
                </button>

                {/* Removes the selected set (parent handles deletion) */}
                <button
                  className="qstRemove"
                  type="button"
                  onClick={() => onRemoveSet?.(s.id)}
                >
                  <DeleteForeverIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="qstFooter">
        Open a set to take quiz, view attempts, and manage summaries.
      </p>
    </section>
  );
}
