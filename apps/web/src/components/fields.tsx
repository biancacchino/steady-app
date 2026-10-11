import type { ReactNode } from "react";
import {
  Checkbox,
  FieldError,
  Input,
  Label,
  Text,
  TextField,
  type TextFieldProps,
} from "react-aria-components";

function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

type FieldProps = TextFieldProps & { label: string; hint?: string };

/**
 * A labeled text input. Errors come from the form's `validationErrors` (set on submit),
 * show as text plus an icon, and clear when the user edits the field.
 */
export function Field({ label, hint, ...props }: FieldProps) {
  return (
    <TextField className="field" {...props}>
      <Label className="label">{label}</Label>
      <Input className="input" />
      {hint && (
        <Text slot="description" className="hint">
          {hint}
        </Text>
      )}
      <FieldError className="field-error">
        {({ validationErrors }) => (
          <>
            <AlertIcon />
            {validationErrors.join(" ")}
          </>
        )}
      </FieldError>
    </TextField>
  );
}

/** A checkbox whose whole row is the tap target. */
export function CheckField({
  name,
  children,
  isSelected,
  onChange,
  error,
}: {
  name: string;
  children: ReactNode;
  isSelected: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  return (
    <div className="field">
      <Checkbox
        className="check"
        name={name}
        isSelected={isSelected}
        onChange={onChange}
        isInvalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        <span className="box" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" strokeWidth="2.2" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {children}
      </Checkbox>
      {error && (
        <p id={`${name}-error`} className="field-error">
          <AlertIcon />
          {error}
        </p>
      )}
    </div>
  );
}

/** Moves focus to the first field that has an error, so keyboard and screen reader users land on it. */
export function focusFirstError(form: HTMLFormElement, errors: Record<string, string>) {
  const first = Object.keys(errors)[0];
  const el = first ? form.elements.namedItem(first) : null;
  if (el instanceof HTMLElement) el.focus();
}

/** A form-level error, announced to screen readers when it appears. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="form-error" role="alert">
      <AlertIcon />
      {message}
    </p>
  );
}
