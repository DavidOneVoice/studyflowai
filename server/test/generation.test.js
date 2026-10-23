import test from "node:test";
import assert from "node:assert/strict";
import {
  createAIService,
  friendlyAIError,
  isAdministrativeQuestion,
  normalizeQuestions,
  splitIntoChunks,
} from "../lib/generation.js";

const material = "Photosynthesis converts light energy into chemical energy stored in sugars. Chlorophyll absorbs light in plant cells.";

function completion(content, finishReason = "stop") {
  return { choices: [{ message: { content }, finish_reason: finishReason }] };
}

function question(prompt = "What absorbs light in plant cells?") {
  return {
    prompt,
    options: ["Chlorophyll", "Starch", "Cellulose", "Water"],
    answerIndex: 0,
    explanation: "Chlorophyll absorbs the light used for photosynthesis.",
  };
}

function quizCompletion(questions) {
  return completion(JSON.stringify({ questions }));
}

function harness(reply) {
  const calls = [];
  const waits = [];
  const client = { chat: { completions: { create: async (body, options) => {
    calls.push({ body, options });
    return reply(body, calls.length, options);
  } } } };
  const service = createAIService({ client, delay: async (milliseconds) => waits.push(milliseconds) });
  return { service, calls, waits };
}

test("a long summary includes source material beyond the previous ten-chunk cutoff", async () => {
  const sourceText = `${"A".repeat(120000)} FINAL_SOURCE_SENTINEL_FACT`;
  const { service, calls } = harness((body, call) => {
    const prompt = body.messages.at(-1).content;
    return completion(prompt.includes("FINAL_SOURCE_SENTINEL_FACT") ? "FINAL_SOURCE_SENTINEL_FACT" : `Section fact ${call}`);
  });
  const result = await service.summarize({ sourceText, title: "Long text" });
  const sourceCalls = calls.filter(({ body }) => body.messages.at(-1).content.startsWith("Summarize this study material."));
  assert.equal(sourceCalls.length, 11);
  assert.equal(result.meta.parts, 11);
  assert.equal(result.meta.processedCharacters, sourceText.length);
  assert.match(sourceCalls.at(-1).body.messages.at(-1).content, /FINAL_SOURCE_SENTINEL_FACT/);
  assert.match(result.summary, /FINAL_SOURCE_SENTINEL_FACT/);
  assert.equal(calls.length, 14, "eleven sources, two groups, and a final merge");
});

test("nonshrinking summaries retain every section instead of looping or truncating", async () => {
  const { service, calls } = harness((body, call) => completion(`${call}: ${"x".repeat(25000)}`));
  const result = await service.summarize({ sourceText: "A".repeat(30000) });
  assert.equal(calls.length, 3);
  assert.match(result.warning, /All sections/);
  assert.match(result.summary, /## Section 3/);
  assert.match(result.summary, /1: /);
  assert.match(result.summary, /2: /);
  assert.match(result.summary, /3: /);
});

test("provider rate limits stop after one technical retry and keep the correct error", async () => {
  const providerError = Object.assign(new Error("Rate limit reached"), { status: 429 });
  const { service, calls, waits } = harness(() => { throw providerError; });
  await assert.rejects(service.generateQuestions({ sourceText: "A".repeat(18000), count: 10 }), (error) => error === providerError);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [500]);
  assert.equal(friendlyAIError(providerError).status, 429);
  assert.equal(friendlyAIError(providerError).code, "provider_rate_limit");
  assert.ok(calls.every(({ options }) => options.maxRetries === 0), "SDK retries must not multiply service retries");
});

test("provider billing and authentication failures do not trigger repeated generation", async (t) => {
  for (const [status, code, expected] of [[429, "insufficient_quota", "provider_quota"], [401, "invalid_api_key", "provider_auth"], [403, "permission_denied", "provider_auth"]]) {
    await t.test(code, async () => {
      const error = Object.assign(new Error("Private credential sk-test-do-not-leak"), { status, code });
      const { service, calls } = harness(() => { throw error; });
      await assert.rejects(service.generateQuestions({ sourceText: material }), (failure) => failure === error);
      assert.equal(calls.length, 1);
      const publicError = friendlyAIError(error);
      assert.equal(publicError.status, 503);
      assert.equal(publicError.code, expected);
      assert.doesNotMatch(publicError.error, /sk-test-do-not-leak/);
    });
  }
});

test("temporary provider failures can recover once", async () => {
  const { service, calls } = harness((body, call) => {
    if (call === 1) throw Object.assign(new Error("Unavailable"), { status: 503 });
    return quizCompletion([question()]);
  });
  const result = await service.generateQuestions({ sourceText: material, count: 1 });
  assert.equal(calls.length, 2);
  assert.equal(result.questions.length, 1);
});

test("questions cover the entire document before recovery passes", async () => {
  let serial = 0;
  const { service, calls } = harness((body) => {
    const count = Number(body.messages.at(-1).content.match(/Generate (\d+) multiple-choice/)[1]);
    return quizCompletion(Array.from({ length: count }, () => {
      serial += 1;
      return question(`Quartz${serial} Amber${serial} Sapphire${serial}?`);
    }));
  });
  const result = await service.generateQuestions({ sourceText: "A".repeat(30000), count: 10 });
  assert.equal(result.questions.length, 10);
  assert.equal(calls.length, 6);
  assert.deepEqual(result.meta.sampledChunks, [1, 2, 3, 4, 5, 6]);
  const sampled = calls.map(({ body }) => Number(body.messages.at(-1).content.match(/Chunk: (\d+) of/)[1]));
  assert.deepEqual(sampled, [1, 2, 3, 4, 5, 6]);
});

test("a small quiz samples early, middle, and final sections", async () => {
  const { service, calls } = harness((body, call) => quizCompletion([question(`Quartz${call} Amber${call} Sapphire${call}?`)]));
  const result = await service.generateQuestions({ sourceText: "A".repeat(30000), count: 3 });
  assert.equal(result.questions.length, 3);
  assert.deepEqual(result.meta.sampledChunks, [1, 4, 6]);
  assert.equal(calls.length, 3);
});

test("null and malformed model entries do not discard valid neighbors", async () => {
  const malformed = [null, false, [], "bad", {}, { ...question(), answerIndex: "0" }, { ...question(), options: [null, "a", "b", "c"] }];
  const { service, calls } = harness(() => quizCompletion([...malformed, question()]));
  const result = await service.generateQuestions({ sourceText: material, count: 1 });
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].answer, "Chlorophyll");
  assert.equal(result.questions[0].answerIndex, 0);
  assert.equal(calls.length, 1);
});

test("questions require distinct answer options while preserving mathematical symbols", () => {
  const repeated = { ...question(), options: ["Light", " light ", "Water", "Air"] };
  const valid = { ...question("Which symbol represents the square root?"), options: ["α", "β", "√", "≤"], answerIndex: 2 };
  assert.deepEqual(normalizeQuestions([repeated]), []);
  const result = normalizeQuestions([valid]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].options, valid.options);
  assert.equal(result[0].answer, "√");
});

test("administrative filtering preserves assignment operators, platforms, and departments", () => {
  const substantive = [
    "What does the assignment operator do in JavaScript?",
    "How does Java achieve platform independence?",
    "What is the role of a marketing department?",
    "Which unit measures electrical resistance?",
    "Which module is imported to handle file paths in Node.js?",
  ];
  for (const prompt of substantive) assert.equal(isAdministrativeQuestion(prompt), false, prompt);
  assert.equal(isAdministrativeQuestion("What is the assignment submission deadline?"), true);
  assert.equal(isAdministrativeQuestion("Which module covers chapter three?"), true);
  assert.equal(isAdministrativeQuestion("What is the course code?"), true);
});

test("80-character quiz inputs work and short final chunks are preserved", async () => {
  const { service, calls } = harness(() => quizCompletion([question()]));
  const result = await service.generateQuestions({ sourceText: "A".repeat(80), count: 1 });
  assert.equal(result.questions.length, 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(splitIntoChunks("A".repeat(6050), 6000).map((chunk) => chunk.length), [6000, 50]);
});

test("input validation rejects missing/malformed material before calling the provider", async () => {
  const { service, calls } = harness(() => quizCompletion([question()]));
  for (const sourceText of [undefined, null, 123, {}, [], "A".repeat(79), " ".repeat(100)]) {
    await assert.rejects(service.generateQuestions({ sourceText }), (error) => friendlyAIError(error).status === 400);
  }
  assert.equal(calls.length, 0);
});

test("summary retains its existing 50-character minimum", async () => {
  const { service } = harness(() => completion("A concise summary."));
  const result = await service.summarize({ sourceText: "A".repeat(50) });
  assert.equal(result.meta.chunked, false);
});

test("previously asked questions are excluded before counting and replaced", async () => {
  const previous = question("Which pigment absorbs light in plant cells?");
  const replacement = question("How are chemical sugars synthesized?");
  const { service, calls } = harness((body, call) => quizCompletion([call === 1 ? previous : replacement]));
  const result = await service.generateQuestions({ sourceText: material, count: 1, avoid: [previous.prompt] });
  assert.equal(result.questions[0].prompt, replacement.prompt);
  assert.equal(calls.length, 2);
  assert.equal(result.meta.partial, false);
});

test("similar questions in the current batch are replaced before the requested total is reached", async () => {
  const a = question("Which pigment absorbs light in plant cells?");
  const duplicate = question("Which pigment absorbs light inside plant cells?");
  const b = question("How are chemical sugars synthesized?");
  const { service, calls } = harness((body, call) => quizCompletion(call === 1 ? [a, duplicate] : [b]));
  const result = await service.generateQuestions({ sourceText: material, count: 2 });
  assert.deepEqual(result.questions.map((item) => item.prompt), [a.prompt, b.prompt]);
  assert.equal(calls.length, 2);
});

test("invalid generations do not invoke a duplicate fallback pass", async () => {
  const { service, calls } = harness(() => completion("null"));
  await assert.rejects(service.generateQuestions({ sourceText: material, count: 1 }), (error) => {
    const result = friendlyAIError(error);
    return result.status === 422 && result.code === "no_valid_questions";
  });
  assert.equal(calls.length, 4);
});

test("partially usable generations explicitly report an incomplete question set", async () => {
  const { service, calls } = harness(() => quizCompletion([question()]));
  const result = await service.generateQuestions({ sourceText: material, count: 3 });
  assert.equal(result.questions.length, 1);
  assert.equal(result.meta.partial, true);
  assert.equal(result.meta.returnedCount, 1);
  assert.match(result.warning, /1 out of 3/);
  assert.equal(calls.length, 4);
});

test("empty or truncated summaries are reported as provider failures", async (t) => {
  for (const [content, reason] of [["", "stop"], ["Partial sentence", "length"]]) {
    await t.test(`${reason}:${content}`, async () => {
      const { service } = harness(() => completion(content, reason));
      await assert.rejects(service.summarize({ sourceText: material }), (error) => friendlyAIError(error).code === "incomplete_summary");
    });
  }
});

test("cancelled work does not start a provider request", async () => {
  const { service, calls } = harness(() => completion("unused"));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(service.generateQuestions({ sourceText: material }, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls.length, 0);
});

test("existing title and difficulty fields reach the question prompt", async () => {
  const { service, calls } = harness(() => quizCompletion([question()]));
  await service.generateQuestions({ sourceText: material, count: 1, title: "Botany", difficulty: "hard" });
  const prompt = calls[0].body.messages.at(-1).content;
  assert.match(prompt, /Title: Botany/);
  assert.match(prompt, /Difficulty: hard/);
});
