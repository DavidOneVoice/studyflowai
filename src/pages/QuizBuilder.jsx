import { useEffect, useRef, useState } from "react";
import { useAppState } from "../hooks/useAppState";
import { createLatestTask, MIN_SOURCE_CHARACTERS, readDocumentText, sourceCharacterCount } from "../lib/documentText";
import QuizBuilderForm from "../components/quiz/QuizBuilderForm";
import "./QuizBuilder.css";

export default function QuizBuilder() {
  const [state, setState] = useAppState();
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [fileInfo, setFileInfo] = useState("");
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [fileTask] = useState(() => createLatestTask());
  const readingRef = useRef(false);
  const savedRef = useRef(false);
  const intent = new URLSearchParams(window.location.hash.split("?")[1] || "").get("intent") === "summary" ? "summary" : "practice";

  useEffect(() => () => fileTask.cancel(), [fileTask]);

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    // Never leave material from the previous file attached to a new filename.
    fileTask.cancel();
    setSourceText("");
    setError("");
    setFileInfo(file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "");
    readingRef.current = Boolean(file);
    setIsReading(Boolean(file));
    if (!file) return;

    const result = await fileTask.run(() => readDocumentText(file));
    if (result.status === "stale") return;
    readingRef.current = false;
    setIsReading(false);
    if (result.status === "error") setError(result.error?.message || "Could not read this file. Try another file or paste the material.");
    else setSourceText(result.value);
  }

  function handleTextChange(value) {
    fileTask.cancel();
    readingRef.current = false;
    setIsReading(false);
    setFileInfo("");
    setError("");
    setSourceText(value);
  }

  function saveQuizSet() {
    if (readingRef.current || savedRef.current) return;
    if (title.trim().length < 3) {
      setError("Please enter a title with at least 3 characters.");
      return;
    }
    if (sourceCharacterCount(sourceText) < MIN_SOURCE_CHARACTERS) {
      setError("Please provide at least 80 characters of material by uploading or pasting text.");
      return;
    }
    const newSet = {
      id: crypto.randomUUID(), title: title.trim(), sourceText: sourceText.trim(),
      questions: [], summary: "", promptHistory: [], attempts: [],
      courseId: selectedCourseId || "", createdAt: new Date().toISOString(),
    };
    const saved = setState((previous) => ({ ...previous, quizSets: [newSet, ...(previous.quizSets || [])] }));
    if (!saved) return;
    savedRef.current = true;
    window.location.hash = intent === "summary"
      ? `#/quizSet?setId=${encodeURIComponent(newSet.id)}&intent=summary`
      : "#/library";
  }

  return (
    <div className="quizBuilderPage">
      <QuizBuilderForm
        title={title} setTitle={setTitle}
        sourceText={sourceText} setSourceText={handleTextChange}
        fileInfo={fileInfo} error={error} isReading={isReading} intent={intent}
        onFileUpload={handleFileUpload} onSave={saveQuizSet}
        courses={state.courses || []} selectedCourseId={selectedCourseId}
        setSelectedCourseId={setSelectedCourseId}
      />
    </div>
  );
}
