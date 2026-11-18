import { Fragment } from 'react';
import { clsx } from 'clsx';

const STEPS = ['Details', 'Accounts', 'Connect'];

/** Where someone is in registering a service: step 1, 2 or 3. */
export function WizardSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol
      aria-label="Steps"
      className="flex max-w-190 flex-wrap items-center gap-3"
    >
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;

        return (
          <Fragment key={label}>
            {index > 0 && (
              <li
                aria-hidden
                className={clsx(
                  'h-px min-w-6 flex-[1_1_40px]',
                  done || active ? 'bg-ink' : 'bg-line',
                )}
              />
            )}
            <li
              aria-current={active ? 'step' : undefined}
              className="flex items-center gap-2.5"
            >
              <span
                aria-hidden
                className={clsx(
                  'inline-flex size-6.5 shrink-0 items-center justify-center rounded-full text-small font-semibold',
                  done && 'bg-ink text-surface',
                  active && 'bg-gold text-ink',
                  !done && !active && 'border border-line-strong text-ink-2',
                )}
              >
                {done ? '✓' : step}
              </span>
              <span
                className={clsx(
                  active && 'font-semibold',
                  !done && !active && 'text-ink-2',
                )}
              >
                {label}
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
