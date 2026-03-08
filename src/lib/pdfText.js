import * as pdfjsLib from "pdfjs-dist";

/**
 * Configure pdf.js worker for Vite environments.
 * Uses a local module-based worker path so bundling works correctly.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/**
 * Extracts plain text from a PDF file.
 *
 * Steps:
 * - Convert file to ArrayBuffer.
 * - Load document with pdf.js.
 * - Iterate through each page.
 * - Extract text content from page items.
 * - Concatenate and return the full trimmed text.
 */
export async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();

  // Load the PDF document from raw binary data.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  // Loop through all pages (1-based index in pdf.js).
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Extract text fragments from page items.
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    fullText += pageText + "\n";
  }

  return fullText.trim();
}
