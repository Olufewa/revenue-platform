'use client';

import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace';

/** Loads persisted state after mount, once the server markup has hydrated. */
export function StoreHydration() {
  useEffect(() => {
    void useWorkspaceStore.persist.rehydrate();
  }, []);

  return null;
}
