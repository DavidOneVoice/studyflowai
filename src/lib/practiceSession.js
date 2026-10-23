function numericScore(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
}

export function getBestAttempt(attempts = []) {
  return (Array.isArray(attempts) ? attempts : []).reduce((best, attempt) => {
    if (!attempt || typeof attempt !== "object") return best;
    const score = numericScore(attempt.score);
    const total = numericScore(attempt.total);
    if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0 || score > total) return best;
    return !best || score / total > Number(best.score) / Number(best.total) ? attempt : best;
  }, null);
}

export function normalizeQuizQuestions(questions, makeId = () => crypto.randomUUID()) {
  if (!Array.isArray(questions) || !questions.length) throw new Error("AI returned no questions. Please try again.");
  const prompts = new Set();
  return questions.map((question) => {
    if (!question || typeof question !== "object") throw new Error("The generated questions were incomplete or invalid. Please try again.");
    const prompt = typeof question.prompt === "string" ? question.prompt.trim() : "";
    const options = Array.isArray(question.options) ? question.options.map((option) => typeof option === "string" ? option.trim() : "") : [];
    const answer = typeof question.answer === "string" ? question.answer.trim() : "";
    const promptKey = prompt.toLowerCase().replace(/\s+/g, " ");
    if (!prompt || options.length !== 4 || options.some((option) => !option) || new Set(options.map((option) => option.toLowerCase())).size !== 4 || !options.includes(answer) || prompts.has(promptKey)) {
      throw new Error("The generated questions were incomplete or invalid. Please try again.");
    }
    prompts.add(promptKey);
    return { id: makeId(), prompt, options, answer, explanation: typeof question.explanation === "string" ? question.explanation.trim() : "" };
  });
}

export async function requestPracticeQuestions({ set, count, apiBase, fetchImpl = fetch, makeId = () => crypto.randomUUID() }) {
  if (!set) throw new Error("This practice set could not be found. Return to your library and choose a set.");
  const response = await fetchImpl(`${apiBase}/api/generate-mcqs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: set.title, sourceText: set.sourceText, count,
      difficulty: "mixed", nonce: makeId(),
      avoid: Array.isArray(set.promptHistory) ? set.promptHistory : [],
    }),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("The server returned an unreadable response. Please try again."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The server returned an unreadable response. Please try again.");
  if (!response.ok) throw new Error(data.error || "Question generation failed. Please try again.");
  const questions = normalizeQuizQuestions(data.questions, makeId);
  if (questions.length > count) throw new Error("The server returned more questions than requested. Please try again.");
  // Preserve usable model output, with a truthful notice when it is incomplete.
  const warning = typeof data.warning === "string" && data.warning.trim()
    ? data.warning.trim()
    : questions.length < count ? `Generated ${questions.length} of ${count} requested questions. This session uses those ${questions.length} questions.` : "";
  return { questions, warning };
}

// Reattaching a React effect must share the original request, including errors.
export function createOnceRequest(request) {
  let promise;
  return () => {
    promise ||= Promise.resolve().then(request);
    return promise;
  };
}

export function saveGeneratedQuestions(state, setId, questions) {
  if (!state.quizSets?.some((set) => set.id === setId)) throw new Error("This practice set was removed. Return to the library to choose another set.");
  return {
    ...state,
    quizSets: state.quizSets.map((set) => set.id === setId ? {
      ...set, questions,
      promptHistory: [...new Set([...questions.map((question) => question.prompt), ...(Array.isArray(set.promptHistory) ? set.promptHistory : [])])].slice(0, 140),
    } : set),
  };
}

export function savePracticeAttempt(state, setId, attempt) {
  if (!state.quizSets?.some((set) => set.id === setId)) throw new Error("This practice set was removed, so its result could not be saved.");
  return {
    ...state,
    quizSets: state.quizSets.map((set) => set.id === setId ? {
      ...set,
      attempts: [attempt, ...(Array.isArray(set.attempts) ? set.attempts : []).filter((previous) => previous?.id !== attempt.id)].slice(0, 4),
    } : set),
  };
}
