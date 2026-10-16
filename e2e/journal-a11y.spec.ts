import type { Locator, Page } from "@playwright/test";

import { expect, signUp, test, weekUrl } from "./fixtures";

// Milestone 1 step 8: the journal works from the keyboard alone, and every target is 44px.
test.use({ timezoneId: "America/Toronto" });

// Text and date fields share .input. A Radio's own input is visually hidden, so its .chip label
// is the target.
const TARGETS = ["button:visible", "a:visible", ".input", "summary", ".chip"];

async function signUpWithEntry(page: Page) {
  await signUp(page);
  const res = await page.request.post("/api/entries", {
    data: { occurredAt: "2026-10-05T16:30:00Z", timeZone: "America/Toronto", food: "Toast" },
  });
  expect(res.status()).toBe(201);
  await page.goto(weekUrl("2026-10-05"));
}

/**
 * Presses Tab, or Shift+Tab for a target earlier on the page, until the target has focus, so the
 * test fails if it cannot be reached. Firefox does not wrap from the last element to the first.
 */
async function tabTo(page: Page, target: Locator) {
  const before = await target.evaluate(
    (el) =>
      !!document.activeElement &&
      document.activeElement !== document.body &&
      !!(el.compareDocumentPosition(document.activeElement) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
  const key = before ? "Shift+Tab" : "Tab";
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(key);
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`${key} never reached the target`);
}

test("the whole journal works from the keyboard", async ({ page, ip: _, isMobile }) => {
  // Emulated iPhone WebKit does not Tab through buttons; on a phone, keyboard and switch users
  // go through Full Keyboard Access or VoiceOver, which the manual VoiceOver pass covers.
  test.skip(isMobile, "Desktop keyboards only");
  await signUpWithEntry(page);

  // Flag with Space.
  const flag = page.getByRole("button", { name: /^Flag, Monday 5 October/ });
  await tabTo(page, flag);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /^Flagged, Monday 5 October/ })).toBeFocused();

  // A new entry: type, then Enter in a field saves.
  const newEntry = page.getByRole("button", { name: "New entry" });
  await tabTo(page, newEntry);
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog", { name: "New entry" });
  await expect(card.getByLabel("Food")).toBeFocused();
  await page.keyboard.type("Rice");
  await page.keyboard.press("Enter");
  await expect(card).toBeHidden();
  await expect(newEntry).toBeFocused();

  // Edit, then delete and undo, all with Enter.
  await page.goto(weekUrl("2026-10-05"));
  const edit = page.getByRole("button", { name: "Edit entry, Monday 5 October 12:30 PM" });
  await tabTo(page, edit);
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByRole("button", { name: "Delete entry" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(edit).toBeFocused();

  // Moving between weeks.
  await tabTo(page, page.getByRole("button", { name: /Previous week/ }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/week=2026-09-28/);
});

test("every target on the journal and in the card is at least 44px", async ({ page, ip: _ }) => {
  await signUpWithEntry(page);
  const small = async () =>
    page.locator(TARGETS.join(", ")).evaluateAll((els) =>
      els
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        // Rounded, because a 3x screen can report 44px as 43.99997.
        .filter(({ box }) => Math.round(box.width) < 44 || Math.round(box.height) < 44)
        .map(({ el, box }) => `${el.outerHTML.slice(0, 80)} ${box.width}x${box.height}`),
    );
  expect(await small()).toEqual([]);

  await page.getByRole("button", { name: "Edit entry, Monday 5 October 12:30 PM" }).click();
  await page.getByText("Add severity").click();
  expect(await small()).toEqual([]);
});

test("with reduced motion, the card and toast appear without animating", async ({
  page,
  ip: _,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpWithEntry(page);
  await page.getByRole("button", { name: "New entry" }).click();
  const dialog = page.getByRole("dialog", { name: "New entry" });
  expect(await dialog.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  const toast = page.locator(".toast");
  expect(await toast.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
});
