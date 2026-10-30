import type { Entry, Habit, LocalDate } from '@/db/types';
import { daysBetween, shiftDate } from './dates';
import { isFlexible, isScheduledOn, periodKey, periodQuota } from './schedule';
import { isCompleted } from './today';

export interface Streak {
  current: number;
  best: number;
  /** Days for fixed schedules; weeks or months for flexible ones. */
  unit: 'day' | 'week' | 'month';
}

type HabitLike = Pick<Habit, 'schedule' | 'startDate'>;

/** Skipped days and frozen misses are neutral: they never break a streak or add to it. */
function isNeutral(entry: Entry | undefined): boolean {
  return entry?.status === 'skipped' || entry?.freeze === true;
}

/**
 * Streaks that respect rest days. Fixed schedules count scheduled days in a
 * row; unscheduled days are ignored. Today only counts once it's done — an
 * unfinished today never breaks the streak. Flexible schedules count
 * consecutive periods (weeks/months) that met their quota; the period in
 * progress counts only once its quota is met.
 */
export function computeStreak(
  habit: HabitLike,
  entries: Entry[],
  today: LocalDate,
  weekStart: 0 | 1,
): Streak {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  if (isFlexible(habit.schedule)) return flexibleStreak(habit, entries, today, weekStart);

  let best = 0;
  let run = 0;
  const span = daysBetween(habit.startDate, today);
  for (let i = 0; i <= span; i++) {
    const date = shiftDate(habit.startDate, i);
    if (!isScheduledOn(habit.schedule, date)) continue;
    const entry = byDate.get(date);
    if (isCompleted(entry)) run++;
    else if (isNeutral(entry) || date === today) continue;
    else run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best, unit: 'day' };
}

function flexibleStreak(habit: HabitLike, entries: Entry[], today: LocalDate, weekStart: 0 | 1): Streak {
  const quota = periodQuota(habit.schedule);
  const counts = new Map<string, number>();
  const neutral = new Map<string, number>();
  for (const e of entries) {
    if (e.date > today || e.date < habit.startDate) continue;
    const k = periodKey(habit.schedule, e.date, weekStart);
    if (isCompleted(e)) counts.set(k, (counts.get(k) ?? 0) + 1);
    else if (isNeutral(e)) neutral.set(k, (neutral.get(k) ?? 0) + 1);
  }

  // Walk periods in order from the start date to today.
  const keys: string[] = [];
  for (let d = habit.startDate; d <= today; d = shiftDate(d, 1)) {
    const k = periodKey(habit.schedule, d, weekStart);
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  const currentKey = periodKey(habit.schedule, today, weekStart);

  let best = 0;
  let run = 0;
  for (const k of keys) {
    const done = counts.get(k) ?? 0;
    if (done >= quota) run++;
    else if (k === currentKey) continue;
    // A period where the shortfall is fully covered by skips/freezes is neutral.
    else if (done + (neutral.get(k) ?? 0) >= quota) continue;
    else run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best, unit: habit.schedule.kind === 'timesPerMonth' ? 'month' : 'week' };
}

export function formatStreak(s: Pick<Streak, 'current' | 'unit'>): string {
  const u = s.unit === 'day' ? 'd' : s.unit === 'week' ? 'w' : 'mo';
  return `${s.current}${u}`;
}
