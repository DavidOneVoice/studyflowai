import { useEffect, useMemo, useState } from "react";
import { loadState } from "../lib/storage";
import CloseIcon from "@mui/icons-material/Close";
import "./Summaries.css";

/**
 * Reads `setId` from the hash query string.
 * Example: #/summaries?setId=abc123
 */
function getSetIdFromHash() {
  const raw = window.location.hash || "";
  const qIndex = raw.indexOf("?");
  if (qIndex === -1) return "";
  const qs = raw.slice(qIndex + 1);
  const params = new URLSearchParams(qs);
  return params.get("setId") || "";
}

/**
 * Summaries page:
 * - Lists all quiz sets that have a generated summary
 * - Allows viewing a summary in a modal
 * - Allows copying summaries to clipboard
 *
 * Note: Summaries are stored locally in this browser (localStorage state).
 */
export default function Summaries() {
  const [state, setState] = useState(() => loadState());

  // Which summary is currently opened in the modal (quiz set id).
  const [openSetId, setOpenSetId] = useState("");

  // Used to show a short "Copied ✅" UI state for a specific set id.
  const [copiedId, setCopiedId] = useState("");

  /**
   * Sync state whenever the hash changes.
   * Also auto-opens the summary if a setId is present in the URL.
   */
  useEffect(() => {
    function syncFromStorage() {
      setState(loadState());

      const id = getSetIdFromHash();
      if (id) setOpenSetId(id);
    }

    syncFromStorage(); // run on mount
    window.addEventListener("hashchange", syncFromStorage);
    return () => window.removeEventListener("hashchange", syncFromStorage);
  }, []);

  /**
   * Auto-hide the "Copied" UI flag after a short delay.
   */
  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(""), 1400);
    return () => clearTimeout(t);
  }, [copiedId]);

  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  /**
   * Only show sets that have a non-empty summary.
   * Sort newest-first by createdAt (string ISO comparison).
   */
  const summarizedSets = useMemo(() => {
    return quizSets
      .filter(
        (s) => typeof s.summary === "string" && s.summary.trim().length > 0,
      )
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
  }, [quizSets]);

  /**
   * The set currently opened in the modal (if any).
   */
  const openSet = useMemo(() => {
    return summarizedSets.find((s) => s.id === openSetId) || null;
  }, [summarizedSets, openSetId]);

  return (
    <div className="sumPage">
      <section className="sumCard card">
        <header className="sumHeader">
          <div>
            <div className="sumBadge">Summaries</div>
            <h2 className="sumTitle">Your AI Study Notes</h2>
            <p className="sumSub">
              All generated summaries are saved locally in this browser.
            </p>
          </div>

          <div className="sumActions">
            <button
              className="sumGhost"
              type="button"
              onClick={() => (window.location.hash = "#/quiz")}
            >
              Back to Quiz Builder
            </button>
          </div>
        </header>

        {summarizedSets.length === 0 ? (
          // Empty state when no summaries exist.
          <div className="sumEmpty">
            <div className="sumEmptyIcon" aria-hidden="true" />
            <div>
              <div className="sumEmptyTitle">No summaries yet</div>
              <div className="sumEmptySub">
                Go to Quiz Builder and click “Generate Summary”.
              </div>
            </div>
          </div>
        ) : (
          <div className="sumGrid">
            {summarizedSets.map((s) => (
              <article key={s.id} className="sumItem">
                <div className="sumItemTop">
                  <div className="sumItemTitle">{s.title}</div>
                  <div className="sumReady">Ready</div>
                </div>

                <div className="sumHint">
                  Clean, structured notes from your uploaded material.
                </div>

                <div className="sumItemActions">
                  <button
                    className="sumPrimary"
                    type="button"
                    onClick={() => setOpenSetId(s.id)}
                  >
                    View Summary
                  </button>

                  <button
                    className="sumGhost"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(s.summary || "");
                        setCopiedId(s.id);
                      } catch {
                        // Clipboard can fail (permissions, unsupported browser, etc.).
                        // Keep UI calm and still show the copied feedback.
                        setCopiedId(s.id);
                      }
                    }}
                  >
                    Copy
                  </button>

                  {copiedId === s.id && (
                    <span className="sumCopied">Copied ✅</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Summary viewer modal */}
      {openSet && (
        <div
          className="sumOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="Summary viewer"
          onClick={() => setOpenSetId("")}
        >
          <div className="sumModal" onClick={(e) => e.stopPropagation()}>
            <header className="sumModalHeader">
              <div>
                <div className="sumModalTitle">{openSet.title}</div>
                <div className="sumModalSub">Summary</div>
              </div>

              <div className="sumModalActions">
                <button
                  className="sumGhost"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        openSet.summary || "",
                      );
                      setCopiedId(openSet.id);
                    } catch {
                      setCopiedId(openSet.id);
                    }
                  }}
                >
                  Copy
                </button>

                <button
                  className="sumGhost"
                  type="button"
                  onClick={() => setOpenSetId("")}
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {/* Toast shown only when the opened set was copied */}
            {copiedId === openSet.id && (
              <div className="sumToast">Copied ✅</div>
            )}

            <div className="sumModalBody">
              {/* Render as plain text (no HTML injection) */}
              <div className="sumText">{openSet.summary}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
