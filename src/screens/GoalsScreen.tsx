import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '@/app/useSettings';
import { db } from '@/db/db';
import type { Goal, Habit } from '@/db/types';
import { GoalForm } from '@/components/GoalForm';
import { GoalPlanner } from '@/components/GoalPlanner';
import { NavButton, Page } from '@/components/Page';
import { Card, EmptyState, ListGroup, ListRow, PrimaryButton } from '@/components/ui';
import { formatDay, shiftDate, today as todayFn } from '@/domain/dates';
import { goalPace, type GoalPace } from '@/domain/goals';
import { formatPercent } from '@/lib/format';

export function GoalsScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const today = todayFn();
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const location = useLocation();

  // Onboarding's "Start from a goal with AI" lands here with the planner open.
  useEffect(() => {
    if ((location.state as { newGoal?: boolean } | null)?.newGoal) setPlannerOpen(true);
  }, [location.state]);

  const data = useLiveQuery(async () => {
    const [goals, habits, entries] = await Promise.all([
      db.goals.toArray(),
      db.habits.toArray(),
      db.entries.where('date').between(shiftDate(today, -30), today, true, true).toArray(),
    ]);
    return { goals, habits, entries };
  }, [today]);

  const active = data?.goals.filter((g) => g.status === 'active').sort((a, b) => ((a.deadline ?? '9') < (b.deadline ?? '9') ? -1 : 1)) ?? [];
  const finished = data?.goals.filter((g) => g.status !== 'active') ?? [];
  const open = (id: string) => navigate(`/goals/${id}`);

  return (
    <Page
      title="Goals"
      actions={
        <NavButton label="New goal" onClick={() => setPlannerOpen(true)}>
          <Plus size={26} aria-hidden />
        </NavButton>
      }
    >
      {data && data.goals.length === 0 && (
        <EmptyState
          title="No goals yet"
          message="Describe something you want to achieve. Your AI coach turns it into a few small habits."
          action={<PrimaryButton onClick={() => setPlannerOpen(true)}>Set your first goal</PrimaryButton>}
        />
      )}

      <div className="grid gap-3">
        {data &&
          active.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              habits={data.habits}
              pace={goalPace(g, data.habits, data.entries, today, settings.weekStart)}
              onClick={() => open(g.id)}
            />
          ))}
      </div>

      {finished.length > 0 && (
        <div className="mt-8">
          <ListGroup header="Finished">
            {finished.map((g) => (
              <ListRow
                key={g.id}
                title={g.title}
                subtitle={g.status === 'achieved' ? 'Achieved 🎉' : 'Set aside'}
                chevron
                onClick={() => open(g.id)}
              />
            ))}
          </ListGroup>
        </div>
      )}

      <GoalPlanner
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        onManual={() => {
          setPlannerOpen(false);
          setManualOpen(true);
        }}
        onCreated={open}
      />
      <GoalForm open={manualOpen} onClose={() => setManualOpen(false)} onCreated={open} />
    </Page>
  );
}

export function GoalStatusBadge({ status }: { status: GoalPace['status'] }) {
  const cls = status === 'behind' ? 'bg-danger/15 text-danger-text' : 'bg-success/15 text-success-text';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${cls}`}>
      {status === 'behind' ? 'Behind' : status === 'done' ? 'Done' : 'On track'}
    </span>
  );
}

function GoalCard({ goal, habits, pace, onClick }: { goal: Goal; habits: Habit[]; pace: GoalPace; onClick: () => void }) {
  const linked = habits.filter((h) => goal.habitIds.includes(h.id));
  return (
    <button
      onClick={onClick}
      className="text-left"
      aria-label={`${goal.title}, ${formatPercent(pace.progress)} done, ${pace.status === 'behind' ? 'behind' : 'on track'}`}
    >
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-headline">{goal.title}</h2>
          <div className="flex items-center gap-1">
            <GoalStatusBadge status={pace.status} />
            <ChevronRight size={18} className="text-tertiary" aria-hidden />
          </div>
        </div>
        <p className="mt-0.5 text-footnote text-secondary">
          {goal.deadline
            ? `Due ${formatDay(goal.deadline, 'd MMM yyyy')}${pace.daysLeft !== null && pace.daysLeft >= 0 ? ` · ${pace.daysLeft} days left` : ''}`
            : 'No deadline'}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--fill)/0.2)]" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${pace.progress * 100}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-caption text-secondary">
          <span className="tabular">
            {goal.targetValue !== null
              ? `${goal.currentValue ?? 0} of ${goal.targetValue}${goal.metric ? ` · ${goal.metric}` : ''}`
              : `${goal.milestones.filter((m) => m.done).length} of ${goal.milestones.length} milestones`}
          </span>
          {linked.length > 0 && (
            <span className="truncate">
              {linked.map((h) => h.emoji).join(' ')} {pace.habitPace !== null ? formatPercent(pace.habitPace) : ''}
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}
