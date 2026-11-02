import { useCachedLiveQuery } from '@/app/useCachedLiveQuery';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/app/motion';
import { Appear, FadeSwap } from '@/components/Fade';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/db';
import type { Habit } from '@/db/types';
import { useSettings } from '@/app/useSettings';
import { clearHabit, completeHabit, minimumHabit, saveNote, setHabitValue, skipHabit, tapHabit } from '@/app/logActions';
import { ActionSheet } from '@/components/ActionSheet';
import { AmountSheet } from '@/components/AmountSheet';
import { DateStrip } from '@/components/DateStrip';
import { HabitForm } from '@/components/HabitForm';
import { HabitRow } from '@/components/HabitRow';
import { NoteSheet } from '@/components/NoteSheet';
import { NavButton, Page } from '@/components/Page';
import { EmptyState, ListGroup, PrimaryButton, ProgressRing } from '@/components/ui';
import { eachDay, formatDay, shiftDate, today as todayFn } from '@/domain/dates';
import { computeStreak } from '@/domain/streaks';
import { freezeCandidates } from '@/domain/analytics';
import { useFreezesLeft } from '@/app/useFreezes';
import { FreezeOffer } from '@/components/FreezeOffer';
import { HomeOverview } from '@/components/HomeOverview';
import { BackupReminder } from '@/components/BackupReminder';
import { Celebration } from '@/components/Celebration';
import { DailyCheckIn } from '@/components/DailyCheckIn';
import { TIME_OF_DAY_LABEL, todayGroups } from '@/domain/today';
import { colorVar } from '@/lib/colors';

/** Streaks on Home look back at most this far, keeping each render cheap. */
const STREAK_WINDOW = 400;

export function HomeScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const today = todayFn();
  const [date, setDate] = useState(today);
  const [amountFor, setAmountFor] = useState<Habit | null>(null);
  const [moreFor, setMoreFor] = useState<Habit | null>(null);
  const [noteFor, setNoteFor] = useState<Habit | null>(null);
  const [editing, setEditing] = useState<Habit | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const prevDate = useRef(date);
  const dayDirection: -1 | 0 | 1 = date === prevDate.current ? 0 : date > prevDate.current ? 1 : -1;
  useEffect(() => {
    prevDate.current = date;
  }, [date]);

  const data = useCachedLiveQuery(
    `home:${today}`,
    async () => {
      const [habits, sections, entries, goals] = await Promise.all([
        db.habits.filter((h) => !h.archived).toArray(),
        db.sections.toArray(),
        db.entries.where('date').between(shiftDate(today, -STREAK_WINDOW), today, true, true).toArray(),
        db.goals.where('status').equals('active').toArray(),
      ]);
      return { habits, sections, entries, goals };
    },
    [today],
  );

  const groups = useMemo(() => (data ? todayGroups(data.habits, data.entries, date, settings.weekStart) : []), [data, date, settings.weekStart]);
  const all = groups.flatMap((g) => g.items);
  const doneCount = all.filter((i) => i.completed).length;

  const freezeOffers = useMemo(
    () => (data ? freezeCandidates(data.habits, data.entries, today, settings.weekStart) : []),
    [data, today, settings.weekStart],
  );
  const freezesLeft = useFreezesLeft(freezeOffers.length ? shiftDate(today, -1) : null);

  const sectionColor = useMemo(() => new Map(data?.sections.map((s) => [s.id, colorVar(s.color)]) ?? []), [data]);

  const streaks = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeStreak>>();
    if (!data) return m;
    const floor = shiftDate(today, -STREAK_WINDOW);
    for (const h of data.habits) {
      const entries = data.entries.filter((e) => e.habitId === h.id);
      m.set(h.id, computeStreak({ ...h, startDate: h.startDate > floor ? h.startDate : floor }, entries, today, settings.weekStart));
    }
    return m;
  }, [data, today, settings.weekStart]);

  // Completion share per day for the date strip.
  const completion = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    for (const d of eachDay(shiftDate(today, -20), today)) {
      const items = todayGroups(data.habits, data.entries, d, settings.weekStart).flatMap((g) => g.items);
      m.set(d, items.length ? items.filter((i) => i.completed).length / items.length : 0);
    }
    return m;
  }, [data, today, settings.weekStart]);

  const entryFor = (h: Habit | null) => (h ? data?.entries.find((e) => e.habitId === h.id && e.date === date) : undefined);
  const isToday = date === today;

  const onTap = (h: Habit) => {
    if (h.type === 'duration' || h.type === 'numeric') {
      const e = entryFor(h);
      // An empty or partial quantity opens the amount sheet; a done one clears with one tap.
      if (!e || e.status !== 'done') return setAmountFor(h);
    }
    void tapHabit(h, date);
  };

  return (
    <Page
      title={isToday ? 'Today' : formatDay(date, 'EEEE')}
      subtitle={isToday ? formatDay(date, 'EEEE, d MMMM') : formatDay(date, 'd MMMM yyyy')}
      actions={
        <NavButton
          label="New habit"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus size={26} aria-hidden />
        </NavButton>
      }
      titleAccessory={
        all.length > 0 && (
          <div className="flex items-center gap-2 pb-1">
            <span className="tabular text-subhead text-secondary">
              {doneCount}/{all.length}
            </span>
            <ProgressRing
              value={doneCount}
              total={all.length}
              size={36}
              stroke={4.5}
              color={doneCount === all.length ? 'rgb(var(--success))' : undefined}
              label={`${doneCount} of ${all.length} habits done`}
            />
          </div>
        )
      }
    >
      {data && data.habits.length > 0 && <DateStrip value={date} today={today} onChange={setDate} completion={completion} />}

      {isToday && <FreezeOffer candidates={freezeOffers} today={today} freezesLeft={freezesLeft} />}
      {isToday && data && data.habits.length > 0 && (
        <BackupReminder
          settings={settings}
          firstActivity={data.habits.reduce<string | null>((m, h) => (!m || h.createdAt < m ? h.createdAt : m), null)}
        />
      )}

      {data && data.habits.length === 0 && (
        <EmptyState
          title="Nothing to track yet"
          message="Add your first habit to start filling tiles. Or load demo data from Settings to explore."
          action={
            <PrimaryButton
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              Add your first habit
            </PrimaryButton>
          }
        />
      )}

      {/* Switching days cross-fades the list, sliding toward the chosen day. */}
      <FadeSwap swapKey={date} direction={dayDirection}>
        {data && data.habits.length > 0 && all.length === 0 && (
          <EmptyState title="A free day" message="No habits are scheduled for this day. Enjoy the rest." />
        )}

        {groups.map((g) => (
          <ListGroup key={g.timeOfDay} header={TIME_OF_DAY_LABEL[g.timeOfDay]}>
            {g.items.map(({ habit, entry }) => (
              // `layout` slides rows smoothly when a done habit sinks to the bottom of its group.
              <motion.div key={habit.id} layout="position" transition={spring}>
                <HabitRow
                  habit={habit}
                  entry={entry}
                  sectionColor={sectionColor.get(habit.sectionId) ?? colorVar(habit.color)}
                  streak={isToday ? streaks.get(habit.id) : undefined}
                  onTap={() => onTap(habit)}
                  onLongPress={habit.type === 'count' ? () => setAmountFor(habit) : undefined}
                  onComplete={() => completeHabit(habit, date)}
                  onSkip={() => skipHabit(habit, date)}
                  onMore={() => setMoreFor(habit)}
                  onOpen={() => navigate(`/habits/${habit.id}`, { state: { back: isToday ? 'Today' : formatDay(date, 'EEEE') } })}
                />
              </motion.div>
            ))}
          </ListGroup>
        ))}

        {all.length > 0 && <p className="mb-6 px-4 text-center text-footnote text-secondary">Swipe right to complete · Swipe left to skip</p>}

        {data && (
          // Mounted only once data is ready, so the card appears in place on open and only animates on real changes.
          <Appear
            show={Boolean(
              data && data.habits.length > 0 && (!isToday || new Date().getHours() >= 17 || (all.length > 0 && doneCount === all.length)),
            )}
          >
            <DailyCheckIn date={date} title={isToday ? 'Daily check-in' : `Check-in · ${formatDay(date, 'EEEE')}`} />
          </Appear>
        )}
      </FadeSwap>

      {data && data.habits.length > 0 && isToday && (
        <HomeOverview habits={data.habits} entries={data.entries} goals={data.goals} today={today} weekStart={settings.weekStart} />
      )}

      <Celebration allDone={isToday && all.length > 0 && doneCount === all.length} date={today} sound={settings.completionSound !== false} />

      <AmountSheet
        habit={amountFor}
        entry={entryFor(amountFor)}
        onClose={() => setAmountFor(null)}
        onSave={(v) => amountFor && setHabitValue(amountFor, date, v)}
      />

      <ActionSheet
        open={moreFor !== null}
        title={moreFor ? `${moreFor.emoji} ${moreFor.name}` : undefined}
        onClose={() => setMoreFor(null)}
        actions={
          moreFor
            ? [
                ...(moreFor.minimumVersion
                  ? [{ label: `Minimum: ${moreFor.minimumVersion}`, onSelect: () => minimumHabit(moreFor, date) }]
                  : [{ label: 'Log minimum version', onSelect: () => minimumHabit(moreFor, date) }]),
                ...(moreFor.type !== 'check' && moreFor.type !== 'avoid'
                  ? [{ label: 'Enter exact amount', onSelect: () => setAmountFor(moreFor) }]
                  : []),
                { label: entryFor(moreFor)?.note ? 'Edit note' : 'Add note', onSelect: () => setNoteFor(moreFor) },
                {
                  label: 'Edit habit',
                  onSelect: () => {
                    setEditing(moreFor);
                    setFormOpen(true);
                  },
                },
                ...(entryFor(moreFor) ? [{ label: 'Clear this day', destructive: true, onSelect: () => clearHabit(moreFor, date) }] : []),
              ]
            : []
        }
      />

      <NoteSheet
        open={noteFor !== null}
        title={noteFor ? `Note · ${noteFor.name}` : 'Note'}
        initial={entryFor(noteFor)?.note ?? ''}
        onClose={() => setNoteFor(null)}
        onSave={(t) => noteFor && saveNote(noteFor, date, t)}
      />

      <HabitForm open={formOpen} onClose={() => setFormOpen(false)} habit={editing} />
    </Page>
  );
}
