import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import type { Snapshot } from "./summary-content";
import { summaryText } from "./summary-content";
import { renderPdf } from "./summary-pdf";

const snapshot: Snapshot = {
  providerName: "Dr. Osei",
  appointmentDate: "2026-10-20",
  rangeStart: "2026-10-01",
  rangeEnd: "2026-10-14",
  observations: ["You logged 3 entries on 3 days.", "2 of 3 logged days mentioned bloating."],
  flagged: [
    { day: "Mon 5 October", time: "12:30 PM", food: "Pasta, café au lait", symptom: "bloating" },
  ],
  questions: ["Is the bloating worth looking into?"],
};

async function textOf(pdf: Buffer) {
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}

describe("renderPdf", () => {
  it("is a PDF whose text is the snapshot's text, line by line, in order", async () => {
    const pdf = await renderPdf(snapshot);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = await textOf(pdf);
    let at = 0;
    for (const line of summaryText(snapshot).split("\n").filter(Boolean)) {
      const found = text.indexOf(line, at);
      expect(found, `"${line}" in order`).toBeGreaterThanOrEqual(at);
      at = found + line.length;
    }
  });

  it("keeps the metadata generic, with no names or journal text", async () => {
    const doc = await getDocumentProxy(new Uint8Array(await renderPdf(snapshot)));
    const { info } = await doc.getMetadata();
    expect(JSON.stringify(info)).not.toMatch(/Osei|Pasta|bloating/);
    expect((info as { Title?: string }).Title).toBe("Appointment summary");
  });
});
