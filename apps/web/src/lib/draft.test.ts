import { describe, expect, it } from "vitest";

import { clearDraft, loadDraft, saveDraft } from "./draft";

/** A stand-in for localStorage. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

const draft = { food: "", symptom: "bad cramps", context: ["stress"], severity: null };

describe("drafts", () => {
  it("reopens only for the user who wrote it (decision 14)", () => {
    const storage = memoryStorage();
    saveDraft("maya", draft, storage);
    expect(loadDraft("maya", storage)).toEqual(draft);
    expect(loadDraft("brother", storage)).toBeNull();
  });

  it("is gone once cleared", () => {
    const storage = memoryStorage();
    saveDraft("maya", draft, storage);
    clearDraft("maya", storage);
    expect(loadDraft("maya", storage)).toBeNull();
  });

  it("treats unreadable or broken storage as no draft", () => {
    const storage = memoryStorage();
    storage.setItem("steady:draft:maya", "{not json");
    expect(loadDraft("maya", storage)).toBeNull();
    const blocked = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadDraft("maya", blocked)).toBeNull();
  });
});
