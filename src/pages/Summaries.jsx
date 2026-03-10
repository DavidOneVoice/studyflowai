import { useEffect, useMemo, useState } from "react";
import { loadState } from "../lib/storage";
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
  const [state, setState] = useState(() => loadState());
  const [openSetId, setOpenSetId] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    function syncFromStorage() {
      setState(loadState());
      const id = getSetIdFromHash();
      if (id) setOpenSetId(id);
    }

    syncFromStorage();
    window.addEventListener("hashchange", syncFromStorage);
    return () => window.removeEventListener("hashchange", syncFromStorage);
  }, []);

  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(""), 1400);
    return () => clearTimeout(t);
  }, [copiedId]);

  const quizSets = useMemo(() => state.quizSets || [], [state.quizSets]);

  const summarizedSets = useMemo(() => {
    return quizSets
      .filter(
        (s) => typeof s.summary === "string" && s.summary.trim().length > 0,
      )
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
  }, [quizSets]);

  const openSet = useMemo(() => {
    return summarizedSets.find((s) => s.id === openSetId) || null;
  }, [summarizedSets, openSetId]);

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
            <button
              className="sumGhost"
              type="button"
              onClick={() => (window.location.hash = "#/practice")}
            >
              Back to Practice
            </button>
          </div>
        </header>

        {summarizedSets.length === 0 ? (
          <div className="sumEmpty">
            <div className="sumEmptyIcon" aria-hidden="true" />
            <div>
              <div className="sumEmptyTitle">No AI notes yet</div>
              <div className="sumEmptySub">
                Open a practice set and generate AI notes from your material.
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
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(s.summary || "");
                        setCopiedId(s.id);
                      } catch {
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

      {openSet && (
        <div
          className="sumOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="AI notes viewer"
          onClick={() => setOpenSetId("")}
        >
          <div className="sumModal" onClick={(e) => e.stopPropagation()}>
            <header className="sumModalHeader">
              <div>
                <div className="sumModalTitle">{openSet.title}</div>
                <div className="sumModalSub">AI Notes</div>
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

            {copiedId === openSet.id && (
              <div className="sumToast">Copied ✅</div>
            )}

            <div className="sumModalBody">
              <div className="sumText">{openSet.summary}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
