import { useId, useRef, useState } from "react";
import "./QuizBuilderForm.css";

export default function QuizBuilderForm({
  title,
  setTitle,
  sourceText,
  setSourceText,
  fileInfo,
  error,
  onFileUpload,
  onSave,
  courses = [],
  selectedCourseId = "",
  setSelectedCourseId = () => {},
  isReading = false,
  intent = "practice",
}) {
  const [isDragging, setIsDragging] = useState(false);
  const id = useId();
  const fileInputRef = useRef(null);
  const isSummary = intent === "summary";

  return (
    <section className="qbCard">
      <header className="qbHeader">
        <div className="qbHeaderTop">
          <div className="qbBadge">{isSummary ? "Summary" : "Practice"}</div>
          <div className="qbBadges">
            <span className="qbChip">PDF</span>
            <span className="qbChip">DOCX</span>
            <span className="qbChip">TXT</span>
          </div>
        </div>

        <h2 className="qbTitle">
          {isSummary
            ? "Turn your notes into a study summary."
            : "Turn your notes into practice questions."}
        </h2>
        <p className="qbSub">
          {isSummary
            ? "Upload or paste your material, save it, and continue to create your AI summary."
            : "Upload your material, save it, and generate practice questions with StudyFlow AI whenever you’re ready to test yourself."}
        </p>
      </header>

      <div className="qbBody">
        <div className="qbGrid">
          <div className="qbField">
            <label className="qbLabel" htmlFor={`${id}-title`}>
              {isSummary ? "Material title" : "Practice set title"}
            </label>
            <input
              id={`${id}-title`}
              className="qbInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chemistry — Equilibrium"
            />
          </div>

          {courses.length > 0 && (
            <div className="qbField">
              <label className="qbLabel" htmlFor={`${id}-subject`}>Link to subject (optional)</label>
              <select
                id={`${id}-subject`}
                className="qbSelect"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                <option value="">— Not linked —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="qbHelp">
                Linking makes it easier to launch practice directly from your
                study plan.
              </p>
            </div>
          )}
        </div>

        <div className="qbField">
          <label className="qbLabel" htmlFor={`${id}-file`}>Upload material</label>

          <div
            className={`qbUpload ${isDragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              onFileUpload?.({ target: { files: e.dataTransfer.files } });
            }}
          >
            <input
              ref={fileInputRef}
              id={`${id}-file`}
              className="qbFile"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                onFileUpload?.({ target: { files } });
                event.target.value = "";
              }}
            />

            <div className="qbUploadIcon" aria-hidden="true" />

            <div className="qbUploadHint">
              <div className="qbUploadTitle">Upload your study material</div>
              <div className="qbUploadSub">
                PDF / DOCX / TXT — Drag & drop or click to browse
              </div>
            </div>
          </div>

          {(fileInfo || isReading) && (
            <div className="qbFileInfo">
              <span className="qbFileTag">{isReading ? "Reading…" : "Selected"}</span>
              <strong className="qbFileName">{fileInfo}</strong>
              <button
                type="button"
                className="qbClearFile"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  onFileUpload?.({ target: { files: [] } });
                }}
              >
                Clear file
              </button>
            </div>
          )}
          {isReading && (
            <p className="qbHelp" role="status">
              Reading your document… You can choose another file or paste material to replace it.
            </p>
          )}
        </div>

        <div className="qbField">
          <label className="qbLabel" htmlFor={`${id}-source`}>Or paste material</label>
          <textarea
            id={`${id}-source`}
            className="qbTextarea"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste notes, slides, textbook excerpts, handouts, or any learning material..."
            rows={10}
          />
          <div className="qbCounter">
            {(sourceText?.length || 0).toLocaleString()} chars
          </div>
        </div>

        {error && <div className="qbError" role="alert">{error}</div>}

        <div className="qbActions">
          <button className="qbPrimary" type="button" onClick={onSave} disabled={isReading}>
            {isReading
              ? "Reading document…"
              : isSummary
                ? "Save & Continue to Summary"
                : "Save Practice Set"}
          </button>
        </div>
      </div>
    </section>
  );
}
