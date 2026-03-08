import { useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "../lib/storage";
import { extractTextFromPdf } from "../lib/pdfText";
import mammoth from "mammoth";
import QuizBuilderForm from "../components/quiz/QuizBuilderForm";
import "./QuizBuilder.css";

/**
 * QuizBuilder page:
 * - Lets users create and save a "quiz set" from uploaded or pasted study material
 * - Supports TXT, DOCX (via mammoth), and PDF (via pdf.js text extraction)
 * - Persists saved sets into localStorage state (quizSets array)
 */
export default function QuizBuilder() {
  const [state, setState] = useState(() => loadState());

  // Used to optionally link a quiz set to a course.
  const courses = useMemo(() => state.courses || [], [state.courses]);

  // Builder form state (controlled locally; saved into state.quizSets on submit)
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [error, setError] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  /**
   * Persist app state whenever it changes.
   */
  useEffect(() => {
    saveState(state);
  }, [state]);

  /**
   * Handles file upload from the form.
   * Extracts text depending on extension:
   * - .txt: read directly
   * - .docx: extract raw text with mammoth
   * - .pdf: extract selectable text with pdf.js
   */
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic UI feedback about the selected file.
    setFileInfo(`${file.name} (${Math.round(file.size / 1024)} KB)`);
    setError("");

    const lower = file.name.toLowerCase();

    if (lower.endsWith(".txt")) {
      const text = await file.text();
      setSourceText(text);
      return;
    }

    if (lower.endsWith(".docx")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = (result.value || "").trim();

        // Guard: some DOCX files contain mostly images/tables and little text.
        if (!text || text.length < 30) {
          setError(
            "DOCX loaded, but little/no text was found. Try another file or paste text.",
          );
          return;
        }

        setSourceText(text);
        return;
      } catch (err) {
        console.error(err);
        setError("Failed to read DOCX. Please try another file or paste text.");
        return;
      }
    }

    if (lower.endsWith(".pdf")) {
      try {
        setError("Reading PDF…");
        const text = await extractTextFromPdf(file);

        // Guard: scanned PDFs may have no selectable text without OCR.
        if (!text || text.length < 30) {
          setError(
            "PDF loaded, but little/no selectable text was found. If this PDF is scanned (image-based), we’ll need OCR.",
          );
          return;
        }

        setSourceText(text);
        setError("");
        return;
      } catch (err) {
        console.error("PDF read error:", err);
        setError(`Failed to read PDF: ${err?.message || "Unknown error"}`);
        return;
      }
    }

    // Unsupported extensions fall through to here.
    setError(
      "Unsupported file type. Please upload a .txt, .docx, or .pdf file.",
    );
  }

  /**
   * Validates the form and saves a new quiz set into state.quizSets.
   * After saving, it resets the form and navigates to the saved sets page.
   */
  function saveQuizSet() {
    if (!title.trim() || title.trim().length < 3) {
      setError("Please enter a title (min 3 characters).");
      return;
    }

    if (!sourceText.trim() || sourceText.trim().length < 30) {
      setError(
        "Please provide at least 30 characters of course material (upload or paste).",
      );
      return;
    }

    const newSet = {
      id: crypto.randomUUID(),
      title: title.trim(),
      sourceText,
      questions: [],
      summary: "",
      promptHistory: [],
      attempts: [],
      // Optional link to a planner course.
      courseId: selectedCourseId || "",
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      quizSets: [newSet, ...(prev.quizSets || [])],
    }));

    // Reset form state after save.
    setTitle("");
    setSourceText("");
    setFileInfo("");
    setSelectedCourseId("");
    setError("");

    // Navigate to saved quiz sets list.
    window.location.hash = "#/quizSets";
  }

  return (
    <div className="quizBuilderPage">
      <QuizBuilderForm
        title={title}
        setTitle={setTitle}
        sourceText={sourceText}
        setSourceText={setSourceText}
        fileInfo={fileInfo}
        error={error}
        onFileUpload={handleFileUpload}
        onSave={saveQuizSet}
        courses={courses}
        selectedCourseId={selectedCourseId}
        setSelectedCourseId={setSelectedCourseId}
      />
    </div>
  );
}
