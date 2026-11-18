import { useId } from 'react';
import { Input, type InputProps } from './Input';
import { Select, type SelectProps } from './Select';

interface FieldProps extends InputProps {
  label: string;
  hint?: string;
  error?: string;
}

/** A labelled input, with its hint or error tied to it for assistive tech. */
export function Field({ label, hint, error, id, ...inputProps }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const message = error ?? hint;
  const messageId = `${inputId}-message`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-small font-medium">
        {label}
      </label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...inputProps}
      />
      {message && (
        <span
          id={messageId}
          className={`text-caption ${error ? 'text-reversed' : 'text-ink-2'}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}

interface SelectFieldProps extends SelectProps {
  label: string;
  hint?: string;
}

/** A labelled dropdown, laid out like Field. Pass the options as children. */
export function SelectField({
  label,
  hint,
  id,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-small font-medium">
        {label}
      </label>
      <Select
        id={selectId}
        aria-describedby={hint ? hintId : undefined}
        {...selectProps}
      />
      {hint && (
        <span id={hintId} className="text-caption text-ink-2">
          {hint}
        </span>
      )}
    </div>
  );
}
