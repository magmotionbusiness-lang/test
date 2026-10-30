import { addDays, differenceInCalendarDays, format, parse, startOfWeek } from 'date-fns';
import type { LocalDate, Weekday } from '@/db/types';

/**
 * All habit logic runs on local calendar days. A LocalDate is parsed at local
 * noon, which keeps day arithmetic stable across daylight-saving switches.
 */
export function toLocalDate(d: Date): LocalDate {
  return format(d, 'yyyy-MM-dd');
}

export function fromLocalDate(s: LocalDate): Date {
  const d = parse(s, 'yyyy-MM-dd', new Date(2000, 0, 1, 12));
  d.setHours(12, 0, 0, 0);
  return d;
}

export function today(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

export function shiftDate(s: LocalDate, days: number): LocalDate {
  return toLocalDate(addDays(fromLocalDate(s), days));
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return differenceInCalendarDays(fromLocalDate(to), fromLocalDate(from));
}

export function weekdayOf(s: LocalDate): Weekday {
  return fromLocalDate(s).getDay() as Weekday;
}

/** Inclusive list of days from `start` to `end`. */
export function eachDay(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  const n = daysBetween(start, end);
  for (let i = 0; i <= n; i++) out.push(shiftDate(start, i));
  return out;
}

export function weekStartOf(s: LocalDate, weekStart: 0 | 1): LocalDate {
  return toLocalDate(startOfWeek(fromLocalDate(s), { weekStartsOn: weekStart }));
}

export function monthKey(s: LocalDate): string {
  return s.slice(0, 7);
}

export function formatDay(s: LocalDate, pattern: string): string {
  return format(fromLocalDate(s), pattern);
}
