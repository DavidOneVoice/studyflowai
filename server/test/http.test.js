import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../index.js";

async function serve(t, overrides = {}) {
  const service = {
    generateQuestions: async () => ({ questions: [], meta: {}, warning: null }),
    summarize: async () => ({ summary: "Study notes", meta: { chunked: false } }),
    ...overrides,
  };
  const server = createServer(createApp({ service, env: {} }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function post(base, route, body, options = {}) {
  return fetch(`${base}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...options,
  });
}

test("HTTP endpoints preserve success payloads and forward parsed request data", { timeout: 10000 }, async (t) => {
  const quiz = { questions: [{ id: "test", prompt: "Example?", options: ["a", "b", "c", "d"], answer: "a" }], meta: { returnedCount: 1 }, warning: null };
  const summary = { summary: "Complete study notes", meta: { chunked: false } };
  const requests = [];
  const base = await serve(t, {
    generateQuestions: async (body, { signal }) => {
      requests.push(body);
      assert.equal(signal.aborted, false);
      return quiz;
    },
    summarize: async (body) => { requests.push(body); return summary; },
  });
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const quizInput = { sourceText: "Study material", count: 1, title: "Biology", difficulty: "mixed", avoid: ["Previous question"] };
  const quizResponse = await post(base, "/api/generate-mcqs", quizInput);
  assert.equal(quizResponse.status, 200);
  assert.match(quizResponse.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await quizResponse.json(), quiz);

  const summaryInput = { sourceText: "Other study material", title: "Chemistry" };
  const summaryResponse = await post(base, "/api/summarize", summaryInput);
  assert.equal(summaryResponse.status, 200);
  assert.deepEqual(await summaryResponse.json(), summary);
  assert.deepEqual(requests, [quizInput, summaryInput]);
});

test("HTTP provider failures return safe JSON and the intended status", { timeout: 10000 }, async (t) => {
  for (const [upstreamStatus, upstreamCode, status, code] of [
    [401, "invalid_api_key", 503, "provider_auth"],
    [429, "insufficient_quota", 503, "provider_quota"],
    [429, "rate_limit_exceeded", 429, "provider_rate_limit"],
  ]) {
    await t.test(upstreamCode, async (t) => {
      const failure = Object.assign(new Error("Private upstream detail: sk-fake-credential-do-not-expose"), { status: upstreamStatus, code: upstreamCode });
      const base = await serve(t, { generateQuestions: async () => { throw failure; } });
      const response = await post(base, "/api/generate-mcqs", { sourceText: "Study material" });
      assert.equal(response.status, status);
      assert.match(response.headers.get("content-type"), /application\/json/);
      const body = await response.json();
      assert.equal(body.code, code);
      assert.equal(typeof body.error, "string");
      assert.doesNotMatch(JSON.stringify(body), /sk-fake|Private upstream detail/);
      assert.equal(Object.hasOwn(body, "detail"), false);
    });
  }
});

test("malformed JSON is rejected before generation with a JSON error", { timeout: 10000 }, async (t) => {
  let calls = 0;
  const base = await serve(t, { summarize: async () => { calls += 1; return { summary: "unused" }; } });
  const response = await post(base, "/api/summarize", '{"sourceText":');
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "The request must contain valid JSON.", code: "invalid_json" });
  assert.equal(calls, 0);
});

test("the existing 4MB transport boundary remains unchanged and returns JSON", { timeout: 10000 }, async (t) => {
  let calls = 0;
  const base = await serve(t, { summarize: async () => { calls += 1; return { summary: "Accepted" }; } });
  const underBoundary = { sourceText: "x".repeat(4 * 1024 * 1024 - 32) };
  const accepted = await post(base, "/api/summarize", underBoundary);
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { summary: "Accepted" });

  const overBoundary = { sourceText: "x".repeat(4 * 1024 * 1024) };
  const rejected = await post(base, "/api/summarize", overBoundary);
  assert.equal(rejected.status, 413);
  assert.equal((await rejected.json()).code, "request_too_large");
  assert.equal(calls, 1, "an oversized HTTP body must not reach the AI service");
});

test("disconnecting an HTTP client cancels its pending generation", { timeout: 10000 }, async (t) => {
  let started;
  const generationStarted = new Promise((resolve) => { started = resolve; });
  let cancelled;
  const generationCancelled = new Promise((resolve) => { cancelled = resolve; });
  let serviceSignal;
  const base = await serve(t, {
    summarize: (body, { signal }) => new Promise((resolve, reject) => {
      serviceSignal = signal;
      signal.addEventListener("abort", () => {
        cancelled();
        reject(signal.reason);
      }, { once: true });
      started();
    }),
  });
  const controller = new AbortController();
  const pendingResponse = post(base, "/api/summarize", { sourceText: "Study material" }, { signal: controller.signal });
  await generationStarted;
  controller.abort();
  await assert.rejects(pendingResponse, { name: "AbortError" });
  await generationCancelled;
  assert.equal(serviceSignal.aborted, true);
});
