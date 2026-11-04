import { clsx } from 'clsx';

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
}

/** A set of mutually exclusive options, such as a date range. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  fullWidth,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={clsx(
        'overflow-hidden rounded-control border border-line bg-surface',
        fullWidth ? 'flex' : 'inline-flex',
      )}
    >
      {options.map((option) => {
        const selected = option === value;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={clsx(
              'h-control border-r border-line px-3 text-small whitespace-nowrap last:border-r-0 focus-visible:outline-current focus-visible:-outline-offset-4',
              fullWidth && 'flex-1',
              selected
                ? 'bg-ink font-medium text-surface'
                : 'bg-surface text-ink-body hover:bg-paper',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
