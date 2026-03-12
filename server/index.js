/* eslint-env node */
import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import process from "process";
import crypto from "crypto";

const app = express();

/**
 * CORS configuration:
 * - If FRONTEND_ORIGIN is provided (comma-separated), only those origins are allowed.
 * - Otherwise, allow all origins (useful during local/dev; review for production).
 */
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN.split(",").map((s) => s.trim())
      : true,
  }),
);

// Keep this small-ish so uploads don’t crash memory, but enough for typical text
app.use(express.json({ limit: "4mb" }));

/**
 * Lightweight request logging for debugging and monitoring.
 * (Consider using a structured logger in production.)
 */
app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});

/** Simple health check endpoint for uptime monitoring. */
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * OpenAI client setup.
 * Requires OPENAI_API_KEY in environment variables.
 */
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------------------- text safety helpers -------------------- */

/** Normalizes text by collapsing whitespace and trimming edges. */
function normalizeText(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

/**
 * Caps large text but keeps coverage:
 * - head (start)
 * - middle slice
 * - tail (end)
 *
 * Still useful for some tasks, but MCQ generation below now uses true chunking,
 * not this sampling approach.
 */
function capTextEvenly(text, maxChars) {
  const t = normalizeText(text);
  if (t.length <= maxChars) return { text: t, truncated: false };

  // 40% head, 20% middle, 40% tail
  const headLen = Math.floor(maxChars * 0.4);
  const midLen = Math.floor(maxChars * 0.2);
  const tailLen = maxChars - headLen - midLen;

  const head = t.slice(0, headLen);

  const midStart = Math.max(
    0,
    Math.floor(t.length / 2) - Math.floor(midLen / 2),
  );
  const mid = t.slice(midStart, midStart + midLen);

  const tail = t.slice(Math.max(0, t.length - tailLen));

  const joined = [
    head,
    "\n\n[...MIDDLE EXTRACT...]\n\n",
    mid,
    "\n\n[...END EXTRACT...]\n\n",
    tail,
    "\n\n[TRUNCATED FOR SIZE]\n",
  ].join("");

  return { text: joined, truncated: true };
}

/**
 * Splits text into fixed-size chunks for multi-step summarization.
 * Chunking helps avoid context-length errors on large inputs.
 */
function splitIntoChunks(text, chunkChars = 12000) {
  const t = normalizeText(text);
  if (!t) return [];
  const chunks = [];
  for (let i = 0; i < t.length; i += chunkChars) {
    chunks.push(t.slice(i, i + chunkChars));
  }
  return chunks;
}

/**
 * Converts OpenAI/SDK errors into user-friendly API responses:
 * - 413 for payload/context-size issues
 * - 429 for rate limits
 * - falls back to server error status/message
 */
function friendlyOpenAIError(err) {
  const msg = err?.error?.message || err?.message || "OpenAI request failed";

  const lower = String(msg).toLowerCase();

  if (
    lower.includes("context length") ||
    lower.includes("maximum context") ||
    lower.includes("request too large") ||
    (lower.includes("reduce") && lower.includes("tokens")) ||
    lower.includes("too many tokens")
  ) {
    return {
      status: 413,
      error:
        "Your material is too large for the AI request. Please upload a smaller file, or paste a shorter excerpt (or split the material into parts).",
      detail: msg,
    };
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm") ||
    lower.includes("rpm") ||
    lower.includes("too many requests")
  ) {
    return {
      status: 429,
      error:
        "The AI server is temporarily rate-limited. Please wait a bit and try again, or reduce the material size.",
      detail: msg,
    };
  }

  return { status: err?.status || 500, error: msg, detail: msg };
}

/* -------------------- diversity helpers -------------------- */

/**
 * Tokenizes text for similarity checks:
 * - lowercase
 * - remove punctuation
 * - keep words of length >= 3
 */
function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/**
 * Jaccard similarity over token sets.
 * Used to reduce repeated or near-duplicate question prompts.
 */
function jaccard(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;

  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;

  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

/**
 * Returns true if `prompt` is too similar to any item in `list`
 * using the provided similarity threshold.
 */
function isTooSimilar(prompt, list, threshold) {
  return list.some((old) => jaccard(prompt, old) >= threshold);
}

/**
 * Selects a diverse subset of questions:
 * - avoids prompts similar to previously asked prompts (avoidList)
 * - avoids duplicates within the new selection (chosenPrompts)
 */
function selectDiverseQuestions(pool, avoidList, finalCount) {
  const selected = [];
  const chosenPrompts = [];

  for (const q of pool) {
    if (selected.length >= finalCount) break;

    if (avoidList.length && isTooSimilar(q.prompt, avoidList, 0.45)) continue;
    if (chosenPrompts.length && isTooSimilar(q.prompt, chosenPrompts, 0.55))
      continue;

    selected.push(q);
    chosenPrompts.push(q.prompt);
  }

  return selected;
}

/* -------------------- MCQ-specific chunking helpers -------------------- */

app.post("/api/generate-mcqs", async (req, res) => {
  try {
    const {
      title,
      sourceText,
      count = 10,
      difficulty = "mixed",
      avoid = [],
      nonce,
    } = req.body;

    const normalizedSource = normalizeText(sourceText);
    if (!normalizedSource || normalizedSource.length < 80) {
      return res
        .status(400)
        .json({ error: "Please provide more study material text." });
    }

    const normalizedSource = normalizeText(sourceText);
    const MAX_MCQ_SLICE_CHARS = 12000;
    const MAX_MCQ_SLICES = 12;

    const allSlices = splitIntoChunks(normalizedSource, MAX_MCQ_SLICE_CHARS);
    const materialSlices = allSlices.slice(0, MAX_MCQ_SLICES);

    const { text: fallbackMaterial, truncated: fallbackTruncated } = capTextEvenly(
      normalizedSource,
      35000,
    );

    const usableSlices = materialSlices.length ? materialSlices : [fallbackMaterial];
    const truncated = fallbackTruncated || allSlices.length > MAX_MCQ_SLICES;

    const requestedCount = Number(count) || 10;
    const safeCount = Math.max(5, Math.min(requestedCount, 100));

    const maxAttempts = 8;

    const safeAvoid = Array.isArray(avoid)
      ? avoid
          .filter((x) => typeof x === "string" && x.trim().length > 0)
          .slice(0, 120)
      : [];

    const baseNonce =
      typeof nonce === "string" && nonce.trim().length > 0
        ? nonce.trim()
        : crypto.randomUUID();

    const perAttemptTarget = Math.min(15, Math.max(8, Math.ceil(safeCount / 8)));
    const maxAttempts = Math.min(36, Math.max(10, safeCount * 2));

    console.log("MCQ request:", {
      title,
      requestedCount,
      safeCount,
      maxAttempts,
      avoidCount: safeAvoid.length,
      materialChars: normalizedSource.length,
      usedSlices: usableSlices.length,
      truncatedMaterial: truncated,
      materialChars: normalizedSource.length,
      usedSlices: usableSlices.length,
      sliceChars: MAX_MCQ_SLICE_CHARS,
    });

    let finalQuestions = [];
    const generatedPrompts = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attemptNonce = attempt === 0 ? baseNonce : crypto.randomUUID();
      const remaining = Math.max(safeCount - finalQuestions.length, 0);
      const attemptPoolCount = Math.min(Math.max(remaining * 2, 16), 40);
      const avoidForAttempt = [...safeAvoid, ...generatedPrompts.slice(-200)];

  const prompt = `
You are an expert exam setter and tutor.

Generate EXACTLY ${count} high-quality multiple-choice questions from the study material below.

IMPORTANT:
- Return EXACTLY ${count} questions.
- Use ONLY the study material provided below.
- Focus on THIS CHUNK only, but spread coverage across the chunk as much as possible.
- Questions must be varied and not repetitive.
- Avoid reusing or paraphrasing these previous question prompts:
${avoid.length ? `- ${avoid.join("\n- ")}` : "- (none)"}

Requirements:
- Difficulty: ${difficulty} (easy/medium/hard/mixed)
- Each question must be clear, complete, and based strictly on the material.
- 4 options only.
- Exactly 1 correct answer.
- Provide a short explanation for why it is correct.
- Use natural language.
- Avoid duplicates and near-duplicates.
- Mix question styles where relevant:
  - definitions
  - conceptual understanding
  - application/scenario
  - misconception checks
  - calculations

Variation nonce: ${attemptNonce}

Output MUST be valid JSON ONLY in this exact structure:
{
  "questions": [
    {
      "prompt": "string",
      "options": ["A text", "B text", "C text", "D text"],
      "answerIndex": 0,
      "explanation": "string"
    }
  ]
}

Title: ${title || "Untitled"}
Chunk: ${chunkIndex + 1} of ${totalChunks}

Study Material:
${chunkText}
`.trim();
Study Material (slice ${attemptSliceIndex + 1} of ${usableSlices.length}):
${attemptMaterial}
`;

      const resp = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 1.0,
        presence_penalty: 0.9,
        frequency_penalty: 0.5,
        response_format: { type: "json_object" },
        max_tokens: Math.min(12000, Math.max(2500, attemptPoolCount * 220)),
        messages: [{ role: "user", content: prompt }],
      });

  const rawText = resp.choices?.[0]?.message?.content || "{}";

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return [];
  }

  const rawQs = Array.isArray(data.questions) ? data.questions : [];

  return rawQs
    .map((q) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      const idx = Number.isInteger(q.answerIndex) ? q.answerIndex : -1;

      if (!q?.prompt || typeof q.prompt !== "string") return null;
      if (opts.length !== 4) return null;
      if (idx < 0 || idx > 3) return null;

      const cleanPrompt = q.prompt.trim();
      const cleanOptions = opts.map((x) => String(x || "").trim());

      if (!cleanPrompt) return null;
      if (cleanOptions.some((opt) => !opt)) return null;

      return {
        id: crypto.randomUUID(),
        prompt: cleanPrompt,
        options: cleanOptions,
        answer: cleanOptions[idx],
        explanation:
          typeof q.explanation === "string" ? q.explanation.trim() : "",
      };
    })
    .filter(Boolean);
}

/* -------------------- API: generate MCQs -------------------- */

app.post("/api/generate-mcqs", async (req, res) => {
  try {
    const {
      title,
      sourceText,
      count = 10,
      difficulty = "mixed",
      avoid = [],
    } = req.body;

    if (!sourceText || normalizeText(sourceText).length < 80) {
      return res
        .status(400)
        .json({ error: "Please provide more study material text." });
    }

    const requestedCount = Number(count) || 10;
    const safeCount = Math.max(1, Math.min(requestedCount, 100));

    const safeAvoid = Array.isArray(avoid)
      ? avoid
          .filter((x) => typeof x === "string" && x.trim().length > 0)
          .slice(0, 120)
      : [];

    const material = normalizeText(sourceText);

    const QUESTION_CHUNK_CHARS = 9000;
    const QUESTION_CHUNK_OVERLAP = 800;

    const chunks = splitIntoQuestionChunks(
      material,
      QUESTION_CHUNK_CHARS,
      QUESTION_CHUNK_OVERLAP,
    );

    if (!chunks.length) {
      return res.status(400).json({
        error: "Unable to process this material for quiz generation.",
      });
    }

    const allocations = allocateQuestionsAcrossChunks(chunks, safeCount);

    console.log("MCQ request:", {
      title,
      requestedCount,
      safeCount,
      materialChars: material.length,
      chunkCount: chunks.length,
      allocations,
      avoidCount: safeAvoid.length,
    });

    let finalQuestions = [];
    let generatedPrompts = [];

    // First pass: generate across all chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const chunkTarget = allocations[i];

      if (chunkTarget <= 0) continue;

      const attemptCount = Math.min(Math.max(chunkTarget + 2, 8), 24);

      try {
        const chunkQuestions = await generateQuestionsForChunk({
          title,
          chunkText,
          count: attemptCount,
          difficulty,
          avoid: [...safeAvoid, ...generatedPrompts.slice(-200)],
          chunkIndex: i,
          totalChunks: chunks.length,
        });

        generatedPrompts.push(...chunkQuestions.map((q) => q.prompt));
        if (generatedPrompts.length > 500) {
          generatedPrompts.splice(0, generatedPrompts.length - 500);
        }

        finalQuestions = dedupeQuestionPool([
          ...finalQuestions,
          ...chunkQuestions,
        ]);
      } catch (err) {
        console.error(`MCQ chunk ${i + 1}/${chunks.length} failed`, err);
      }
    }

    // Second pass: refill if still short
    let remaining = safeCount - finalQuestions.length;

    if (remaining > 0) {
      const retryOrder = chunks
        .map((chunk, index) => ({ chunk, index, len: chunk.length }))
        .sort((a, b) => b.len - a.len);

      for (const item of retryOrder) {
        if (finalQuestions.length >= safeCount) break;

        remaining = safeCount - finalQuestions.length;
        const refillCount = Math.min(Math.max(remaining * 2, 6), 20);

        try {
          const extraQuestions = await generateQuestionsForChunk({
            title,
            chunkText: item.chunk,
            count: refillCount,
            difficulty,
            avoid: [
              ...safeAvoid,
              ...finalQuestions.map((q) => q.prompt),
              ...generatedPrompts.slice(-200),
            ],
            chunkIndex: item.index,
            totalChunks: chunks.length,
          });

          generatedPrompts.push(...extraQuestions.map((q) => q.prompt));
          if (generatedPrompts.length > 500) {
            generatedPrompts.splice(0, generatedPrompts.length - 500);
          }

          finalQuestions = dedupeQuestionPool([
            ...finalQuestions,
            ...extraQuestions,
          ]);
        } catch (err) {
          console.error(
            `MCQ refill chunk ${item.index + 1}/${chunks.length} failed`,
            err,
          );
        }
      }
    }

    // Final cleanup + trim
    finalQuestions = dedupeQuestionPool(finalQuestions);
    finalQuestions = selectDiverseQuestions(
      finalQuestions,
      safeAvoid,
      safeCount,
    );
    finalQuestions = finalQuestions.slice(0, safeCount);

    if (!finalQuestions.length) {
      return res.status(422).json({
        error:
          "No valid questions could be generated from this material. Try re-uploading the file or using a clearer text extract.",
      });
    }

    return res.json({
      questions: finalQuestions.slice(0, safeCount),
      meta: {
        requestedCount: safeCount,
        returnedCount: finalQuestions.length,
        partial: finalQuestions.length < safeCount,
        chunked: true,
        chunksUsed: chunks.length,
      },
      warning:
        finalQuestions.length < safeCount
          ? `Generated ${finalQuestions.length} out of ${safeCount} requested questions.`
          : null,
    });
  } catch (err) {
    console.error(err);
    const f = friendlyOpenAIError(err);
    return res.status(f.status).json({ error: f.error, detail: f.detail });
  }
});

/* -------------------- API: summarize (with chunking) -------------------- */

/**
 * Summarization prompt notes:
 * Goal = "content compression", not "document description".
 * We explicitly forbid meta narration (e.g., "This document discusses...").
 * Output is general-purpose: works for academic, religious, health, policy, etc.
 */
function buildSummaryPrompt({ title, material, partLabel }) {
  const safeTitle = title || "Untitled";

  return `
You are a skilled summarizer and note-taker.

Your job is to summarize the INFORMATION inside the material so a reader can understand it quickly without reading the original.

IMPORTANT:
- Do NOT describe the document (avoid phrases like: "this handout explains", "this document covers", "this course introduces").
- Do NOT add outside knowledge.
- Keep the meaning accurate, but remove repetition and extra words.

Write the summary as clear notes with these sections:

1) Main Ideas (bullets; capture the core themes, arguments, or concepts)
2) Key Points (bullets; include important details, steps, rules, or arguments)
3) Important Terms / Definitions (only if they appear in the material)
4) Requirements / Rules / Logistics (only if present: grading, deadlines, policies, instructions, etc.)
5) Practical Takeaways (2–8 bullets: what the reader should do/remember)
Optional:
- If the material clearly looks like a course handout (mentions exam, quiz, grading, assignments), add:
  "Likely Exam Focus"
Otherwise, do NOT include any exam section.

Style:
- Use simple, clear language.
- Prefer bullets and short paragraphs.
- Keep it significantly shorter than the original.
- If the material contains lists/tables/weekly outlines, compress them into a concise list.

Material Title: ${safeTitle}
${partLabel ? `\n${partLabel}\n` : ""}Material:
${material}
`.trim();
}

/**
 * Summarizes a single chunk of the study material.
 * Used when the input is too large for a single request.
 */
async function summarizeChunk({ title, chunkText, index, total }) {
  const prompt = buildSummaryPrompt({
    title,
    material: chunkText,
    partLabel: `PART ${index + 1} of ${total}`,
  });

  const r = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  return r.choices?.[0]?.message?.content || "";
}

/**
 * Combines multiple partial summaries into one consolidated summary.
 * This step reduces duplication and improves readability.
 */
async function combineSummaries({ title, partials }) {
  const safeTitle = title || "Untitled";

  const prompt = `
You are a skilled summarizer and editor.

Combine the partial summaries into ONE final summary for: "${safeTitle}".

IMPORTANT:
- Do NOT describe the document (avoid: "this material covers...", "this handout discusses...").
- Merge duplicates and remove repeated bullets.
- Keep only information that appears in the partials.
- Make the final result clean, structured, and easy to read.

Return the final output in this exact structure:

1) Main Ideas
2) Key Points
3) Important Terms / Definitions (only if present)
4) Requirements / Rules / Logistics (only if present)
5) Practical Takeaways

Partial summaries:
${partials.map((p, i) => `\n--- PART ${i + 1} ---\n${p}\n`).join("")}
`.trim();

  const r = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  return r.choices?.[0]?.message?.content || "";
}

app.post("/api/summarize", async (req, res) => {
  try {
    const { title, sourceText } = req.body;

    if (!sourceText || normalizeText(sourceText).length < 50) {
      return res
        .status(400)
        .json({ error: "Not enough material to summarize." });
    }

    const material = normalizeText(sourceText);

    const MAX_SINGLEPASS_CHARS = 28000;
    const CHUNK_CHARS = 12000;

    console.log("SUMMARY request:", {
      title,
      materialChars: material.length,
    });

    if (material.length <= MAX_SINGLEPASS_CHARS) {
      const prompt = buildSummaryPrompt({
        title,
        material,
        partLabel: "",
      });

      const response = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      });

      const summary = response.choices?.[0]?.message?.content || "";
      return res.json({ summary, meta: { chunked: false } });
    }

    const chunks = splitIntoChunks(material, CHUNK_CHARS).slice(0, 10);
    const partials = [];

    for (let i = 0; i < chunks.length; i++) {
      const part = await summarizeChunk({
        title,
        chunkText: chunks[i],
        index: i,
        total: chunks.length,
      });
      partials.push(part);
    }

    const final = await combineSummaries({ title, partials });

    return res.json({
      summary: final,
      meta: { chunked: true, parts: chunks.length },
    });
  } catch (err) {
    console.error(err);
    const f = friendlyOpenAIError(err);
    return res.status(f.status).json({ error: f.error, detail: f.detail });
  }
});

// Port can be configured via environment variables for deployment platforms.
const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`AI server running on port ${PORT}`);
});
