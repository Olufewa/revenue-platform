import { Button } from './Button';

/** A failed load, with a way to try again. The same look as the sign-in error. */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-reversed-wash px-3 py-2 text-small text-reversed"
    >
      {message}
      <Button size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
