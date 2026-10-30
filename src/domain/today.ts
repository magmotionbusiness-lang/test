import type { Entry, Habit, LocalDate, TimeOfDay } from '@/db/types';
import { isDueOn, isFlexible, periodKey } from './schedule';

export const TIME_OF_DAY_ORDER: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

/** Statuses that count as "the habit happened". */
export function isCompleted(entry: Pick<Entry, 'status'> | undefined): boolean {
  return entry?.status === 'done' || entry?.status === 'minimum';
}

export interface TodayItem {
  habit: Habit;
  entry: Entry | undefined;
  completed: boolean;
}

/**
 * Habits due on `date`, grouped by time of day; completed ones sink to the
 * bottom of their group. `entries` must include every entry in the current
 * week/month window so flexible quotas can be evaluated.
 */
export function todayGroups(
  habits: Habit[],
  entries: Entry[],
  date: LocalDate,
  weekStart: 0 | 1,
): { timeOfDay: TimeOfDay; items: TodayItem[] }[] {
  const byHabit = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byHabit.get(e.habitId);
    if (list) list.push(e);
    else byHabit.set(e.habitId, [e]);
  }

  const items: TodayItem[] = [];
  for (const habit of habits) {
    const hEntries = byHabit.get(habit.id) ?? [];
    const entry = hEntries.find((e) => e.date === date);
    let doneInPeriod = 0;
    if (isFlexible(habit.schedule)) {
      const key = periodKey(habit.schedule, date, weekStart);
      doneInPeriod = hEntries.filter(
        (e) => e.date !== date && e.date <= date && isCompleted(e) && periodKey(habit.schedule, e.date, weekStart) === key,
      ).length;
    }
    if (!isDueOn(habit, date, doneInPeriod)) continue;
    items.push({ habit, entry, completed: isCompleted(entry) });
  }

  return TIME_OF_DAY_ORDER.map((timeOfDay) => ({
    timeOfDay,
    items: items
      .filter((i) => i.habit.timeOfDay === timeOfDay)
      .sort(
        (a, b) =>
          Number(a.completed) - Number(b.completed) || a.habit.order - b.habit.order || a.habit.name.localeCompare(b.habit.name),
      ),
  })).filter((g) => g.items.length > 0);
}
