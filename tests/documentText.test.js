import test from "node:test";
import assert from "node:assert/strict";
import { createLatestTask, readDocumentText, sourceCharacterCount } from "../src/lib/documentText.js";

const material = "Study notes about photosynthesis and the transfer of energy through a food chain. ".repeat(2);
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
};

test("only the latest upload may publish text or errors", async () => {
  const latest = createLatestTask();
  const first = deferred();
  const second = deferred();
  const oldRead = latest.run(() => first.promise);
  const newRead = latest.run(() => second.promise);
  second.resolve("new material");
  assert.deepEqual(await newRead, { status: "success", value: "new material" });
  first.reject(new Error("old file failed"));
  assert.deepEqual(await oldRead, { status: "stale" });
});

test("manual changes and unmount cancel pending upload results", async () => {
  const latest = createLatestTask();
  const pending = deferred();
  const read = latest.run(() => pending.promise);
  latest.cancel();
  pending.resolve("stale file text");
  assert.deepEqual(await read, { status: "stale" });
});

test("TXT reads do not load PDF or DOCX libraries; errors are caught by latest task", async () => {
  const unused = () => { throw new Error("Parser was loaded unnecessarily"); };
  assert.equal(await readDocumentText({ name: "notes.TXT", text: async () => material }, { pdf: unused, docx: unused }), material.trim());
  const latest = createLatestTask();
  const result = await latest.run(() => readDocumentText({ name: "notes.txt", text: async () => { throw new Error("File unavailable"); } }));
  assert.equal(result.status, "error");
  assert.equal(result.error.message, "File unavailable");
});

test("PDF and DOCX use only their selected parser and preserve Unicode", async () => {
  const unicode = `α ≤ β; √4 = 2; résultat ≥ zéro. ${material}`;
  assert.equal(await readDocumentText({ name: "math.pdf" }, { pdf: async () => ({ extractTextFromPdf: async () => unicode }) }), unicode.trim());
  assert.equal(await readDocumentText({ name: "math.docx", arrayBuffer: async () => new ArrayBuffer(0) }, { docx: async () => ({ default: { extractRawText: async () => ({ value: unicode }) } }) }), unicode.trim());
});

test("source validation matches the API minimum without adding document caps", async () => {
  await assert.rejects(() => readDocumentText({ name: "notes.txt", text: async () => "a".repeat(79) }), /80 characters/);
  assert.equal((await readDocumentText({ name: "notes.txt", text: async () => "a".repeat(80) })).length, 80);
  await assert.rejects(() => readDocumentText({ name: "file.exe" }), /\.txt, \.docx, or \.pdf/);
});

test("extra whitespace cannot satisfy the minimum and source formatting is preserved", async () => {
  const padded = `a${" \n\t".repeat(40)}b`;
  assert.equal(sourceCharacterCount(padded), 3);
  await assert.rejects(() => readDocumentText({ name: "notes.txt", text: async () => padded }), /80 characters/);
  const formatted = `${"a".repeat(40)}\n\n  \t${"b".repeat(40)}`;
  assert.equal(sourceCharacterCount(formatted), 81);
  assert.equal(await readDocumentText({ name: "notes.txt", text: async () => formatted }), formatted);
});
