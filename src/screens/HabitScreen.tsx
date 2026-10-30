import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSettings } from '@/app/useSettings';
import { db } from '@/db/db';
import { deleteHabit, updateHabit } from '@/db/repo';
import { ActionSheet } from '@/components/ActionSheet';
import { HabitForm } from '@/components/HabitForm';
import { Page } from '@/components/Page';
import { toast } from '@/components/Toast';
import { Card, EmptyState, ListGroup, ListRow } from '@/components/ui';
import { formatDay, today } from '@/domain/dates';
import { describeSchedule } from '@/domain/schedule';
import { computeStreak } from '@/domain/streaks';
import { isCompleted } from '@/domain/today';
import { colorVar } from '@/lib/colors';

export function HabitScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const backFrom = (useLocation().state as { back?: string } | null)?.back;
  const settings = useSettings();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const data = useLiveQuery(async () => {
    const habit = await db.habits.get(id);
    if (!habit) return { habit };
    const [section, sections, entries] = await Promise.all([
      db.sections.get(habit.sectionId),
      db.sections.orderBy('order').filter((s) => !s.archived).toArray(),
      db.entries.where('habitId').equals(id).toArray(),
    ]);
    return { habit, section, sections, entries };
  }, [id]);

  if (data && !data.habit) {
    return (
      <Page title="Habit" backLabel="Back">
        <EmptyState title="Habit not found" message="It may have been deleted." />
      </Page>
    );
  }
  if (!data?.habit) return <Page title="" backLabel="Back">{null}</Page>;

  const { habit, section, sections = [], entries = [] } = data;
  const streak = computeStreak(habit, entries, today(), settings.weekStart);
  const total = entries.filter(isCompleted).length;

  const onArchive = async () => {
    await updateHabit(habit.id, { archived: !habit.archived });
    toast(habit.archived ? `${habit.name} restored` : `${habit.name} archived`, () => updateHabit(habit.id, { archived: habit.archived }));
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete “${habit.name}” and its entire history? This can’t be undone.`)) return;
    await deleteHabit(habit.id);
    navigate(-1);
  };

  const unit = streak.unit === 'day' ? 'days' : streak.unit === 'week' ? 'weeks' : 'months';

  return (
    <Page title={habit.name} backLabel={backFrom ?? section?.name ?? 'Back'} actions={<button onClick={() => setEditOpen(true)} className="h-11 px-2 text-body text-accent">Edit</button>}>
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-[30px]"
            style={{ background: `color-mix(in srgb, ${colorVar(habit.color)} 18%, transparent)` }}
            aria-hidden
          >
            {habit.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-subhead text-secondary">
              {describeSchedule(habit.schedule, settings.weekStart)}
              {habit.type !== 'check' && habit.type !== 'avoid' ? ` · ${habit.target} ${habit.unit}` : ''}
            </p>
            {habit.why && <p className="mt-0.5 text-body">{habit.why}</p>}
          </div>
        </div>
        {(habit.cue || habit.minimumVersion) && (
          <dl className="mt-4 grid gap-2 text-subhead">
            {habit.cue && (
              <div>
                <dt className="text-footnote text-secondary">Cue</dt>
                <dd>{habit.cue}</dd>
              </div>
            )}
            {habit.minimumVersion && (
              <div>
                <dt className="text-footnote text-secondary">Minimum version</dt>
                <dd>{habit.minimumVersion}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Current streak', value: streak.current, sub: unit },
          { label: 'Best streak', value: streak.best, sub: unit },
          { label: 'Completions', value: total, sub: 'total' },
        ].map((s) => (
          <Card key={s.label} className="!p-3 text-center">
            <div className="tabular text-title">{s.value}</div>
            <div className="text-caption text-secondary">{s.sub}</div>
            <div className="mt-1 text-caption font-medium">{s.label}</div>
          </Card>
        ))}
      </div>

      <ListGroup header="Actions">
        <ListRow title="Move to another section" detail={section ? `${section.emoji} ${section.name}` : ''} chevron onClick={() => setMoveOpen(true)} />
        <ListRow title={habit.archived ? 'Restore habit' : 'Archive habit'} onClick={onArchive} />
        <ListRow title="Delete habit" destructive onClick={onDelete} />
      </ListGroup>

      <p className="px-4 text-center text-footnote text-secondary">
        Started {formatDay(habit.startDate, 'd MMM yyyy')}. The tile calendar and history arrive in the next update.
      </p>

      <ActionSheet
        open={moveOpen}
        title="Move to section"
        onClose={() => setMoveOpen(false)}
        actions={sections
          .filter((s) => s.id !== habit.sectionId)
          .map((s) => ({
            label: `${s.emoji} ${s.name}`,
            onSelect: async () => {
              await updateHabit(habit.id, { sectionId: s.id });
              toast(`Moved to ${s.name}`);
            },
          }))}
      />
      <HabitForm open={editOpen} onClose={() => setEditOpen(false)} habit={habit} />
    </Page>
  );
}
