/**
 * Returns a shuffled copy of an array using the Fisher–Yates algorithm.
 * The original array is not mutated.
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Escapes special RegExp characters in a string
 * so it can be safely used inside a dynamic regular expression.
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits text into sentences using punctuation boundaries.
 * Filters out very short fragments (less than 40 characters)
 * to avoid weak or incomplete question prompts.
 */
function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);
}

/**
 * Finds the first sentence containing the given keyword
 * (matched as a whole word, case-insensitive).
 */
function pickSentenceContaining(sentences, keyword) {
  const re = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i");
  return sentences.find((s) => re.test(s)) || null;
}

/**
 * Generates fill-in-the-blank MCQs from source text and extracted keywords.
 *
 * Logic:
 * - For each keyword, find a sentence containing it.
 * - Replace the keyword with a blank.
 * - Create 3 distractors from other keywords.
 * - Shuffle answer + distractors to form options.
 *
 * Returns an array of question objects.
 */
export function generateMCQs({ sourceText, keywords, count = 10 }) {
  // Ensure valid keyword candidates (strings, min length 4).
  const keys = (keywords || []).filter(
    (k) => typeof k === "string" && k.length >= 4,
  );

  const text = (sourceText || "").trim();

  // Basic guards to avoid generating poor-quality questions.
  if (keys.length < 4) return [];
  if (text.length < 60) return [];

  const sentences = splitSentences(text);
  if (!sentences.length) return [];

  const shuffledKeywords = shuffle(keys);
  const questions = [];

  for (const answer of shuffledKeywords) {
    if (questions.length >= count) break;

    const sentence = pickSentenceContaining(sentences, answer);
    if (!sentence) continue;

    // Limit overly long sentences for readability.
    const trimmedSentence =
      sentence.length > 180 ? sentence.slice(0, 177) + "..." : sentence;

    // Replace all occurrences of the keyword with blanks.
    const blanked = trimmedSentence.replace(
      new RegExp(`\\b${escapeRegExp(answer)}\\b`, "ig"),
      "_____",
    );

    // Select 3 distractors different from the correct answer.
    const distractors = shuffle(
      keys.filter((k) => k.toLowerCase() !== answer.toLowerCase()),
    ).slice(0, 3);

    if (distractors.length < 3) continue;

    // Shuffle answer and distractors to randomize position.
    const options = shuffle([answer, ...distractors]);

    questions.push({
      id: crypto.randomUUID(),
      prompt: `Fill in the blank:\n${blanked}`,
      options,
      answer,
      explanation: `Correct answer: "${answer}".`,
    });
  }

  return questions;
}
