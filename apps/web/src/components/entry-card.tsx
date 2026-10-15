import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Button,
  Input,
  Label,
  Radio,
  RadioGroup,
  Text,
  TextArea,
  TextField,
  ToggleButton,
} from "react-aria-components";

import { FormError } from "@/components/fields";
import { clearDraft, type Draft, loadDraft, saveDraft } from "@/lib/draft";
import { todayIn, zonedParts, zonedToUtc } from "@/lib/week";

const EMPTY = "This entry is empty. Add what you ate, a symptom, or both.";
const CONTEXTS = ["stress", "travel", "sleep", "cycle"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;
const label = (word: string) => word[0]?.toUpperCase() + word.slice(1);

export type CardEntry = {
  id: string;
  occurredAt: string;
  timeZone: string;
  food: string | null;
  symptom: string | null;
  severity: string | null;
  context: string[];
  flagged: boolean;
};
export type CardTarget = { mode: "new" } | { mode: "edit"; entry: CardEntry };

type Props = {
  target: CardTarget;
  userId: string;
  /** Called after the dialog closes; `keptDraft` is true when an unsaved new entry was kept. */
  onClose: (keptDraft: boolean) => void;
  onSaved: (entry: CardEntry) => void;
  /**
   * Called after an edited entry is deleted, with the entry as it was, so it can be undone.
   * `byPointer` is true when Delete was clicked or tapped.
   */
  onDeleted: (entry: CardEntry, byPointer: boolean) => void;
};

/**
 * One entry at a time (design brief section 6), in a native <dialog>: the browser makes the page
 * behind it inert, closes it on Esc, and returns focus to the button that opened it.
 * React Aria's Modal is not used because it injects an inline style the CSP blocks.
 */
export function EntryCard({ target, userId, onClose, onSaved, onDeleted }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const food = useRef<HTMLInputElement>(null);
  const saved = useRef(false);

  // An edit keeps the entry's own zone (decision 3); a new entry uses this device's zone.
  const editing = target.mode === "edit" ? target.entry : null;
  const zone = editing?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start: Draft = editing
    ? {
        food: editing.food ?? "",
        symptom: editing.symptom ?? "",
        context: editing.context,
        severity: editing.severity,
      }
    : (loadDraft(userId) ?? { food: "", symptom: "", context: [], severity: null });
  const when = zonedParts(editing?.occurredAt ?? new Date().toISOString(), zone);

  const [draft, setDraft] = useState<Draft>(start);
  const [date, setDate] = useState(when.date);
  const [time, setTime] = useState(when.time);
  const [error, setError] = useState<string | null>(null);
  const update = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));

  useEffect(() => {
    dialog.current?.showModal();
    food.current?.focus();
  }, []);

  function close() {
    dialog.current?.close();
  }

  // Every way of closing (Cancel, the close button, Esc, a click outside) ends here.
  function handleClose() {
    const hasText = draft.food.trim() || draft.symptom.trim() || draft.context.length > 0;
    const keep = !saved.current && !editing && Boolean(hasText);
    // A severity only means something next to a symptom, the same rule as saving.
    if (keep)
      saveDraft(userId, { ...draft, severity: draft.symptom.trim() ? draft.severity : null });
    // A new entry emptied on purpose, then closed, must not bring back an older draft.
    else if (!saved.current && !editing) clearDraft(userId);
    onClose(keep);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    // A cleared Date or Time cannot become a moment; say so instead of failing silently.
    if (!date || !time) {
      setError("Choose a date and a time.");
      return;
    }
    const body = {
      food: draft.food,
      symptom: draft.symptom,
      severity: draft.symptom.trim() ? draft.severity : null,
      context: draft.context,
      occurredAt: zonedToUtc(date, time, zone),
      timeZone: zone,
    };
    let res: Response;
    try {
      res = await fetch(editing ? `/api/entries/${editing.id}` : "/api/entries", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError("Your entry could not be saved. Check your connection and try again.");
      return;
    }
    if (!res.ok) {
      // The server decides what counts as empty, so the browser keeps no copy of that rule.
      const message = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
      setError(message ?? "Your entry could not be saved. Try again.");
      if (message === EMPTY) food.current?.focus();
      return;
    }
    saved.current = true;
    if (!editing) clearDraft(userId);
    onSaved((await res.json()) as CardEntry);
    close();
  }

  // PRD 5.2: no confirmation; the journal offers Undo instead.
  async function remove(entry: CardEntry, byPointer: boolean) {
    setError(null);
    let res: Response;
    try {
      res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
    } catch {
      setError("Your entry could not be deleted. Check your connection and try again.");
      return;
    }
    if (!res.ok) {
      const message = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
      setError(message ?? "Your entry could not be deleted. Try again.");
      return;
    }
    saved.current = true;
    onDeleted(entry, byPointer);
    close();
  }

  const empty = error === EMPTY;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a click on the backdrop is a pointer-only extra; Esc and the close buttons cover the keyboard.
    <dialog
      ref={dialog}
      className="entry-dlg"
      aria-labelledby="card-title"
      onClose={handleClose}
      onClick={(event) => {
        // A click outside closes a new entry, which keeps its draft. An edit keeps no draft, so a
        // stray click must not throw it away (decision 16); Cancel, the close button, and Esc still do.
        if (event.target === event.currentTarget && !editing) close();
      }}
    >
      <form className="entry-form" onSubmit={(event) => void save(event)} noValidate>
        <div className="dlg-head">
          <h2 id="card-title">{editing ? "Edit entry" : "New entry"}</h2>
          <Button className="icon-btn" aria-label="Close" onPress={close}>
            <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </Button>
        </div>
        <div className="dlg-body">
          <FormError message={error} />
          <TextField
            className="field"
            value={draft.food}
            onChange={(food) => update({ food })}
            isInvalid={empty}
          >
            <Label className="label">Food</Label>
            <Input ref={food} className="input" autoComplete="off" />
          </TextField>
          <TextField
            className="field"
            value={draft.symptom}
            onChange={(symptom) => update({ symptom })}
            isInvalid={empty}
          >
            <Label className="label">Symptoms</Label>
            <TextArea className="input textarea" rows={2} />
            <Text slot="description" className="hint">
              Leave empty if nothing to note.
            </Text>
          </TextField>
          <fieldset className="card-set">
            <legend>Context</legend>
            <div className="chips">
              {CONTEXTS.map((c) => (
                <ToggleButton
                  key={c}
                  className="chip"
                  isSelected={draft.context.includes(c)}
                  onChange={(on) =>
                    update({
                      context: on ? [...draft.context, c] : draft.context.filter((x) => x !== c),
                    })
                  }
                >
                  {label(c)}
                </ToggleButton>
              ))}
            </div>
          </fieldset>
          <fieldset className="card-set">
            <legend>When</legend>
            <div className="when">
              <TextField className="field" type="date" value={date} onChange={setDate}>
                <Label className="label">Date</Label>
                <Input className="input" max={todayIn(zone)} required />
              </TextField>
              <TextField className="field" type="time" value={time} onChange={setTime}>
                <Label className="label">Time</Label>
                <Input className="input" required />
              </TextField>
            </div>
          </fieldset>
          <details className="sev" open={Boolean(draft.severity)}>
            <summary>Add severity</summary>
            <RadioGroup
              className="sev-opts"
              aria-label="Severity"
              value={draft.severity}
              onChange={(severity) => update({ severity })}
            >
              {SEVERITIES.map((s) => (
                <Radio key={s} value={s} className="chip">
                  {label(s)}
                </Radio>
              ))}
            </RadioGroup>
          </details>
        </div>
        <div className="dlg-foot">
          {editing && (
            <Button
              className="btn btn-secondary delete-entry"
              onPress={(event) =>
                void remove(editing, ["mouse", "touch", "pen"].includes(event.pointerType))
              }
            >
              Delete entry
            </Button>
          )}
          <Button className="btn btn-secondary" onPress={close}>
            Cancel
          </Button>
          <Button type="submit" className="btn btn-primary">
            Save entry
          </Button>
        </div>
      </form>
    </dialog>
  );
}
