import { confirmAction } from '@/lib/confirm';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Ellipsis, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AIError, cachedReview, callAI, hashInput, saveReview } from '@/ai/client';
import { goalCheckinResult, type GoalCheckinResult } from '@/ai/schemas';
import { useOnline } from '@/app/useOnline';
import { useSettings } from '@/app/useSettings';
import { db } from '@/db/db';
import { setHabitGoalLink, updateGoal } from '@/db/repo';
import type { Goal } from '@/db/types';
import { ActionSheet } from '@/components/ActionSheet';
import { GoalForm } from '@/components/GoalForm';
import { NavButton, Page } from '@/components/Page';
import { ErrorCard, SkeletonCards } from '@/components/ReviewCards';
import { TileGrid } from '@/components/TileGrid';
import { toast } from '@/components/Toast';
import { Card, EmptyState, ListGroup, PrimaryButton } from '@/components/ui';
import { buildCheckinPayload } from '@/domain/aggregate';
import { formatDay, shiftDate, today as todayFn } from '@/domain/dates';
import { goalPace } from '@/domain/goals';
import { buildTiles } from '@/domain/score';
import { colorVar } from '@/lib/colors';
import { formatPercent } from '@/lib/format';
import { GoalStatusBadge } from './GoalsScreen';

const ADJUST_LABEL: Record<GoalCheckinResult['adjustment']['kind'], string> = {
  'lower-target': 'Lower a target',
  'add-minimum-version': 'Add a minimum version',
  'change-schedule': 'Change a schedule',
  'add-habit': 'Add a habit',
  'keep-going': 'Keep going',
  other: 'Suggestion',
};

export function GoalScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const online = useOnline();
  const today = todayFn();
  const [menu, setMenu] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [checkin, setCheckin] = useState<{ kind: 'idle' | 'loading' } | { kind: 'error'; message: string; offline: boolean }>({ kind: 'idle' });

  const data = useLiveQuery(async () => {
    const goal = await db.goals.get(id);
    if (!goal) return { goal };
    const [habits, entries, checkins] = await Promise.all([
      db.habits.toArray(),
      goal.habitIds.length ? db.entries.where('habitId').anyOf(goal.habitIds).toArray() : Promise.resolve([]),
      db.aiReviews
        .where('scope')
        .equals('goal')
        .filter((r) => r.subjectId === id)
        .sortBy('updatedAt'),
    ]);
    return { goal, habits, entries, checkins };
  }, [id]);

  const goal = data?.goal;
  const pace = useMemo(
    () => (goal && data?.habits ? goalPace(goal, data.habits, data.entries ?? [], today, settings.weekStart) : null),
    [goal, data, today, settings.weekStart],
  );

  if (data && !goal) {
    return (
      <Page title="Goal" backLabel="Goals">
        <EmptyState title="Goal not found" message="It may have been deleted." />
      </Page>
    );
  }
  if (!goal || !data?.habits || !pace)
    return (
      <Page title="" backLabel="Goals">
        {null}
      </Page>
    );

  const linked = data.habits.filter((h) => goal.habitIds.includes(h.id));
  const lastCheckin = data.checkins?.at(-1);
  const lastResult = lastCheckin ? goalCheckinResult.safeParse(lastCheckin.result) : null;
  const plan = goal.plan as { summary?: string } | undefined;

  const askCheckin = async () => {
    setCheckin({ kind: 'loading' });
    try {
      const payload = buildCheckinPayload(goal, data.habits!, data.entries ?? [], today, settings.weekStart);
      const hash = await hashInput('goalCheckin', payload);
      if (!(await cachedReview(hash))) {
        const result = await callAI('goalCheckin', payload);
        await saveReview({ scope: 'goal', rangeStart: shiftDate(today, -13), rangeEnd: today, subjectId: goal.id, inputHash: hash, result });
      } else {
        toast('Nothing changed since your last check-in');
      }
      setCheckin({ kind: 'idle' });
    } catch (e) {
      const err = e instanceof AIError ? e : new AIError('Something went wrong. Please try again.', 'failed');
      setCheckin({ kind: 'error', message: err.message, offline: err.kind === 'offline' });
    }
  };

  const setStatus = async (status: Goal['status']) => {
    await updateGoal(goal.id, { status });
    toast(status === 'achieved' ? 'Goal achieved 🎉' : status === 'abandoned' ? 'Goal set aside' : 'Goal reopened', () =>
      updateGoal(goal.id, { status: goal.status }),
    );
  };

  const onDelete = async () => {
    if (!confirmAction(`Delete the goal “${goal.title}”? Its habits stay.`)) return;
    for (const hid of goal.habitIds) await setHabitGoalLink(hid, goal.id, false);
    await db.goals.delete(goal.id);
    navigate(-1);
  };

  const updateCurrent = async (delta: number) => {
    const next = Math.round(((goal.currentValue ?? 0) + delta) * 100) / 100;
    await updateGoal(goal.id, { currentValue: next });
  };

  return (
    <Page
      title={goal.title}
      backLabel="Goals"
      actions={
        <NavButton label="Goal options" onClick={() => setMenu(true)}>
          <Ellipsis size={24} aria-hidden />
        </NavButton>
      }
    >
      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-footnote text-secondary">
            {goal.deadline
              ? `Due ${formatDay(goal.deadline, 'd MMM yyyy')}${pace.daysLeft !== null && pace.daysLeft >= 0 ? ` · ${pace.daysLeft} days left` : ' · overdue'}`
              : 'No deadline'}
          </span>
          <GoalStatusBadge status={goal.status === 'achieved' ? 'done' : pace.status} />
        </div>
        {goal.why && <p className="mt-2 text-body">{goal.why}</p>}
        <div className="mt-4 flex items-baseline gap-2">
          <span className="tabular text-[40px] font-bold leading-none text-accent">{formatPercent(pace.progress)}</span>
          <span className="text-subhead text-secondary">
            {goal.targetValue !== null ? `${goal.currentValue ?? 0} of ${goal.targetValue} ${goal.metric}` : 'of milestones done'}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--fill)/0.2)]" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pace.progress * 100}%` }} />
        </div>
        {pace.timeElapsed !== null && <p className="mt-1.5 text-caption text-secondary">{formatPercent(pace.timeElapsed)} of the time has passed</p>}
        {goal.targetValue !== null && (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1 text-subhead">Update progress</span>
            {[-1, 1].map((d) => (
              <button
                key={d}
                onClick={() => updateCurrent(d * stepFor(goal.targetValue!))}
                className="h-9 min-w-[56px] rounded-full bg-[rgb(var(--fill)/0.12)] px-3 text-subhead font-semibold text-accent"
                aria-label={`${d > 0 ? 'Add' : 'Subtract'} ${stepFor(goal.targetValue!)}`}
              >
                {d > 0 ? '+' : '−'}
                {stepFor(goal.targetValue!)}
              </button>
            ))}
          </div>
        )}
      </Card>

      {goal.milestones.length > 0 && (
        <ListGroup header="Milestones">
          {goal.milestones.map((m) => (
            <button
              key={m.id}
              role="checkbox"
              aria-checked={m.done}
              onClick={() => updateGoal(goal.id, { milestones: goal.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })}
              className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${m.done ? 'border-success bg-success' : 'border-[rgb(var(--fill)/0.5)]'}`}
              >
                {m.done && <Check size={14} strokeWidth={3} className="text-white" aria-hidden />}
              </span>
              <span className={`text-body ${m.done ? 'text-secondary line-through' : ''}`}>{m.title}</span>
            </button>
          ))}
        </ListGroup>
      )}

      <section className="mb-8">
        <h2 className="mb-1.5 px-4 text-footnote uppercase text-secondary">
          Linked habits {pace.habitPace !== null && `· ${formatPercent(pace.habitPace)} last 2 weeks`}
        </h2>
        {linked.length === 0 ? (
          <Card>
            <p className="text-subhead text-secondary">No habits linked yet. Edit the goal, or open a habit and link it from its Goals row.</p>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-row bg-bg-2 shadow-card [&>*+*]:border-t [&>*+*]:border-[rgb(var(--separator)/0.29)]">
            {linked.map((h) => (
              <button
                key={h.id}
                onClick={() => navigate(`/habits/${h.id}`, { state: { back: 'Goal' } })}
                className="block w-full px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-body">
                  <span aria-hidden>{h.emoji}</span> {h.name}
                </span>
                <span className="mt-2 block">
                  <TileGrid
                    color={colorVar(h.color)}
                    tiles={buildTiles(
                      h,
                      (data.entries ?? []).filter((e) => e.habitId === h.id),
                      shiftDate(today, -370),
                      today,
                    )}
                    start={shiftDate(today, -370)}
                    today={today}
                    weekStart={settings.weekStart}
                    size="compact"
                    label={`${h.name}, recent weeks`}
                  />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-1.5 px-4 text-footnote uppercase text-secondary">Coach</h2>
        {checkin.kind === 'loading' ? (
          <SkeletonCards />
        ) : (
          <>
            {checkin.kind === 'error' && (
              <div className="mb-3">
                <ErrorCard message={checkin.message} offline={checkin.offline} onRetry={askCheckin} />
              </div>
            )}
            {lastResult?.success && (
              <Card className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-footnote text-secondary">Check-in · {formatDay(lastCheckin!.updatedAt.slice(0, 10), 'd MMM')}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-caption font-semibold ${lastResult.data.status === 'behind' ? 'bg-danger/15 text-danger-text' : 'bg-success/15 text-success-text'}`}
                  >
                    {lastResult.data.status === 'behind' ? 'Behind' : lastResult.data.status === 'ahead' ? 'Ahead' : 'On track'}
                  </span>
                </div>
                <p className="text-body">{lastResult.data.reasoning}</p>
                <div className="mt-3 rounded-[12px] bg-[rgb(var(--fill)/0.1)] p-3">
                  <div className="text-footnote font-semibold text-accent">{ADJUST_LABEL[lastResult.data.adjustment.kind]}</div>
                  <div className="text-subhead">{lastResult.data.adjustment.description}</div>
                </div>
              </Card>
            )}
            <div className="flex justify-center">
              <button
                onClick={askCheckin}
                disabled={!online}
                className="flex h-11 items-center gap-2 rounded-full px-5 text-headline text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, var(--c-indigo), var(--c-purple))' }}
              >
                <Sparkles size={18} aria-hidden /> Am I on track?
              </button>
            </div>
            {!online && <p className="mt-2 text-center text-footnote text-secondary">You’re offline — check-ins need a connection.</p>}
          </>
        )}
      </section>

      {plan?.summary && (
        <Card className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-headline">
            <Sparkles size={16} className="text-[var(--c-purple)]" aria-hidden /> The plan
          </h3>
          <p className="text-subhead text-secondary">{plan.summary}</p>
        </Card>
      )}

      {goal.status !== 'active' && (
        <div className="mb-8 flex justify-center">
          <PrimaryButton onClick={() => setStatus('active')}>Reopen goal</PrimaryButton>
        </div>
      )}

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={goal.title}
        actions={[
          { label: 'Edit goal', onSelect: () => setEditOpen(true) },
          ...(goal.status === 'active'
            ? [
                { label: 'Mark as achieved 🎉', onSelect: () => setStatus('achieved') },
                { label: 'Set aside', onSelect: () => setStatus('abandoned') },
              ]
            : []),
          { label: 'Delete goal', destructive: true, onSelect: onDelete },
        ]}
      />
      <GoalForm open={editOpen} onClose={() => setEditOpen(false)} goal={goal} />
    </Page>
  );
}

function stepFor(target: number): number {
  if (target >= 1000) return 50;
  if (target >= 100) return 2.5;
  if (target >= 20) return 1;
  return target >= 5 ? 0.5 : 0.1;
}
