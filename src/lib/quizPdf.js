const PAGE = { width: 595.28, height: 841.89, marginX: 42, marginY: 48 };
const FONT_URLS = [
  new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url),
  new URL("../assets/fonts/NotoSansMath-Regular.ttf", import.meta.url),
];
let cachedFonts;

async function loadFontBytes() {
  cachedFonts ||= Promise.all(FONT_URLS.map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("The PDF fonts could not be loaded. Please try again when connected.");
    return response.arrayBuffer();
  })).catch((error) => { cachedFonts = undefined; throw error; });
  return cachedFonts;
}

function cleanText(value) {
  return Array.from(String(value ?? "").normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, "    "))
    .filter((character) => character === "\n" || (character.codePointAt(0) >= 32 && character.codePointAt(0) !== 127))
    .join("");
}

export function questionPdfSections({ title, questions }) {
  const sections = [
    { text: cleanText(title || "Practice Questions"), size: 18, gap: 8 },
    { text: `Total Questions: ${questions.length}`, size: 11, gap: 14 },
  ];
  questions.forEach((question, index) => {
    sections.push({ text: cleanText(`${index + 1}. ${question.prompt || ""}`), size: 12, gap: 5 });
    (question.options || []).forEach((option, optionIndex) => sections.push({ text: cleanText(`${String.fromCharCode(65 + optionIndex)}) ${option}`), size: 11, indent: 18, gap: 3 }));
    if (question.answer) sections.push({ text: cleanText(`Answer: ${question.answer}`), size: 10, indent: 18, gap: 4 });
    if (question.explanation) sections.push({ text: cleanText(`Explanation: ${question.explanation}`), size: 10, indent: 18, gap: 4 });
    sections.push({ text: "", size: 10, gap: 9 });
  });
  return sections;
}

function makeTextMetrics(fonts) {
  const characterSets = fonts.map((font) => new Set(font.getCharacterSet()));
  function runs(text) {
    const result = [];
    for (const character of text) {
      const fontIndex = characterSets.findIndex((set) => set.has(character.codePointAt(0)));
      if (fontIndex === -1) {
        const code = character.codePointAt(0).toString(16).toUpperCase();
        throw new Error(`PDF export cannot display ${character} (U+${code}) with its current fonts. No text has been removed. Use your browser's Print to PDF option for this content.`);
      }
      if (result.at(-1)?.font === fonts[fontIndex]) result.at(-1).text += character;
      else result.push({ text: character, font: fonts[fontIndex] });
    }
    return result;
  }
  const widths = new Map();
  return {
    runs,
    width(text, size) {
      const key = `${size}:${text}`;
      if (!widths.has(key)) widths.set(key, runs(text).reduce((total, run) => total + run.font.widthOfTextAtSize(run.text, size), 0));
      return widths.get(key);
    },
  };
}

function wrapText(text, maxWidth, size, metrics) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (metrics.width(candidate, size) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      // Long words and formulas must wrap as well; keep every Unicode character.
      for (const character of word) {
        if (line && metrics.width(line + character, size) > maxWidth) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function createQuestionsPdf({ title, questions = [], fontBytes }) {
  const [{ PDFDocument }, fontkitModule, bytes] = await Promise.all([
    import("pdf-lib"), import("@pdf-lib/fontkit"), fontBytes ? Promise.resolve(fontBytes) : loadFontBytes(),
  ]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkitModule.default || fontkitModule);
  const fonts = await Promise.all(bytes.map((data) => document.embedFont(data, { subset: true })));
  const metrics = makeTextMetrics(fonts);
  const sections = questionPdfSections({ title, questions });
  // Check all glyphs before creating a download, rather than silently replacing text.
  sections.forEach((section) => metrics.runs(section.text.replace(/\n/g, "")));
  document.setTitle(cleanText(title || "Practice Questions"));
  document.setCreator("StudyFlo AI");
  let page = document.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.marginY;
  for (const section of sections) {
    const { size, indent = 0, gap = 0 } = section;
    const lineHeight = size * 1.45;
    const lines = wrapText(section.text, PAGE.width - 2 * PAGE.marginX - indent, size, metrics);
    for (const line of lines) {
      if (y - lineHeight < PAGE.marginY) { page = document.addPage([PAGE.width, PAGE.height]); y = PAGE.height - PAGE.marginY; }
      let x = PAGE.marginX + indent;
      for (const run of metrics.runs(line)) {
        page.drawText(run.text, { x, y, size, font: run.font });
        x += run.font.widthOfTextAtSize(run.text, size);
      }
      y -= lineHeight;
    }
    y -= gap;
  }
  return document.save();
}

export async function exportQuestionsAsPdf({ title, questions = [] }) {
  const bytes = await createQuestionsPdf({ title, questions });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const fileName = cleanText(title || "practice-questions").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName || "practice-questions"}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
