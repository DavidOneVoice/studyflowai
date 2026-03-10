import { useState } from "react";
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
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section className="qbCard">
      <header className="qbHeader">
        <div className="qbHeaderTop">
          <div className="qbBadge">Practice</div>
          <div className="qbBadges">
            <span className="qbChip">PDF</span>
            <span className="qbChip">DOCX</span>
            <span className="qbChip">TXT</span>
          </div>
        </div>

        <h2 className="qbTitle">Turn your notes into practice questions.</h2>
        <p className="qbSub">
          Upload your material, save it, and generate practice questions with
          StudyFlow AI whenever you’re ready to test yourself.
        </p>
      </header>

      <div className="qbBody">
        <div className="qbGrid">
          <div className="qbField">
            <label className="qbLabel">Practice set title</label>
            <input
              className="qbInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chemistry — Equilibrium"
            />
          </div>

          {courses.length > 0 && (
            <div className="qbField">
              <label className="qbLabel">Link to subject (optional)</label>
              <select
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
          <label className="qbLabel">Upload material</label>

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
              className="qbFile"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={onFileUpload}
            />

            <div className="qbUploadIcon" aria-hidden="true" />

            <div className="qbUploadHint">
              <div className="qbUploadTitle">Upload your study material</div>
              <div className="qbUploadSub">
                PDF / DOCX / TXT — Drag & drop or click to browse
              </div>
            </div>
          </div>

          {fileInfo && (
            <div className="qbFileInfo">
              <span className="qbFileTag">Selected</span>
              <strong className="qbFileName">{fileInfo}</strong>
            </div>
          )}
        </div>

        <div className="qbField">
          <label className="qbLabel">Or paste material</label>
          <textarea
            className="qbTextarea"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste notes, slides, textbook excerpts, handouts, or any learning material..."
            rows={10}
          />
          <div className="qbCounter">
            {Math.min(sourceText?.length || 0, 999999).toLocaleString()} chars
          </div>
        </div>

        {error && <div className="qbError">{error}</div>}

        <div className="qbActions">
          <button className="qbPrimary" type="button" onClick={onSave}>
            Save Practice Set
          </button>
        </div>
      </div>
    </section>
  );
}
