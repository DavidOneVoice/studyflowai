/* eslint-env node */
import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import process from "process";
import crypto from "crypto";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN.split(",").map((s) => s.trim())
      : true,
  }),
);

app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------------------- shared helpers -------------------- */

function normalizeText(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

function capTextEvenly(text, maxChars) {
  const t = normalizeText(text);
  if (t.length <= maxChars) return { text: t, truncated: false };

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

function splitIntoChunks(text, chunkChars = 12000) {
  const t = normalizeText(text);
  if (!t) return [];
  const chunks = [];
  for (let i = 0; i < t.length; i += chunkChars) {
    chunks.push(t.slice(i, i + chunkChars));
  }
  return chunks;
}

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

  return {
    status: err?.status || 500,
    error: msg,
    detail: msg,
  };
}

/* -------------------- diversity helpers -------------------- */

function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

function jaccard(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;

  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter++;
  }

  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function isTooSimilar(prompt, list, threshold) {
  return list.some((old) => jaccard(prompt, old) >= threshold);
}

function selectDiverseQuestions(pool, avoidList, finalCount) {
  const selected = [];
  const chosenPrompts = [];

  for (const q of pool) {
    if (selected.length >= finalCount) break;

    if (avoidList.length && isTooSimilar(q.prompt, avoidList, 0.45)) continue;
    if (chosenPrompts.length && isTooSimilar(q.prompt, chosenPrompts, 0.55)) {
      continue;
    }

    selected.push(q);
    chosenPrompts.push(q.prompt);
  }

  return selected;
}

function normalizePromptKey(prompt = "") {
  return String(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeQuestionPool(questions) {
  const seen = new Set();
  const out = [];

  for (const q of questions) {
    const key = normalizePromptKey(q.prompt);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }

  return out;
}

/* -------------------- MCQ helpers -------------------- */

function splitIntoQuestionChunks(text, chunkChars = 9000, overlapChars = 800) {
  const t = normalizeText(text);
  if (!t) return [];

  const chunks = [];
  let start = 0;

  while (start < t.length) {
    const end = Math.min(start + chunkChars, t.length);
    const chunk = t.slice(start, end).trim();

    if (chunk.length >= 300) {
      chunks.push(chunk);
    }

    if (end >= t.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

function allocateQuestionsAcrossChunks(chunks, requestedCount) {
  if (!chunks.length || requestedCount <= 0) return [];

  const lengths = chunks.map((c) => c.length);
  const totalLength = lengths.reduce((sum, n) => sum + n, 0);

  const allocations = lengths.map((len) =>
    Math.max(1, Math.floor((len / totalLength) * requestedCount)),
  );

  let assigned = allocations.reduce((sum, n) => sum + n, 0);

  while (assigned < requestedCount) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < chunks.length; i++) {
      const score = lengths[i] / (allocations[i] + 1);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    allocations[bestIndex] += 1;
    assigned += 1;
  }

  while (assigned > requestedCount) {
    let bestIndex = -1;
    let smallestAllocation = Infinity;

    for (let i = 0; i < allocations.length; i++) {
      if (allocations[i] > 1 && allocations[i] < smallestAllocation) {
        smallestAllocation = allocations[i];
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;

    allocations[bestIndex] -= 1;
    assigned -= 1;
  }

  return allocations;
}

async function generateQuestionsForChunk({
  title,
  chunkText,
  count,
  difficulty,
  avoid = [],
  chunkIndex = 0,
  totalChunks = 1,
}) {
  const attemptNonce = crypto.randomUUID();

  const prompt = `
You are an expert exam setter and tutor.

Generate ${count} high-quality multiple-choice questions from the study material below.

IMPORTANT:
- Use ONLY the study material provided below.
- Focus on THIS CHUNK only.
- Questions must be varied and not repetitive.
- Avoid reusing or paraphrasing these previous question prompts:
${avoid.length ? `- ${avoid.join("\n- ")}` : "- (none)"}

Requirements:
- Difficulty: ${difficulty}
- Each question must be clear, complete, and based strictly on the material.
- 4 options only.
- Exactly 1 correct answer.
- Provide a short explanation.
- Return as many valid questions as you can up to ${count}.
- JSON only.

Output format:
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

Variation nonce: ${attemptNonce}
`.trim();

  const resp = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    max_tokens: 3500,
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
  console.log("=== HIT /api/generate-mcqs ON CURRENT SERVER ===");
  try {
    const {
      title,
      sourceText,
      count = 10,
      difficulty = "mixed",
      avoid = [],
    } = req.body;

    const material = normalizeText(sourceText);

    if (!material || material.length < 80) {
      return res
        .status(400)
        .json({ error: "Please provide more study material text." });
    }

    const requestedCount = Number(count) || 10;
    const safeCount = Math.max(1, Math.min(requestedCount, 100));

    const safeAvoid = Array.isArray(avoid)
      ? avoid
          .filter((x) => typeof x === "string" && x.trim().length > 0)
          .slice(0, 20)
      : [];

    const QUESTION_CHUNK_CHARS = 6000;
    const QUESTION_CHUNK_OVERLAP = 500;

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

    console.log("MCQ request:", {
      title,
      requestedCount,
      safeCount,
      materialChars: material.length,
      chunkCount: chunks.length,
      avoidCount: safeAvoid.length,
    });

    let finalQuestions = [];
    let generatedPrompts = [];

    // Do several rounds across chunks, small batches each time
    for (let round = 0; round < 4; round++) {
      if (finalQuestions.length >= safeCount) break;

      for (let i = 0; i < chunks.length; i++) {
        if (finalQuestions.length >= safeCount) break;

        const remaining = safeCount - finalQuestions.length;
        const batchSize = Math.min(5, Math.max(3, remaining));

        try {
          const chunkQuestions = await generateQuestionsForChunk({
            title,
            chunkText: chunks[i],
            count: batchSize,
            difficulty,
            avoid: [
              ...safeAvoid,
              ...generatedPrompts.slice(-60),
              ...finalQuestions.map((q) => q.prompt).slice(-60),
            ],
            chunkIndex: i,
            totalChunks: chunks.length,
          });

          console.log(
            `Round ${round + 1}, chunk ${i + 1}/${chunks.length}, got ${chunkQuestions.length} questions`,
          );

          generatedPrompts.push(...chunkQuestions.map((q) => q.prompt));
          if (generatedPrompts.length > 200) {
            generatedPrompts.splice(0, generatedPrompts.length - 200);
          }

          finalQuestions = dedupeQuestionPool([
            ...finalQuestions,
            ...chunkQuestions,
          ]);
        } catch (err) {
          console.error(
            `MCQ round ${round + 1} chunk ${i + 1}/${chunks.length} failed`,
            err,
          );
        }
      }
    }

    finalQuestions = dedupeQuestionPool(finalQuestions);
    finalQuestions = selectDiverseQuestions(
      finalQuestions,
      safeAvoid,
      safeCount,
    ).slice(0, safeCount);

    if (!finalQuestions.length) {
      return res.status(422).json({
        error:
          "No valid questions could be generated from this material. Try re-uploading the file or using a clearer text extract.",
      });
    }

    return res.json({
      questions: finalQuestions,
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

/* -------------------- API: summarize -------------------- */

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

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`AI server running on port ${PORT}`);
});
