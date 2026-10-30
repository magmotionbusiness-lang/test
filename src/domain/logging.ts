import type { Entry, EntryStatus, Habit } from '@/db/types';

export type EntryPatch = Pick<Entry, 'value' | 'status'>;

/** Whether a habit is logged by amount (needs a number) rather than yes/no. */
export function isQuantity(type: Habit['type']): boolean {
  return type === 'count' || type === 'duration' || type === 'numeric';
}

/** Status for a logged amount: target reached → done, some → partial. */
export function statusForValue(habit: Pick<Habit, 'type' | 'target'>, value: number): EntryStatus | null {
  if (value <= 0) return null;
  if (!isQuantity(habit.type)) return 'done';
  return value >= habit.target ? 'done' : 'partial';
}

/**
 * What a single tap on the check control does. Returns `null` when the tap
 * should clear the day (i.e. delete the entry).
 *
 * - check / avoid: toggle done.
 * - count: +1 each tap; once at or over target, a tap resets to zero.
 * - duration / numeric: one tap logs the full target ("did my 10 minutes");
 *   tapping a completed one clears it. Exact amounts use the input sheet.
 */
export function tapEntry(habit: Pick<Habit, 'type' | 'target'>, current: EntryPatch | undefined): EntryPatch | null {
  const done = current?.status === 'done' || current?.status === 'minimum';
  switch (habit.type) {
    case 'check':
    case 'avoid':
      return done ? null : { value: 1, status: 'done' };
    case 'count': {
      if (done && (current?.value ?? 0) >= habit.target) return null;
      const value = (current?.status === 'skipped' ? 0 : current?.value ?? 0) + 1;
      return { value, status: statusForValue(habit, value)! };
    }
    case 'duration':
    case 'numeric':
      return done ? null : { value: habit.target, status: 'done' };
  }
}

/** Entry for an exact amount from the input sheet; `null` clears the day. */
export function valueEntry(habit: Pick<Habit, 'type' | 'target'>, value: number): EntryPatch | null {
  const status = statusForValue(habit, value);
  return status ? { value, status } : null;
}

/** Progress 0…1 for drawing partial fills. */
export function progressOf(habit: Pick<Habit, 'type' | 'target'>, entry: EntryPatch | undefined): number {
  if (!entry) return 0;
  if (entry.status === 'done') return 1;
  if (entry.status === 'minimum') return 0.5;
  if (entry.status === 'partial' && habit.target > 0) return Math.min(1, entry.value / habit.target);
  return 0;
}

/** Quick-pick presets for the amount sheet, based on the target. */
export function presetsFor(habit: Pick<Habit, 'type' | 'target'>): number[] {
  const t = habit.target;
  const raw = [t / 4, t / 2, t, t * 1.5].map((v) => (v >= 20 ? Math.round(v / 5) * 5 : v >= 1 ? Math.round(v) : Math.round(v * 10) / 10));
  return [...new Set(raw.filter((v) => v > 0))];
}
