import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { createQuestionsPdf, questionPdfSections } from "../src/lib/quizPdf.js";

const fontBytes = await Promise.all(["NotoSans-Regular.ttf", "NotoSansMath-Regular.ttf"].map((file) => readFile(new URL(`../src/assets/fonts/${file}`, import.meta.url))));
const questions = [{ prompt: "For α ≤ β, is √4 ≥ 2? Étudiez le résultat.", options: ["Oui", "Non", "β = 0", "α > β"], answer: "Oui", explanation: "√4 = 2, donc 2 ≥ 2. Café, naïve, piñata." }];

test("PDF content keeps mathematical symbols, Greek letters, and accents", async () => {
  const sections = questionPdfSections({ title: "Révision", questions });
  assert.ok(sections.some((section) => section.text.includes("α ≤ β")));
  assert.ok(sections.some((section) => section.text.includes("√4 ≥ 2")));
  assert.ok(sections.some((section) => section.text.includes("Café, naïve, piñata")));
  const bytes = await createQuestionsPdf({ title: "Révision", questions, fontBytes });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), "Révision");
  const cmaps = pdf.context.enumerateIndirectObjects().map(([, object]) => object instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(object).decode()) : "").filter((text) => text.includes("begincmap")).join("\n").toLowerCase();
  for (const character of "αβ≤≥√éñ") {
    const unicode = character.codePointAt(0).toString(16).padStart(4, "0");
    assert.ok(cmaps.includes(unicode), `Export must contain a Unicode mapping for ${character}`);
  }
});

test("unsupported glyphs fail clearly instead of disappearing", async () => {
  await assert.rejects(createQuestionsPdf({ title: "Unsupported 🦄", questions, fontBytes }), /cannot display 🦄.*No text has been removed/);
});

test("long titles and mathematical answers wrap across pages", async () => {
  const longQuestions = Array.from({ length: 25 }, () => ({ ...questions[0], answer: "α≤β√4≥2".repeat(30) }));
  const bytes = await createQuestionsPdf({ title: "Révision ".repeat(30), questions: longQuestions, fontBytes });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
});
