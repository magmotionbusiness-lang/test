import type { Entry, LocalDate } from '@/db/types';
import { monthKey } from './dates';

export const FREEZES_PER_MONTH = 2;

/** Freezes left in the month containing `date`, shared across all habits. */
export function freezesLeft(entries: Pick<Entry, 'date' | 'freeze'>[], date: LocalDate): number {
  const m = monthKey(date);
  const used = entries.filter((e) => e.freeze && monthKey(e.date) === m).length;
  return Math.max(0, FREEZES_PER_MONTH - used);
}

/** A freeze can cover a past, unplanned miss (no result logged that day). */
export function canFreeze(entry: Pick<Entry, 'status' | 'freeze'> | undefined, date: LocalDate, today: LocalDate): boolean {
  if (date >= today) return false;
  if (entry?.freeze) return false;
  return !entry || entry.status === 'missed';
}
