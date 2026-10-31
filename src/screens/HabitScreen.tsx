import { confirmAction } from '@/lib/confirm';
import { useLiveQuery } from 'dexie-react-hooks';
import { Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useFreezesLeft } from '@/app/useFreezes';
import { setHabitValue, tapHabit } from '@/app/logActions';
import { useSettings } from '@/app/useSettings';
import { db } from '@/db/db';
import { deleteHabit, setHabitGoalLink, updateHabit } from '@/db/repo';
import type { Entry, LocalDate } from '@/db/types';
import { ActionSheet } from '@/components/ActionSheet';
import { AmountSheet } from '@/components/AmountSheet';
import { DaySheet } from '@/components/DaySheet';
import { HabitForm } from '@/components/HabitForm';
import { MonthCalendar } from '@/components/MonthCalendar';
import { NavButton, Page } from '@/components/Page';
import { ShareCardSheet } from '@/components/ShareCardSheet';
import { TileGrid } from '@/components/TileGrid';
import { toast } from '@/components/Toast';
import { Card, EmptyState, ListGroup, ListRow, Segmented } from '@/components/ui';
import { formatDay, shiftDate, today as todayFn } from '@/domain/dates';
import { isQuantity } from '@/domain/logging';
import { describeSchedule } from '@/domain/schedule';
import { buildTiles, consistencyWindow, quantityStats } from '@/domain/score';
import { computeStreak } from '@/domain/streaks';
import { isCompleted } from '@/domain/today';
import { colorVar } from '@/lib/colors';
import { formatNumber, formatPercent } from '@/lib/format';

type Window = '30' | '90' | 'all';

export function HabitScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const backFrom = (useLocation().state as { back?: string } | null)?.back;
  const settings = useSettings();
  const today = todayFn();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [view, setView] = useState<'year' | 'month'>('year');
  const [win, setWin] = useState<Window>('30');
  const [dayFor, setDayFor] = useState<LocalDate | null>(null);
  const [amountFor, setAmountFor] = useState<LocalDate | null>(null);
  const [historyLimit, setHistoryLimit] = useState(20);
  const freezes = useFreezesLeft(dayFor);

  const data = useLiveQuery(async () => {
    const habit = await db.habits.get(id);
    if (!habit) return { habit };
    const [section, sections, entries, goals] = await Promise.all([
      db.sections.get(habit.sectionId),
      db.sections
        .orderBy('order')
        .filter((s) => !s.archived)
        .toArray(),
      db.entries.where('habitId').equals(id).toArray(),
      db.goals.where('status').equals('active').toArray(),
    ]);
    return { habit, section, sections, entries, goals };
  }, [id]);

  const habit = data?.habit;
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const gridStart = habit ? (habit.startDate < shiftDate(today, -181) ? habit.startDate : shiftDate(today, -181)) : today;
  const tiles = useMemo(() => (habit ? buildTiles(habit, entries, gridStart, today) : new Map()), [habit, entries, gridStart, today]);

  if (data && !habit) {
    return (
      <Page title="Habit" backLabel="Back">
        <EmptyState title="Habit not found" message="It may have been deleted." />
      </Page>
    );
  }
  if (!data || !habit)
    return (
      <Page title="" backLabel={backFrom ?? 'Back'}>
        {null}
      </Page>
    );

  const { section, sections = [], goals = [] } = data;
  const color = colorVar(habit.color);
  const streak = computeStreak(habit, entries, today, settings.weekStart);
  const total = entries.filter(isCompleted).length;
  const cons = consistencyWindow(habit, entries, today, settings.weekStart, win === 'all' ? null : Number(win));
  const qty = isQuantity(habit.type) ? quantityStats(entries, today) : null;
  const unit = streak.unit === 'day' ? 'days' : streak.unit === 'week' ? 'weeks' : 'months';
  const history = entries.filter((e) => e.status !== 'missed' || e.note || e.freeze).sort((a, b) => (a.date < b.date ? 1 : -1));
  const exerciseNames = [...new Set(entries.flatMap((e) => e.workout?.map((w) => w.name) ?? []))];
  const linkedGoals = goals.filter((g) => habit.goalIds.includes(g.id));

  const onTapDay = (d: LocalDate) => {
    if (isQuantity(habit.type)) setAmountFor(d);
    else void tapHabit(habit, d);
  };

  const onArchive = async () => {
    await updateHabit(habit.id, { archived: !habit.archived });
    toast(habit.archived ? `${habit.name} restored` : `${habit.name} archived`, () => updateHabit(habit.id, { archived: habit.archived }));
  };

  const onDelete = async () => {
    if (!confirmAction(`Delete “${habit.name}” and its entire history? This can’t be undone.`)) return;
    await deleteHabit(habit.id);
    navigate(-1);
  };

  return (
    <Page
      title={habit.name}
      backLabel={backFrom ?? section?.name ?? 'Back'}
      actions={
        <>
          <NavButton label="Share progress" onClick={() => setShareOpen(true)}>
            <Share2 size={21} aria-hidden />
          </NavButton>
          <button onClick={() => setEditOpen(true)} className="h-11 px-2 text-body text-accent">
            Edit
          </button>
        </>
      }
    >
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-[30px]"
            style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
            aria-hidden
          >
            {habit.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-subhead text-secondary">
              {describeSchedule(habit.schedule, settings.weekStart)}
              {isQuantity(habit.type) ? ` · ${habit.target} ${habit.unit}` : habit.type === 'avoid' ? ' · Avoid' : ''}
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

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-headline">Calendar</h2>
          <div className="w-40">
            <Segmented
              label="Calendar view"
              value={view}
              onChange={setView}
              options={[
                { value: 'year', label: 'Year' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </div>
        </div>
        {view === 'year' ? (
          <TileGrid
            color={color}
            tiles={tiles}
            start={gridStart}
            today={today}
            weekStart={settings.weekStart}
            label={`${habit.name} calendar`}
            onTap={onTapDay}
            onLongPress={setDayFor}
          />
        ) : (
          <MonthCalendar
            color={color}
            tiles={tiles}
            start={gridStart}
            today={today}
            weekStart={settings.weekStart}
            onTap={onTapDay}
            onLongPress={setDayFor}
          />
        )}
        <p className="mt-3 text-caption text-secondary">
          Tap a day to log it. Hold a day for details, notes{section?.kind === 'gym' ? ', workouts' : ''} and streak freezes.
        </p>
        <Legend color={color} />
      </Card>

      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat value={streak.current} sub={unit} label="Current streak" />
        <Stat value={streak.best} sub={unit} label="Best streak" />
        <Stat value={total} sub="total" label="Completions" />
      </div>

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-headline">Consistency</h2>
          <div className="w-44">
            <Segmented
              label="Consistency window"
              value={win}
              onChange={setWin}
              options={[
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="tabular text-[40px] font-bold leading-none">{cons.score === null ? '—' : formatPercent(cons.score)}</span>
          <span className="text-subhead text-secondary">
            {cons.expected > 0 ? `${formatNumber(cons.earned)} of ${formatNumber(cons.expected)} expected` : 'Nothing expected yet'}
          </span>
        </div>
        {qty && (
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[rgb(var(--separator)/0.29)] pt-3 text-center">
            <MiniStat label="Total" value={`${formatNumber(qty.total)} ${habit.unit}`} />
            <MiniStat label="Average" value={`${formatNumber(qty.average)} ${habit.unit}`} />
            <MiniStat label="Trend (30d)" value={qty.trend === null ? '—' : `${qty.trend >= 0 ? '↑' : '↓'} ${formatPercent(Math.abs(qty.trend))}`} />
          </div>
        )}
      </Card>

      <ListGroup header="History" footer={history.length === 0 ? 'Logged days will appear here.' : undefined}>
        {history.slice(0, historyLimit).map((e) => (
          <HistoryRow key={e.id} entry={e} unit={habit.unit} quantity={isQuantity(habit.type)} color={color} onClick={() => setDayFor(e.date)} />
        ))}
        {history.length > historyLimit && (
          <ListRow title={<span className="text-accent">Show more</span>} onClick={() => setHistoryLimit((n) => n + 40)} />
        )}
      </ListGroup>

      <ListGroup header="Actions">
        <ListRow
          title="Goals"
          detail={linkedGoals.length ? linkedGoals.map((g) => g.title).join(', ') : 'None'}
          chevron
          onClick={() => setGoalOpen(true)}
        />
        <ListRow
          title="Move to another section"
          detail={section ? `${section.emoji} ${section.name}` : ''}
          chevron
          onClick={() => setMoveOpen(true)}
        />
        <ListRow title={habit.archived ? 'Restore habit' : 'Archive habit'} onClick={onArchive} />
        <ListRow title="Delete habit" destructive onClick={onDelete} />
      </ListGroup>

      <p className="px-4 text-center text-footnote text-secondary">Started {formatDay(habit.startDate, 'd MMM yyyy')}</p>

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
      <ActionSheet
        open={goalOpen}
        title={goals.length ? 'Link to a goal' : 'No active goals yet — create one in the Goals tab.'}
        onClose={() => setGoalOpen(false)}
        actions={goals.map((g) => {
          const linked = habit.goalIds.includes(g.id);
          return { label: `${linked ? '✓ ' : ''}${g.title}`, onSelect: () => setHabitGoalLink(habit.id, g.id, !linked) };
        })}
      />
      <HabitForm open={editOpen} onClose={() => setEditOpen(false)} habit={habit} />
      <AmountSheet
        habit={amountFor ? habit : null}
        entry={entries.find((e) => e.date === amountFor)}
        onClose={() => setAmountFor(null)}
        onSave={(v) => amountFor && setHabitValue(habit, amountFor, v)}
      />
      <DaySheet
        habit={habit}
        date={dayFor}
        entry={entries.find((e) => e.date === dayFor)}
        today={today}
        freezesLeft={freezes}
        isGym={section?.kind === 'gym'}
        exerciseNames={exerciseNames}
        onClose={() => setDayFor(null)}
      />
      <ShareCardSheet open={shareOpen} onClose={() => setShareOpen(false)} subject={{ kind: 'habit', habit, entries }} />
    </Page>
  );
}

function Stat({ value, sub, label }: { value: number; sub: string; label: string }) {
  return (
    <Card className="!p-3 text-center">
      <div className="tabular text-title">{value}</div>
      <div className="text-caption text-secondary">{sub}</div>
      <div className="mt-1 text-caption font-medium">{label}</div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tabular text-headline">{value}</div>
      <div className="text-caption text-secondary">{label}</div>
    </div>
  );
}

const STATUS: Record<Entry['status'], string> = {
  done: 'Done',
  partial: 'Partly done',
  minimum: 'Minimum version',
  skipped: 'Skipped',
  missed: 'Not done',
};

function HistoryRow({
  entry,
  unit,
  quantity,
  color,
  onClick,
}: {
  entry: Entry;
  unit: string;
  quantity: boolean;
  color: string;
  onClick: () => void;
}) {
  const workout = entry.workout?.filter((w) => w.sets.length);
  return (
    <button onClick={onClick} className="flex w-full gap-3 px-4 py-2.5 text-left active:bg-[rgb(var(--fill)/0.16)]">
      <span className="tabular w-14 shrink-0 pt-0.5 text-footnote text-secondary">{formatDay(entry.date, 'd MMM')}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-body">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: entry.status === 'done' || entry.status === 'minimum' ? color : 'rgb(var(--fill) / 0.3)' }}
            aria-hidden
          />
          {entry.freeze ? '🧊 Streak freeze' : STATUS[entry.status]}
          {quantity && entry.value > 0 && entry.status !== 'skipped' ? ` · ${entry.value} ${unit}` : ''}
        </span>
        {entry.note && <span className="block text-subhead text-secondary">“{entry.note}”</span>}
        {workout && workout.length > 0 && (
          <span className="block text-footnote text-secondary">
            {workout.map((w) => `${w.name} ${w.sets.length}×${w.sets[0]!.reps} @ ${w.sets[0]!.weight} kg`).join(' · ')}
          </span>
        )}
      </span>
    </button>
  );
}

function Legend({ color }: { color: string }) {
  const item = (swatch: React.ReactNode, text: string) => (
    <span className="flex items-center gap-1.5">
      {swatch}
      {text}
    </span>
  );
  const box = 'inline-block h-3 w-3 rounded-[3px]';
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-caption text-secondary" aria-hidden>
      {item(<span className={box} style={{ background: color }} />, 'Done')}
      {item(<span className={box} style={{ background: color, opacity: 0.45 }} />, 'Partial')}
      {item(
        <span className={`${box} relative`} style={{ background: `color-mix(in srgb, ${color} 50%, transparent)` }}>
          <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color }} />
        </span>,
        'Minimum',
      )}
      {item(
        <span
          className={box}
          style={{
            background: 'rgb(var(--fill)/0.22)',
            backgroundImage: 'linear-gradient(135deg, transparent 45%, rgb(var(--fill)/0.8) 45%, rgb(var(--fill)/0.8) 55%, transparent 55%)',
          }}
        />,
        'Skipped',
      )}
      {item(<span className={box} style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--fill)/0.4)' }} />, 'Missed')}
    </div>
  );
}
