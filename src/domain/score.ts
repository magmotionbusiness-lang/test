import type { Entry, Habit, LocalDate } from '@/db/types';
import { daysBetween, eachDay, shiftDate, weekdayOf } from './dates';
import { progressOf } from './logging';
import { isFlexible, isScheduledOn, periodKey, periodQuota } from './schedule';
import { isCompleted } from './today';

export type TileState = 'done' | 'partial' | 'minimum' | 'skipped' | 'missed' | 'unscheduled' | 'future';

export interface Tile {
  state: TileState;
  /** 0…1, used for partial opacity. */
  progress: number;
}

type HabitLike = Pick<Habit, 'schedule' | 'startDate' | 'type' | 'target'>;

/** Visual state of one habit on one day. */
export function tileFor(habit: HabitLike, entry: Entry | undefined, date: LocalDate, today: LocalDate): Tile {
  if (date > today) return { state: 'future', progress: 0 };
  if (entry?.status === 'done') return { state: 'done', progress: 1 };
  if (entry?.status === 'minimum') return { state: 'minimum', progress: 0.5 };
  if (entry?.status === 'skipped' || entry?.freeze) return { state: 'skipped', progress: 0 };
  if (entry?.status === 'partial') return { state: 'partial', progress: progressOf(habit, entry) };
  if (date < habit.startDate) return { state: 'unscheduled', progress: 0 };
  // Flexible habits have no "required" days, so an empty day is just quiet.
  if (isFlexible(habit.schedule) || !isScheduledOn(habit.schedule, date)) return { state: 'unscheduled', progress: 0 };
  if (date === today) return { state: 'missed', progress: 0 }; // drawn as "today", not as a miss
  return { state: 'missed', progress: 0 };
}

/** Credit a day earns towards consistency: done/minimum 1, partial its share. */
function credit(habit: HabitLike, entry: Entry | undefined): number {
  if (!entry) return 0;
  if (isCompleted(entry)) return 1;
  if (entry.status === 'partial') return progressOf(habit, entry);
  return 0;
}

const neutral = (e: Entry | undefined) => e?.status === 'skipped' || e?.freeze === true;

export interface Consistency {
  /** 0…1, or null when nothing was expected in the range yet. */
  score: number | null;
  earned: number;
  expected: number;
}

/**
 * Consistency = earned / expected over a date range. Skipped and frozen days
 * are removed from what's expected. Today only counts once it has a result,
 * so the score never drops just because the day isn't over.
 */
export function consistency(habit: HabitLike, entries: Entry[], from: LocalDate, to: LocalDate, today: LocalDate, weekStart: 0 | 1): Consistency {
  const start = from > habit.startDate ? from : habit.startDate;
  const end = to < today ? to : today;
  if (start > end) return { score: null, earned: 0, expected: 0 };
  const byDate = new Map(entries.map((e) => [e.date, e]));

  let earned = 0;
  let expected = 0;

  if (!isFlexible(habit.schedule)) {
    for (const d of eachDay(start, end)) {
      if (!isScheduledOn(habit.schedule, d)) continue;
      const e = byDate.get(d);
      if (neutral(e)) continue;
      if (d === today && !e) continue;
      expected++;
      earned += credit(habit, e);
    }
  } else {
    const quota = periodQuota(habit.schedule);
    const periods = new Map<string, { done: number; skips: number; days: number; current: boolean }>();
    const currentKey = periodKey(habit.schedule, today, weekStart);
    for (const d of eachDay(start, end)) {
      const k = periodKey(habit.schedule, d, weekStart);
      const p = periods.get(k) ?? { done: 0, skips: 0, days: 0, current: k === currentKey };
      const e = byDate.get(d);
      p.done += credit(habit, e);
      if (neutral(e)) p.skips++;
      p.days++;
      periods.set(k, p);
    }
    for (const p of periods.values()) {
      // Partial periods at the edges of the range expect a proportional share.
      const full = habit.schedule.kind === 'timesPerWeek' ? 7 : 30;
      let exp = Math.max(0, quota * Math.min(1, p.days / full) - p.skips);
      if (p.current) exp = Math.min(exp, p.done); // the period in progress can only help
      expected += exp;
      earned += Math.min(p.done, exp);
    }
  }

  return { score: expected > 0 ? Math.min(1, earned / expected) : null, earned, expected };
}

/** Consistency for the last `days` days ending today, or all-time when `days` is null. */
export function consistencyWindow(habit: HabitLike, entries: Entry[], today: LocalDate, weekStart: 0 | 1, days: number | null): Consistency {
  const from = days === null ? habit.startDate : shiftDate(today, -(days - 1));
  return consistency(habit, entries, from, today, today, weekStart);
}

export interface QuantityStats {
  total: number;
  /** Average over days with a logged amount. */
  average: number;
  /** Change of the last-30-day total vs the 30 days before, as a fraction; null without history. */
  trend: number | null;
}

export function quantityStats(entries: Entry[], today: LocalDate): QuantityStats {
  const logged = entries.filter((e) => e.value > 0 && (e.status === 'done' || e.status === 'partial' || e.status === 'minimum'));
  const total = logged.reduce((s, e) => s + e.value, 0);
  const sumBetween = (a: LocalDate, b: LocalDate) => logged.filter((e) => e.date >= a && e.date <= b).reduce((s, e) => s + e.value, 0);
  const recent = sumBetween(shiftDate(today, -29), today);
  const before = sumBetween(shiftDate(today, -59), shiftDate(today, -30));
  return { total, average: logged.length ? total / logged.length : 0, trend: before > 0 ? (recent - before) / before : null };
}

/** Earned and expected credit per weekday (0 = Sunday) over a range. */
export function weekdayCounts(
  habit: HabitLike,
  entries: Entry[],
  from: LocalDate,
  to: LocalDate,
  today: LocalDate,
): { earned: number[]; expected: number[] } {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const earned = Array<number>(7).fill(0);
  const expected = Array<number>(7).fill(0);
  const start = from > habit.startDate ? from : habit.startDate;
  const end = to < today ? to : shiftDate(today, -1);
  if (start > end) return { earned, expected };
  const flexible = isFlexible(habit.schedule);
  for (const d of eachDay(start, end)) {
    if (!isScheduledOn(habit.schedule, d)) continue;
    const e = byDate.get(d);
    if (neutral(e)) continue;
    // Flexible habits: only days with an entry tell us about the weekday.
    if (flexible && !e) continue;
    const wd = weekdayOf(d);
    expected[wd]!++;
    earned[wd]! += credit(habit, e);
  }
  return { earned, expected };
}

/** Completion rate per weekday (0 = Sunday), null where nothing was expected. */
export function weekdayRates(habit: HabitLike, entries: Entry[], from: LocalDate, to: LocalDate, today: LocalDate): (number | null)[] {
  const { earned, expected } = weekdayCounts(habit, entries, from, to, today);
  return expected.map((x, i) => (x > 0 ? earned[i]! / x : null));
}

/** Number of calendar days a range spans, inclusive. */
export function rangeLength(from: LocalDate, to: LocalDate): number {
  return daysBetween(from, to) + 1;
}

/** Tile map for one habit from `start` to `today`. */
export function buildTiles(habit: HabitLike, entries: Entry[], start: LocalDate, today: LocalDate): Map<LocalDate, Tile> {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const out = new Map<LocalDate, Tile>();
  for (const d of eachDay(start, today)) out.set(d, tileFor(habit, byDate.get(d), d, today));
  return out;
}
