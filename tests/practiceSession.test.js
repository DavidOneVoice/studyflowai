import test from "node:test";
import assert from "node:assert/strict";
import { createOnceRequest, getBestAttempt, normalizeQuizQuestions, requestPracticeQuestions, saveGeneratedQuestions, savePracticeAttempt } from "../src/lib/practiceSession.js";

const question = { prompt: "What is 2 + 2?", options: ["1", "2", "3", "4"], answer: "4", explanation: "Two pairs make four." };

test("effect replay shares one request and real question history reaches the API", async () => {
  let calls = 0;
  let body;
  const request = createOnceRequest(() => requestPracticeQuestions({
    set: { title: "Math", sourceText: "Source material", promptHistory: ["Previous question"] },
    count: 1, apiBase: "https://example.invalid", makeId: () => "id",
    fetchImpl: async (_url, options) => {
      calls++;
      body = JSON.parse(options.body);
      return { ok: true, text: async () => JSON.stringify({ questions: [question] }) };
    },
  }));
  const first = request();
  const replay = request();
  assert.equal(first, replay);
  await Promise.all([first, replay]);
  await request();
  assert.equal(calls, 1);
  assert.deepEqual(body.avoid, ["Previous question"]);
});

test("failed initial requests are not silently retried on effect replay", async () => {
  let calls = 0;
  const request = createOnceRequest(async () => { calls++; throw new Error("Unavailable"); });
  await assert.rejects(request(), /Unavailable/);
  await assert.rejects(request(), /Unavailable/);
  assert.equal(calls, 1);
});

test("invalid questions cannot enter a scored session", () => {
  assert.throws(() => normalizeQuizQuestions([{ ...question, answer: "5" }]), /invalid/);
  assert.throws(() => normalizeQuizQuestions([{ ...question, options: ["1", "1", "3", "4"] }]), /invalid/);
  assert.throws(() => normalizeQuizQuestions([question, question]), /invalid/);
  assert.throws(() => normalizeQuizQuestions([]), /no questions/);
  assert.throws(() => normalizeQuizQuestions([null]), /invalid/);
});

test("partial sets remain usable with a truthful warning; malformed responses fail", async () => {
  const common = { set: { title: "Test" }, count: 2, apiBase: "", makeId: () => "id" };
  const partial = await requestPracticeQuestions({ ...common, fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ questions: [question], meta: { partial: true } }) }) });
  assert.equal(partial.questions.length, 1);
  assert.match(partial.warning, /1 of 2/);
  await assert.rejects(requestPracticeQuestions({ ...common, count: 1, fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ questions: [question, { ...question, prompt: "Another question?" }] }) }) }), /more questions/);
  await assert.rejects(requestPracticeQuestions({ ...common, fetchImpl: async () => ({ ok: false, text: async () => "<!doctype html>" }) }), /unreadable/);
});

test("best attempt compares percentages and keeps the winning denominator", () => {
  const attempts = [{ score: 12, total: 20 }, { score: 8, total: 10 }, { score: 3, total: 5 }];
  assert.equal(getBestAttempt(attempts), attempts[1]);
  assert.equal(getBestAttempt([{ score: 2, total: 0 }]), null);
  assert.equal(getBestAttempt([null, "invalid", { score: null, total: 5 }, { score: true, total: 1 }, attempts[1]]), attempts[1]);
  assert.equal(getBestAttempt(null), null);
});

test("saving generated questions preserves fresh state and prior history", () => {
  const state = { courses: ["new course"], quizSets: [{ id: "set", summary: "Saved elsewhere", questions: [], promptHistory: ["Earlier prompt"] }] };
  const questions = [{ ...question, id: "q" }];
  const next = saveGeneratedQuestions(state, "set", questions);
  assert.deepEqual(next.courses, state.courses);
  assert.equal(next.quizSets[0].summary, "Saved elsewhere");
  assert.deepEqual(next.quizSets[0].promptHistory, [question.prompt, "Earlier prompt"]);
  assert.equal(state.quizSets[0].questions.length, 0);
  assert.throws(() => saveGeneratedQuestions({ quizSets: [] }, "set", questions), /removed/);
});

test("result save retries are idempotent and keep the attempt snapshot", () => {
  const initial = { quizSets: [{ id: "set", attempts: [] }] };
  const attempt = { id: "session", score: 1, total: 1, questionsSnapshot: [question] };
  const once = savePracticeAttempt(initial, "set", attempt);
  const twice = savePracticeAttempt(once, "set", attempt);
  assert.equal(twice.quizSets[0].attempts.length, 1);
  assert.deepEqual(twice.quizSets[0].attempts[0].questionsSnapshot, [question]);
  assert.throws(() => savePracticeAttempt({ quizSets: [] }, "set", attempt), /removed/);
});
