// The summary as a PDF (PRD 5.4), drawn from the reviewed snapshot only. Compact layout from the
// design brief: header block, then date, Food, and Symptoms per included entry, then questions.
// The lines are summaryText's lines, so the PDF and the copied text say exactly the same thing.
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";

import { headerLines, NO_FLAGGED, type Snapshot } from "./summary-content";

// Self-hosted, like the web app (no font from another origin). Latin subset only, so characters
// outside it, like most emoji, print blank; the copied text keeps them.
const font = (weight: 400 | 500) =>
  createRequire(import.meta.url).resolve(
    `@fontsource/hanken-grotesk/files/hanken-grotesk-latin-${weight}-normal.woff`,
  );
const REGULAR = font(400);
const MEDIUM = font(500);
const INK = "#212121";
const MUTED = "#6b6b80";

export function renderPdf(s: Snapshot): Promise<Buffer> {
  // Generic metadata: the file name and properties never carry a name or journal text.
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 54,
    font: REGULAR,
    info: { Title: "Appointment summary", Producer: "Steady", Creator: "Steady" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const heading = (text: string) => {
    doc.moveDown(1.2).font(MEDIUM).fontSize(13).fillColor(INK).text(text).moveDown(0.3);
    doc.font(REGULAR).fontSize(11);
  };

  doc.font(MEDIUM).fontSize(20).fillColor(INK).text("Appointment summary").moveDown(0.4);
  doc.font(REGULAR).fontSize(11).fillColor(MUTED);
  for (const line of headerLines(s)) doc.text(line);

  heading("Pattern observed");
  for (const line of s.observations) doc.text(line);

  heading("Worth flagging");
  if (s.flagged.length === 0) doc.text(NO_FLAGGED);
  for (const f of s.flagged) {
    doc.font(MEDIUM).text(`${f.day}, ${f.time}`).font(REGULAR);
    doc.text(`Food: ${f.food}`).text(`Symptoms: ${f.symptom}`).moveDown(0.6);
  }

  heading("Questions to bring");
  s.questions.forEach((q, i) => {
    doc.text(`${i + 1}. ${q}`).moveDown(0.3);
  });

  doc.end();
  return done;
}
