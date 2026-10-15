// An unsaved New entry, kept on this device only (PRD 5.2, decision 14). It is stored under the
// user's id, so it never reopens for someone else signing in on the same browser, and it is
// cleared on save and on sign-out. Storage can be blocked or full, so every access is guarded:
// a lost draft is an inconvenience, a crash is not.

export type Draft = {
  food: string;
  symptom: string;
  context: string[];
  severity: string | null;
};

const key = (userId: string) => `steady:draft:${userId}`;

export function loadDraft(userId: string, storage: Storage = localStorage): Draft | null {
  try {
    const raw = storage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: Draft, storage: Storage = localStorage) {
  try {
    storage.setItem(key(userId), JSON.stringify(draft));
  } catch {
    // Storage is full or blocked; the draft is simply not kept.
  }
}

export function clearDraft(userId: string, storage: Storage = localStorage) {
  try {
    storage.removeItem(key(userId));
  } catch {
    // Nothing to clear if storage is blocked.
  }
}
