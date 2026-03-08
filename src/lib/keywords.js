/**
 * Common stop words removed during keyword extraction.
 * These are high-frequency, low-information words.
 */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "while",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "with",
  "without",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "this",
  "that",
  "these",
  "those",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "he",
  "she",
  "his",
  "her",
  "them",
  "do",
  "does",
  "did",
  "not",
  "no",
  "yes",
  "can",
  "could",
  "will",
  "would",
  "shall",
  "should",
  "may",
  "might",
  "must",
  "about",
  "into",
  "over",
  "under",
  "more",
  "most",
  "some",
  "such",
  "than",
  "too",
  "very",
  "also",
]);

/**
 * Extracts the most frequent keywords from a given text.
 *
 * Steps:
 * - Normalize text (lowercase, remove punctuation).
 * - Split into words.
 * - Remove stop words, short words (< 4 chars), and pure numbers.
 * - Count word frequencies.
 * - Return top `max` keywords by frequency.
 */
export function extractKeywords(text, { max = 12 } = {}) {
  if (!text || text.trim().length < 10) return [];

  const cleaned = text
    .toLowerCase()
    // Keep letters, numbers, spaces, and hyphens.
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);

  const freq = new Map();

  for (const w of words) {
    // Ignore very short words.
    if (w.length < 4) continue;

    // Ignore common stop words.
    if (STOP_WORDS.has(w)) continue;

    // Ignore tokens that are purely numeric.
    if (/^\d+$/.test(w)) continue;

    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Sort words by descending frequency and extract just the word.
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  return sorted.slice(0, max);
}
