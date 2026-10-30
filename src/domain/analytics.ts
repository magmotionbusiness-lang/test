import type { Entry, Habit, LocalDate } from '@/db/types';
import { shiftDate, weekStartOf } from './dates';
import { isScheduledOn } from './schedule';
import { consistency, weekdayCounts } from './score';
import { computeStreak, type Streak } from './streaks';

type HabitLike = Pick<Habit, 'id' | 'schedule' | 'startDate' | 'type' | 'target'>;

function entriesOf(entries: Entry[], habitId: string): Entry[] {
  return entries.filter((e) => e.habitId === habitId);
}

/** Pooled consistency across habits: Σ earned ÷ Σ expected. */
export function groupConsistency(
  habits: HabitLike[],
  entries: Entry[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
  weekStart: 0 | 1,
): number | null {
  let earned = 0;
  let expected = 0;
  for (const h of habits) {
    const c = consistency(h, entriesOf(entries, h.id), from, to, today, weekStart);
    earned += c.earned;
    expected += c.expected;
  }
  return expected > 0 ? earned / expected : null;
}

export interface WeekPoint {
  weekStart: LocalDate;
  score: number | null;
}

/** Pooled consistency per week for the last `weeks` weeks, oldest first. */
export function weeklyConsistency(habits: HabitLike[], entries: Entry[], weeks: number, today: LocalDate, weekStart: 0 | 1): WeekPoint[] {
  const current = weekStartOf(today, weekStart);
  const out: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = shiftDate(current, -7 * i);
    out.push({ weekStart: ws, score: groupConsistency(habits, entries, ws, shiftDate(ws, 6), today, weekStart) });
  }
  return out;
}

/** This week vs last week, pooled. */
export function weekOverWeek(
  habits: HabitLike[],
  entries: Entry[],
  today: LocalDate,
  weekStart: 0 | 1,
): { thisWeek: number | null; lastWeek: number | null } {
  const ws = weekStartOf(today, weekStart);
  return {
    thisWeek: groupConsistency(habits, entries, ws, today, today, weekStart),
    lastWeek: groupConsistency(habits, entries, shiftDate(ws, -7), shiftDate(ws, -1), today, weekStart),
  };
}

/** Pooled completion rate per weekday (0 = Sunday). */
export function groupWeekdayRates(habits: HabitLike[], entries: Entry[], from: LocalDate, to: LocalDate, today: LocalDate): (number | null)[] {
  const earned = Array<number>(7).fill(0);
  const expected = Array<number>(7).fill(0);
  for (const h of habits) {
    const c = weekdayCounts(h, entriesOf(entries, h.id), from, to, today);
    for (let i = 0; i < 7; i++) {
      earned[i]! += c.earned[i]!;
      expected[i]! += c.expected[i]!;
    }
  }
  return expected.map((x, i) => (x > 0 ? earned[i]! / x : null));
}

/** Habits ranked by current streak (best first), with best streaks for context. */
export function streakLeaders<H extends HabitLike>(
  habits: H[],
  entries: Entry[],
  today: LocalDate,
  weekStart: 0 | 1,
): { habit: H; streak: Streak }[] {
  return habits
    .map((habit) => ({ habit, streak: computeStreak(habit, entriesOf(entries, habit.id), today, weekStart) }))
    .sort((a, b) => b.streak.current - a.streak.current || b.streak.best - a.streak.best);
}

// Gym ----------------------------------------------------------------------

export interface Session {
  date: LocalDate;
  habitId: string;
  volume: number;
  exercises: { name: string; sets: number; topWeight: number; reps: number }[];
}

export function workoutSessions(entries: Entry[]): Session[] {
  return entries
    .filter((e) => e.workout?.some((w) => w.sets.length))
    .map((e) => ({
      date: e.date,
      habitId: e.habitId,
      volume: sessionVolume(e),
      exercises: e
        .workout!.filter((w) => w.sets.length)
        .map((w) => {
          const top = w.sets.reduce((m, s) => (s.weight > m.weight ? s : m), w.sets[0]!);
          return { name: w.name, sets: w.sets.length, topWeight: top.weight, reps: top.reps };
        }),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Σ sets × reps × weight. */
export function sessionVolume(e: Pick<Entry, 'workout'>): number {
  return (e.workout ?? []).reduce((v, w) => v + w.sets.reduce((s, set) => s + set.reps * set.weight, 0), 0);
}

export function weeklyVolume(entries: Entry[], weeks: number, today: LocalDate, weekStart: 0 | 1): { weekStart: LocalDate; volume: number }[] {
  const current = weekStartOf(today, weekStart);
  const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: shiftDate(current, -7 * (weeks - 1 - i)), volume: 0 }));
  const first = out[0]!.weekStart;
  for (const e of entries) {
    if (!e.workout || e.date < first || e.date > today) continue;
    const ws = weekStartOf(e.date, weekStart);
    const slot = out.find((o) => o.weekStart === ws);
    if (slot) slot.volume += sessionVolume(e);
  }
  return out;
}

export interface PersonalRecord {
  exercise: string;
  weight: number;
  reps: number;
  date: LocalDate;
  /** Epley estimated one-rep max. */
  estimated1RM: number;
}

export function personalRecords(entries: Entry[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const e of entries) {
    for (const w of e.workout ?? []) {
      for (const s of w.sets) {
        if (s.weight <= 0 || s.reps <= 0) continue;
        const est = s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30);
        const key = w.name.trim().toLowerCase();
        const cur = best.get(key);
        if (!cur || s.weight > cur.weight || (s.weight === cur.weight && s.reps > cur.reps)) {
          best.set(key, { exercise: w.name.trim(), weight: s.weight, reps: s.reps, date: e.date, estimated1RM: Math.round(est * 10) / 10 });
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => b.estimated1RM - a.estimated1RM);
}

// Home: streak protection ------------------------------------------------------

/**
 * Habits whose streak was broken by an unplanned miss yesterday and could be
 * saved with a freeze: yesterday was scheduled with no result, and the streak
 * that ended the day before was at least `minStreak` long.
 */
export function freezeCandidates<H extends HabitLike>(
  habits: H[],
  entries: Entry[],
  today: LocalDate,
  weekStart: 0 | 1,
  minStreak = 3,
): { habit: H; streak: number }[] {
  const yesterday = shiftDate(today, -1);
  const out: { habit: H; streak: number }[] = [];
  for (const h of habits) {
    if (h.schedule.kind === 'timesPerWeek' || h.schedule.kind === 'timesPerMonth') continue;
    if (h.startDate > shiftDate(yesterday, -1)) continue;
    if (!isScheduledOn(h.schedule, yesterday)) continue;
    const hEntries = entriesOf(entries, h.id);
    const y = hEntries.find((e) => e.date === yesterday);
    if (y && (y.status !== 'missed' || y.freeze)) continue;
    // The streak as it stood before yesterday (entries up to then, yesterday as "today" so it can't break it).
    const before = computeStreak(
      h,
      hEntries.filter((e) => e.date < yesterday),
      yesterday,
      weekStart,
    );
    if (before.current >= minStreak) out.push({ habit: h, streak: before.current });
  }
  return out;
}
