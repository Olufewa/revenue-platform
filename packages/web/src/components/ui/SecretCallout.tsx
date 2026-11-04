'use client';

import { useState } from 'react';
import { Button } from './Button';

type CopyState = 'idle' | 'copied' | 'failed';

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed',
};

/** A secret the API returns only once, such as a new API key. */
export function SecretCallout({ secret }: { secret: string }) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState('copied');
    } catch {
      // The clipboard needs a secure context. The key can still be selected.
      setCopyState('failed');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-control bg-gold-wash px-3.5 py-3">
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
        <div className="text-small font-medium">
          Copy this key now. You won&apos;t be able to see it again.
        </div>
        <code className="font-mono text-small wrap-anywhere">{secret}</code>
      </div>
      <Button variant="ink" onClick={copy} aria-live="polite">
        {COPY_LABEL[copyState]}
      </Button>
    </div>
  );
}
