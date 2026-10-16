import { describe, expect, it } from "vitest";

import { gateState, SCREEN_VALID_DAYS, scoreAnswers } from "./screening";

const options = [
  { label: "Never", value: 0 },
  { label: "Sometimes", value: 1 },
  { label: "Often", value: 2 },
];
const questions = [
  { id: "a", text: "A?", options },
  { id: "b", text: "B?", options },
  { id: "c", text: "C?", options },
];
const day = 86_400_000;
const now = new Date("2026-10-16T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * day);

describe("scoreAnswers", () => {
  it("adds the chosen option values", () => {
    expect(scoreAnswers(questions, [2, 1, 0])).toBe(3);
  });
  it("refuses a missing, extra, fractional, or out-of-range answer", () => {
    expect(scoreAnswers(questions, [0, 1])).toBeNull();
    expect(scoreAnswers(questions, [0, 1, 2, 0])).toBeNull();
    expect(scoreAnswers(questions, [0, 1, 1.5])).toBeNull();
    expect(scoreAnswers(questions, [0, 1, 3])).toBeNull();
    expect(scoreAnswers(questions, [0, 1, -1])).toBeNull();
  });
});

describe("gateState", () => {
  it("is none without a result", () => {
    expect(gateState(null, now)).toEqual({ state: "none" });
  });
  it("is below while a below result is current, up to day 89", () => {
    expect(gateState({ tier: "below", completedAt: ago(89) }, now).state).toBe("below");
  });
  it("expires a below result on day 90", () => {
    expect(gateState({ tier: "below", completedAt: ago(SCREEN_VALID_DAYS) }, now).state).toBe(
      "expired",
    );
  });
  it("holds at_or_above until day 90 and says when a retake opens", () => {
    const completedAt = ago(89);
    const held = gateState({ tier: "at_or_above", completedAt }, now);
    expect(held.state).toBe("at_or_above");
    expect(held).toMatchObject({ retakeAt: new Date(completedAt.getTime() + 90 * day) });
    expect(gateState({ tier: "at_or_above", completedAt: ago(90) }, now).state).toBe("expired");
  });
});
