import { confirmAction } from '@/lib/confirm';
import { useLiveQuery } from 'dexie-react-hooks';
import { Ellipsis, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSettings } from '@/app/useSettings';
import { db } from '@/db/db';
import { deleteSection, reorder, updateHabit, updateSection } from '@/db/repo';
import type { Entry, Habit } from '@/db/types';
import { ActionSheet } from '@/components/ActionSheet';
import { AmountSheet } from '@/components/AmountSheet';
import { DoneButton } from '@/components/DoneButton';
import { setHabitValue } from '@/app/logActions';
import { BarChart, LineChart } from '@/components/charts';
import { HabitForm } from '@/components/HabitForm';
import { NavButton, Page } from '@/components/Page';
import { ReorderList } from '@/components/ReorderList';
import { SectionForm } from '@/components/SectionForm';
import { ShareCardSheet } from '@/components/ShareCardSheet';
import { TileGrid } from '@/components/TileGrid';
import { toast } from '@/components/Toast';
import { Card, EmptyState, ListGroup, ListRow, PrimaryButton } from '@/components/ui';
import { dailyShare } from '@/domain/aggregate';
import {
  groupConsistency,
  groupWeekdayRates,
  personalRecords,
  streakLeaders,
  rollingWeek,
  weeklyConsistency,
  weeklyVolume,
  workoutSessions,
} from '@/domain/analytics';
import { formatDay, shiftDate, today as todayFn } from '@/domain/dates';
import { describeSchedule } from '@/domain/schedule';
import { buildTiles } from '@/domain/score';
import { isCompleted } from '@/domain/today';
import { colorVar } from '@/lib/colors';
import { formatNumber, formatPercent } from '@/lib/format';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SectionScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const today = todayFn();
  const [menu, setMenu] = useState(false);
  const [editSection, setEditSection] = useState(false);
  const [habitForm, setHabitForm] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [amountFor, setAmountFor] = useState<Habit | null>(null);

  const data = useLiveQuery(async () => {
    const section = await db.sections.get(id);
    const habits = await db.habits.where('sectionId').equals(id).sortBy('order');
    const entries = habits.length
      ? await db.entries
          .where('habitId')
          .anyOf(habits.map((h) => h.id))
          .toArray()
      : [];
    return { section, habits, entries };
  }, [id]);

  const active = useMemo(() => data?.habits.filter((h) => !h.archived) ?? [], [data]);
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const stats = useMemo(
    () => (data ? computeStats(active, entries, today, settings.weekStart) : null),
    [data, active, entries, today, settings.weekStart],
  );

  if (data && !data.section) {
    return (
      <Page title="Section" backLabel="Sections">
        <EmptyState title="Section not found" message="It may have been deleted." />
      </Page>
    );
  }

  const section = data?.section;
  const archived = data?.habits.filter((h) => h.archived) ?? [];
  const color = section ? colorVar(section.color) : 'rgb(var(--accent))';
  const pct = (v: number) => formatPercent(v);

  const onArchive = async () => {
    if (!section) return;
    await updateSection(section.id, { archived: true });
    navigate(-1);
    toast(`${section.name} archived`, () => updateSection(section.id, { archived: false }));
  };

  const onDelete = async () => {
    if (!section) return;
    if (!confirmAction(`Delete “${section.name}” and all ${data?.habits.length ?? 0} of its habits, including their history? This can’t be undone.`))
      return;
    await deleteSection(section.id);
    navigate(-1);
  };

  return (
    <Page
      title={section ? `${section.emoji} ${section.name}` : ''}
      subtitle={section?.description}
      backLabel="Sections"
      actions={
        <>
          <NavButton label="New habit in this section" onClick={() => setHabitForm(true)}>
            <Plus size={26} aria-hidden />
          </NavButton>
          <NavButton label="Section options" onClick={() => setMenu(true)}>
            <Ellipsis size={24} aria-hidden />
          </NavButton>
        </>
      }
    >
      {data && active.length === 0 && (
        <EmptyState
          title="No habits here yet"
          message="Add the first habit to this section."
          action={<PrimaryButton onClick={() => setHabitForm(true)}>Add a habit</PrimaryButton>}
        />
      )}

      {stats && active.length > 0 && (
        <Card className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-footnote text-secondary">Last 7 days</div>
              <div className="tabular text-[34px] font-bold leading-tight">{stats.week.thisWeek === null ? '—' : pct(stats.week.thisWeek)}</div>
            </div>
            <WeekDelta thisWeek={stats.week.thisWeek} lastWeek={stats.week.lastWeek} />
          </div>
          <TileGrid
            color={color}
            tiles={stats.grid}
            start={shiftDate(today, -181)}
            today={today}
            weekStart={settings.weekStart}
            mode="intensity"
            label={`${section?.name} daily completion`}
          />
        </Card>
      )}

      {active.length > 0 && (
        <section className="mb-8">
          <div className="mb-1.5 flex items-end justify-between px-4">
            <h2 className="text-footnote uppercase text-secondary">Habits</h2>
            {active.length > 1 && (
              <button onClick={() => setReordering((r) => !r)} className="-my-2 h-9 text-footnote font-medium text-accent">
                {reordering ? 'Done' : 'Reorder'}
              </button>
            )}
          </div>
          <ReorderList
            items={active}
            editing={reordering}
            onReorder={(ids) => reorder('habits', ids)}
            className="overflow-hidden rounded-row bg-bg-2 shadow-card [&>*+*]:border-t [&>*+*]:border-[rgb(var(--separator)/0.29)]"
            itemClassName="bg-bg-2"
            render={(h) => (
              <HabitRowCompact
                habit={h}
                entries={entries}
                today={today}
                weekStart={settings.weekStart}
                reordering={reordering}
                onOpen={() => navigate(`/habits/${h.id}`, { state: { back: section?.name } })}
                onAmount={setAmountFor}
              />
            )}
          />
        </section>
      )}

      {stats && active.length > 0 && (
        <>
          <h2 className="mb-1.5 px-4 text-footnote uppercase text-secondary">Analytics</h2>
          <Card className="mb-3">
            <h3 className="text-headline">Consistency over time</h3>
            <p className="mb-2 text-footnote text-secondary">Weekly, last 26 weeks</p>
            <LineChart title="Weekly consistency" data={stats.weekly} color={color} format={pct} max={1} />
          </Card>
          <Card className="mb-3">
            <h3 className="text-headline">Best and worst weekdays</h3>
            <p className="mb-2 text-footnote text-secondary">Completion rate, last 90 days</p>
            <BarChart title="Completion by weekday" data={stats.weekdays} color={color} format={pct} max={1} />
          </Card>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Card className="!p-3">
              <div className="tabular text-title">{formatNumber(stats.total)}</div>
              <div className="text-caption text-secondary">Total completions</div>
            </Card>
            <Card className="!p-3">
              <div className="tabular text-title">{stats.last30 === null ? '—' : pct(stats.last30)}</div>
              <div className="text-caption text-secondary">Consistency, 30 days</div>
            </Card>
          </div>
          <ListGroup header="Longest streaks">
            {stats.leaders.slice(0, 3).map(({ habit, streak }) => (
              <ListRow
                key={habit.id}
                icon={<span className="text-[22px]">{habit.emoji}</span>}
                title={habit.name}
                subtitle={`Best ${streak.best} ${streak.unit}s`}
                detail={<span className="tabular">🔥 {streak.current}</span>}
              />
            ))}
          </ListGroup>
          <div className="mb-8 flex justify-center">
            <button
              onClick={() => navigate('/insights', { state: { sectionId: id } })}
              className="flex h-11 items-center gap-2 rounded-full px-5 text-headline text-white"
              style={{ background: 'linear-gradient(135deg, var(--c-indigo), var(--c-purple))' }}
            >
              <Sparkles size={18} aria-hidden /> Review this section with AI
            </button>
          </div>
        </>
      )}

      {section?.kind === 'gym' && stats && <GymExtras entries={entries} color={color} today={today} weekStart={settings.weekStart} habits={active} />}

      {archived.length > 0 && (
        <ListGroup header="Archived">
          {archived.map((h) => (
            <ListRow
              key={h.id}
              icon={<span className="text-[22px] opacity-50">{h.emoji}</span>}
              title={<span className="text-secondary">{h.name}</span>}
              detail={<span className="text-accent">Restore</span>}
              onClick={() => updateHabit(h.id, { archived: false })}
            />
          ))}
        </ListGroup>
      )}

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={section?.name}
        actions={[
          { label: 'Share progress', onSelect: () => setShareOpen(true) },
          { label: 'Edit section', onSelect: () => setEditSection(true) },
          { label: 'Archive section', onSelect: onArchive },
          { label: 'Delete section', destructive: true, onSelect: onDelete },
        ]}
      />
      <SectionForm open={editSection} onClose={() => setEditSection(false)} section={section} />
      <HabitForm open={habitForm} onClose={() => setHabitForm(false)} sectionId={id} />
      <AmountSheet
        habit={amountFor}
        entry={amountFor ? entries.find((e) => e.habitId === amountFor.id && e.date === today) : undefined}
        onClose={() => setAmountFor(null)}
        onSave={(v) => amountFor && setHabitValue(amountFor, today, v)}
      />
      {section && (
        <ShareCardSheet open={shareOpen} onClose={() => setShareOpen(false)} subject={{ kind: 'section', section, habits: active, entries }} />
      )}
    </Page>
  );
}

function computeStats(habits: Habit[], entries: Entry[], today: string, weekStart: 0 | 1) {
  const from90 = shiftDate(today, -89);
  const wd = groupWeekdayRates(habits, entries, from90, today, today);
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  const ids = new Set(habits.map((h) => h.id));
  const own = entries.filter((e) => ids.has(e.habitId));
  const weekly = weeklyConsistency(habits, own, 26, today, weekStart);
  return {
    grid: dailyShare(habits, own, shiftDate(today, -181), today, weekStart),
    week: rollingWeek(habits, own, today, weekStart),
    weekly: weekly.map((w) => ({ label: `Week of ${formatDay(w.weekStart, 'd MMM')}`, tick: formatDay(w.weekStart, 'MMM'), value: w.score })),
    weekdays: order.map((d) => ({ label: WEEKDAY[d]!, tick: WEEKDAY[d]!.slice(0, 2), value: wd[d] ?? null })),
    total: own.filter(isCompleted).length,
    last30: groupConsistency(habits, own, shiftDate(today, -29), today, today, weekStart),
    leaders: streakLeaders(habits, own, today, weekStart).sort((a, b) => b.streak.best - a.streak.best),
  };
}

function WeekDelta({ thisWeek, lastWeek }: { thisWeek: number | null; lastWeek: number | null }) {
  if (thisWeek === null || lastWeek === null) return null;
  const d = Math.round((thisWeek - lastWeek) * 100);
  const up = d >= 0;
  return (
    <div className="text-right">
      <div className={`tabular text-headline ${up ? 'text-success-text' : 'text-danger-text'}`}>
        {up ? '▲' : '▼'} {Math.abs(d)} pts
      </div>
      <div className="text-footnote text-secondary">vs the 7 days before ({formatPercent(lastWeek)})</div>
    </div>
  );
}

function HabitRowCompact({
  habit,
  entries,
  today,
  weekStart,
  reordering,
  onOpen,
  onAmount,
}: {
  habit: Habit;
  entries: Entry[];
  today: string;
  weekStart: 0 | 1;
  reordering: boolean;
  onOpen: () => void;
  onAmount: (h: Habit) => void;
}) {
  // 26 weeks requested; the grid shows as many whole weeks as fit the row.
  const start = shiftDate(today, -181);
  const tiles = useMemo(
    () =>
      buildTiles(
        habit,
        entries.filter((e) => e.habitId === habit.id),
        start,
        today,
      ),
    [habit, entries, start, today],
  );
  const settingsLabel = describeSchedule(habit.schedule, weekStart);
  const todayEntry = entries.find((e) => e.habitId === habit.id && e.date === today);
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => !reordering && onOpen()}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Open ${habit.name}`}
        >
          <span className="text-[22px] leading-none" aria-hidden>
            {habit.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body">{habit.name}</span>
            <span className="block truncate text-footnote text-secondary">
              {settingsLabel}
              {habit.type !== 'check' && habit.type !== 'avoid' ? ` · ${habit.target} ${habit.unit}` : habit.type === 'avoid' ? ' · Avoid' : ''}
            </span>
          </span>
        </button>
        {!reordering && <DoneButton habit={habit} entry={todayEntry} date={today} onAmount={() => onAmount(habit)} />}
      </div>
      {!reordering && (
        <button onClick={onOpen} className="mt-3 block w-full" aria-label={`${habit.name} calendar, open habit`}>
          <TileGrid
            color={colorVar(habit.color)}
            tiles={tiles}
            start={start}
            today={today}
            weekStart={weekStart}
            size="compact"
            label={`${habit.name}, last 12 weeks`}
          />
        </button>
      )}
    </div>
  );
}

function GymExtras({
  entries,
  habits,
  color,
  today,
  weekStart,
}: {
  entries: Entry[];
  habits: Habit[];
  color: string;
  today: string;
  weekStart: 0 | 1;
}) {
  const navigate = useNavigate();
  const sessions = useMemo(() => workoutSessions(entries), [entries]);
  const volume = useMemo(() => weeklyVolume(entries, 12, today, weekStart), [entries, today, weekStart]);
  const prs = useMemo(() => personalRecords(entries), [entries]);
  const names = new Map(habits.map((h) => [h.id, h]));
  const kg = (v: number) => (v >= 1000 ? `${formatNumber(v / 1000)}t` : `${formatNumber(v)}`);

  if (sessions.length === 0) {
    return (
      <Card className="mb-8">
        <h3 className="text-headline">🏋️ Workouts</h3>
        <p className="mt-1 text-subhead text-secondary">
          Hold a day in any habit’s calendar here and add exercises, sets, reps and weight. Volume and personal records appear once you’ve logged a
          workout.
        </p>
      </Card>
    );
  }

  return (
    <>
      <h2 className="mb-1.5 px-4 text-footnote uppercase text-secondary">Gym</h2>
      <Card className="mb-3">
        <h3 className="text-headline">Volume per week</h3>
        <p className="mb-2 text-footnote text-secondary">Sets × reps × weight (kg), last 12 weeks</p>
        <BarChart
          title="Weekly training volume"
          data={volume.map((v) => ({ label: `Week of ${formatDay(v.weekStart, 'd MMM')}`, tick: formatDay(v.weekStart, 'd/M'), value: v.volume }))}
          color={color}
          format={kg}
          highlightExtremes={false}
          tickEvery={3}
        />
      </Card>
      <ListGroup header="Personal records" footer="Estimated one-rep max uses the Epley formula.">
        {prs.slice(0, 8).map((p) => (
          <ListRow
            key={p.exercise}
            title={p.exercise}
            subtitle={`${p.reps} × ${formatNumber(p.weight)} kg · ${formatDay(p.date, 'd MMM yyyy')}`}
            detail={<span className="tabular">~{formatNumber(p.estimated1RM)} kg</span>}
          />
        ))}
      </ListGroup>
      <ListGroup header="Recent workouts">
        {sessions.slice(0, 8).map((s) => (
          <ListRow
            key={`${s.habitId}${s.date}`}
            title={`${formatDay(s.date, 'EEE d MMM')} · ${names.get(s.habitId)?.name ?? ''}`}
            subtitle={s.exercises.map((x) => `${x.name} ${x.sets}×${x.reps} @ ${formatNumber(x.topWeight)}`).join(' · ')}
            detail={<span className="tabular text-footnote">{kg(s.volume)} kg</span>}
            onClick={() => navigate(`/habits/${s.habitId}`)}
          />
        ))}
      </ListGroup>
    </>
  );
}
