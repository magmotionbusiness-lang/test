import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Page } from '@/components/Page';
import { Card, EmptyState } from '@/components/ui';
import { formatDay } from '@/domain/dates';

export function GoalsScreen() {
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), []);

  return (
    <Page title="Goals">
      {goals && goals.length === 0 && (
        <EmptyState title="No goals yet" message="Soon you'll describe a goal and the AI coach will turn it into a few small habits." />
      )}
      <div className="grid gap-3">
        {goals?.map((g) => {
          const pct = g.targetValue && g.currentValue != null ? Math.min(1, g.currentValue / g.targetValue) : 0;
          return (
            <Card key={g.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate text-headline">{g.title}</h2>
                {g.deadline && <span className="shrink-0 text-footnote text-secondary">by {formatDay(g.deadline, 'd MMM yyyy')}</span>}
              </div>
              <p className="mt-0.5 text-footnote text-secondary">{g.metric}</p>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--fill)/0.2)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct * 100)}
                aria-label={`${g.title} progress`}
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
              </div>
              <p className="tabular mt-1.5 text-caption text-secondary">
                {g.currentValue ?? 0} of {g.targetValue ?? '—'}
              </p>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
