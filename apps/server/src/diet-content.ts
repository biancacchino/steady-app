// Placeholder diet plan (PRD 5.6). It stays on the server and is sent only through the gated
// `/api/diet`; `scripts/check-bundle.mjs` fails the build if any of it reaches the web bundle.
// A dietitian writes the real content (PRD 12).
export const dietContent = {
  placeholderNotice:
    "Placeholder content, not dietary advice. A dietitian has not reviewed it yet.",
  intro:
    "This plan has a clear start and a clear end. You can stop at any time, and your journal works the same either way.",
  elimination: {
    title: "Elimination phase",
    lengthDays: 28,
    summary:
      "For four weeks, you set aside a short list of foods your care team agrees on with you. Keep logging in your journal as usual.",
  },
  // Days counted from the plan's start. The dates are fixed and read-only (PRD 5.6).
  reintroduction: [
    {
      title: "Step 1",
      fromDay: 29,
      toDay: 35,
      summary: "Bring back the first group of foods and note how your body responds.",
    },
    {
      title: "Step 2",
      fromDay: 36,
      toDay: 42,
      summary: "Bring back the second group of foods and note how your body responds.",
    },
    {
      title: "Step 3",
      fromDay: 43,
      toDay: 49,
      summary: "Bring back the third group of foods and note how your body responds.",
    },
  ],
};
