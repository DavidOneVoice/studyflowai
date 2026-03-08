import { useState } from "react";
import "./QuizBuilderForm.css";

/**
 * QuizBuilderForm allows users to create a quiz set by:
 * - Entering a title
 * - (Optionally) linking the set to an existing course
 * - Uploading course material (PDF/DOCX/TXT) OR pasting text directly
 *
 * All core form values are controlled by the parent via props.
 */
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
  // Used only to style the upload area while dragging a file over it.
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section className="qbCard">
      <header className="qbHeader">
        <div className="qbHeaderTop">
          <div className="qbBadge">Quiz Builder</div>
          <div className="qbBadges">
            <span className="qbChip">PDF</span>
            <span className="qbChip">DOCX</span>
            <span className="qbChip">TXT</span>
          </div>
        </div>

        <h2 className="qbTitle">Turn your notes into practice questions.</h2>
        <p className="qbSub">
          Upload your course material and save it as a quiz set. When you click
          “Take Quiz”, CramLess generates high-quality MCQs from your material.
        </p>
      </header>

      <div className="qbBody">
        <div className="qbGrid">
          <div className="qbField">
            <label className="qbLabel">Set title</label>
            <input
              className="qbInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chemistry — Equilibrium"
            />
          </div>

          {/* Only show course linking when courses exist */}
          {courses.length > 0 && (
            <div className="qbField">
              <label className="qbLabel">Link to Course (optional)</label>
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
                Linking helps you launch quizzes directly from the Study
                Planner.
              </p>
            </div>
          )}
        </div>

        <div className="qbField">
          <label className="qbLabel">Upload course material</label>

          {/* Drag-and-drop upload zone (also supports click-to-browse) */}
          <div
            className={`qbUpload ${isDragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              // Needed to allow dropping in the browser.
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              // Convert dropped files into a shape compatible with the existing onFileUpload handler.
              e.preventDefault();
              setIsDragging(false);
              onFileUpload?.({ target: { files: e.dataTransfer.files } });
            }}
          >
            <input
              className="qbFile"
              type="file"
              // Restrict accepted file types to supported formats.
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

          {/* Displays the currently selected file name/info */}
          {fileInfo && (
            <div className="qbFileInfo">
              <span className="qbFileTag">Selected</span>
              <strong className="qbFileName">{fileInfo}</strong>
            </div>
          )}
        </div>

        <div className="qbField">
          <label className="qbLabel">Or paste course material</label>
          <textarea
            className="qbTextarea"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste notes, slides text, textbook excerpt, etc..."
            rows={10}
          />
          {/* Character counter helps users understand input size */}
          <div className="qbCounter">
            {Math.min(sourceText?.length || 0, 999999).toLocaleString()} chars
          </div>
        </div>

        {/* Surface validation or upload errors from parent */}
        {error && <div className="qbError">{error}</div>}

        <div className="qbActions">
          <button className="qbPrimary" type="button" onClick={onSave}>
            Save Document
          </button>
        </div>
      </div>
    </section>
  );
}
