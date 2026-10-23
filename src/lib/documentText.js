export const MIN_SOURCE_CHARACTERS = 80;

export function sourceCharacterCount(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().length;
}

export async function readDocumentText(file, loaders = {}) {
  const extension = file.name.split(".").at(-1).toLowerCase();
  let text;
  if (extension === "txt") {
    text = await file.text();
  } else if (extension === "pdf") {
    const { extractTextFromPdf } = await (loaders.pdf?.() || import("./pdfText.js"));
    text = await extractTextFromPdf(file);
  } else if (extension === "docx") {
    const module = await (loaders.docx?.() || import("mammoth"));
    const mammoth = module.default || module;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else {
    throw new Error("Please upload a .txt, .docx, or .pdf file.");
  }
  const cleaned = String(text || "").trim();
  if (sourceCharacterCount(cleaned) < MIN_SOURCE_CHARACTERS) {
    throw new Error(extension === "pdf"
      ? "Not enough selectable text was found. Try another PDF or paste at least 80 characters. Scanned PDFs may need OCR."
      : "Not enough text was found. Try another file or paste at least 80 characters.");
  }
  return cleaned;
}

// A replacement upload, manual edit, or unmount invalidates previous work.
export function createLatestTask() {
  let version = 0;
  return {
    cancel() { version += 1; },
    async run(task) {
      const currentVersion = ++version;
      try {
        const value = await task();
        return currentVersion === version ? { status: "success", value } : { status: "stale" };
      } catch (error) {
        return currentVersion === version ? { status: "error", error } : { status: "stale" };
      }
    },
  };
}
