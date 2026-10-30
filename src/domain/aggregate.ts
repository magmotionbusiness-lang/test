import type { Entry, Habit, LocalDate } from '@/db/types';
import { eachDay } from './dates';
import { isActiveOn, isFlexible, isScheduledOn, periodKey, periodQuota } from './schedule';
import type { Tile } from './score';
import { isCompleted } from './today';

type HabitLike = Pick<Habit, 'id' | 'schedule' | 'startDate' | 'archived'>;

/**
 * Share of each day's due habits that were completed, as tiles whose
 * `progress` is 0…1 (for intensity grids). A flexible habit counts as due on
 * a day until its period quota is met — the same rule the Home list uses.
 */
export function dailyShare(habits: HabitLike[], entries: Entry[], start: LocalDate, end: LocalDate, weekStart: 0 | 1): Map<LocalDate, Tile> {
  const byHabit = new Map<string, Map<LocalDate, Entry>>();
  for (const e of entries) {
    let m = byHabit.get(e.habitId);
    if (!m) byHabit.set(e.habitId, (m = new Map()));
    m.set(e.date, e);
  }
  // Running completions per (habit, period) for flexible schedules.
  const periodDone = new Map<string, number>();
  const out = new Map<LocalDate, Tile>();

  for (const d of eachDay(start, end)) {
    let due = 0;
    let done = 0;
    for (const h of habits) {
      // Archived habits still count for their past; only the start date limits them.
      if (!isActiveOn({ ...h, archived: false }, d) || !isScheduledOn(h.schedule, d)) continue;
      const entry = byHabit.get(h.id)?.get(d);
      if (entry?.status === 'skipped' || entry?.freeze) continue;
      const completed = isCompleted(entry);
      if (isFlexible(h.schedule)) {
        const key = `${h.id}|${periodKey(h.schedule, d, weekStart)}`;
        const before = periodDone.get(key) ?? 0;
        if (completed) periodDone.set(key, before + 1);
        if (before >= periodQuota(h.schedule) && !completed) continue;
      }
      due++;
      if (completed) done++;
    }
    out.set(
      d,
      due === 0 ? { state: 'unscheduled', progress: 0 } : { state: done === due ? 'done' : done > 0 ? 'partial' : 'missed', progress: done / due },
    );
  }
  return out;
}

/** Mean of a list, or null when empty. */
export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
