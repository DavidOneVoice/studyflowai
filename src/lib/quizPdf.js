const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 42,
  marginY: 52,
  lineHeight: 15,
};

function sanitizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function escapePdfText(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text, maxChars = 92) {
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if ((current + " " + word).length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function toPdfBytes(content) {
  return new TextEncoder().encode(content);
}

function makePdf({ title, questions }) {
  const pageStreams = [];
  let lines = [];
  let y = PAGE.height - PAGE.marginY;

  function pushLine(text, { size = 12, bold = false, indent = 0 } = {}) {
    if (y <= PAGE.marginY) {
      pageStreams.push(lines.join("\n"));
      lines = [];
      y = PAGE.height - PAGE.marginY;
    }

    const font = bold ? "F2" : "F1";
    lines.push(`BT /${font} ${size} Tf 1 0 0 1 ${PAGE.marginX + indent} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
    y -= PAGE.lineHeight;
  }

  pushLine(sanitizeText(title || "Practice Questions"), { size: 17, bold: true });
  y -= 4;
  pushLine(`Total Questions: ${questions.length}`, { size: 11 });
  y -= 6;

  questions.forEach((q, idx) => {
    wrapLine(`${idx + 1}. ${q?.prompt || ""}`, 90).forEach((line, i) => {
      pushLine(line, { size: 12, bold: i === 0 });
    });

    (q?.options || []).forEach((opt, i) => {
      wrapLine(`${String.fromCharCode(65 + i)}) ${opt}`, 86).forEach((line) => {
        pushLine(line, { size: 11, indent: 18 });
      });
    });

    if (q?.answer) {
      pushLine(`Answer: ${sanitizeText(q.answer)}`, {
        size: 10,
        bold: true,
        indent: 18,
      });
    }

    y -= 8;
  });

  if (lines.length) pageStreams.push(lines.join("\n"));

  const objects = [];
  const pages = [];

  const fontRegularId = 3;
  const fontBoldId = 4;

  pageStreams.forEach((stream, index) => {
    const contentId = 5 + index * 2;
    const pageId = contentId + 1;

    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    pages.push(`${pageId} 0 R`);
  });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pages.join(" ")}] /Count ${pages.length} >>`;
  objects[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  let pdf = "%PDF-1.4\n";
  const xref = [0];

  for (let i = 1; i < objects.length; i += 1) {
    if (!objects[i]) continue;
    xref[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  const maxId = objects.length - 1;
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i <= maxId; i += 1) {
    const offset = xref[i] || 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return toPdfBytes(pdf);
}

export function exportQuestionsAsPdf({ title, questions = [] }) {
  const bytes = makePdf({ title, questions });
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const fileName = sanitizeText(title || "practice-questions")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName || "practice-questions"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
