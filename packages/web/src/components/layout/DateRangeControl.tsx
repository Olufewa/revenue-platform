'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DATE_RANGES, useWorkspaceStore } from '@/stores/workspace';

export function DateRangeControl() {
  const dateRange = useWorkspaceStore((state) => state.dateRange);
  const setDateRange = useWorkspaceStore((state) => state.setDateRange);

  return (
    <SegmentedControl
      label="Date range"
      options={DATE_RANGES}
      value={dateRange}
      onChange={setDateRange}
    />
  );
}
