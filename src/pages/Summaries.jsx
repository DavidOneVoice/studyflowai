import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../hooks/useAppState";
import AccessibleModal from "../components/common/AccessibleModal";
import CloseIcon from "@mui/icons-material/Close";
import "./Summaries.css";

function getSetIdFromHash() {
  const raw = window.location.hash || "";
  const qIndex = raw.indexOf("?");
  if (qIndex === -1) return "";
  const qs = raw.slice(qIndex + 1);
  const params = new URLSearchParams(qs);
  return params.get("setId") || "";
}

export default function Summaries() {
  const [state] = useAppState();
  const [openSetId, setOpenSetId] = useState(getSetIdFromHash);
  const [copiedId, setCopiedId] = useState("");
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(""), 1400);
    return () => clearTimeout(t);
  }, [copiedId]);

  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  const summarizedSets = useMemo(() => {
    return quizSets
      .filter(
        (s) => typeof s?.summary === "string" && s.summary.trim().length > 0,
      )
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
  }, [quizSets]);

  const openSet = useMemo(() => {
    return summarizedSets.find((s) => s.id === openSetId) || null;
  }, [summarizedSets, openSetId]);

  async function copyNotes(set) {
    setCopiedId("");
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(set.summary || "");
      setCopiedId(set.id);
    } catch {
      setCopyError("Could not copy automatically. Open the notes, select the text, and copy it manually.");
    }
  }

  return (
    <div className="sumPage">
      <section className="sumCard card">
        <header className="sumHeader">
          <div>
            <div className="sumBadge">AI Notes</div>
            <h2 className="sumTitle">Your saved AI notes</h2>
            <p className="sumSub">
              All generated notes are saved locally in this browser for quick
              revision anytime.
            </p>
          </div>

          <div className="sumActions">
            <button className="sumPrimary" type="button" onClick={() => (window.location.hash = "#/practice?intent=summary")}>
              Create AI Notes
            </button>
            <button
              className="sumGhost"
              type="button"
              onClick={() => (window.location.hash = "#/library")}
            >
              Back to Library
            </button>
          </div>
        </header>

        {copyError && <p className="sumCopyError" role="alert">{copyError}</p>}
        {summarizedSets.length === 0 ? (
          <div className="sumEmpty">
            <div className="sumEmptyIcon" aria-hidden="true" />
            <div>
              <div className="sumEmptyTitle">No summaries generated yet</div>
              <div className="sumEmptySub">
                Choose Create AI Notes to upload or paste material, or open a saved set in your library.
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
                  Clean, readable notes generated from your learning material.
                </div>

                <div className="sumItemActions">
                  <button
                    className="sumPrimary"
                    type="button"
                    onClick={() => setOpenSetId(s.id)}
                  >
                    View Notes
                  </button>

                  <button
                    className="sumGhost"
                    type="button"
                    onClick={() => copyNotes(s)}
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

      {openSet && (
        <AccessibleModal
          open={Boolean(openSet)} onClose={() => setOpenSetId("")}
          label="AI notes viewer" overlayClassName="sumOverlay" className="sumModal"
        >
            <header className="sumModalHeader">
              <div>
                <div className="sumModalTitle">{openSet.title}</div>
                <div className="sumModalSub">AI Notes</div>
              </div>

              <div className="sumModalActions">
                <button
                  className="sumGhost"
                  type="button"
                  onClick={() => copyNotes(openSet)}
                >
                  Copy
                </button>

                <button
                  className="sumGhost"
                  type="button"
                  onClick={() => setOpenSetId("")}
                  aria-label="Close AI notes"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {copyError && <p className="sumCopyError" role="alert">{copyError}</p>}
            {copiedId === openSet.id && (
              <div className="sumToast">Copied ✅</div>
            )}

            <div className="sumModalBody">
              <div className="sumText">{openSet.summary}</div>
            </div>
        </AccessibleModal>
      )}
    </div>
  );
}
