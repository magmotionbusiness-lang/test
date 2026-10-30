import { useState } from 'react';
import { Page } from '@/components/Page';
import { EmptyState, Segmented } from '@/components/ui';

type Range = 'day' | 'week' | 'month' | 'custom';

export function InsightsScreen() {
  const [range, setRange] = useState<Range>('week');
  return (
    <Page title="Insights">
      <Segmented
        label="Review range"
        value={range}
        onChange={setRange}
        options={[
          { value: 'day', label: 'Today' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      <EmptyState
        title="Your AI coach is on the way"
        message="Reviews of your day, week and month arrive in a later update. Keep logging — your history will be ready for it."
      />
    </Page>
  );
}
