import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DATE_RANGES = ['Today', '7D', '30D', 'MTD'] as const;
export type DateRange = (typeof DATE_RANGES)[number];

interface WorkspaceState {
  activeServiceId: string | null;
  dateRange: DateRange;
  setActiveServiceId: (serviceId: string | null) => void;
  setDateRange: (dateRange: DateRange) => void;
}

/**
 * What the person is looking at, remembered between visits. Rehydrated by
 * StoreHydration after mount, so the first client render matches the server.
 */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeServiceId: null,
      dateRange: 'MTD',
      setActiveServiceId: (activeServiceId) => set({ activeServiceId }),
      setDateRange: (dateRange) => set({ dateRange }),
    }),
    { name: 'revenue-platform.workspace', skipHydration: true },
  ),
);
