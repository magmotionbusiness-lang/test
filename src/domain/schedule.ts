import type { Habit, LocalDate, Schedule } from '@/db/types';
import { monthKey, weekdayOf, weekStartOf } from './dates';

/**
 * Whether a habit is *due* on a specific day.
 *
 * Fixed schedules (daily, weekdays) are due on matching days only. Flexible
 * schedules (X per week / month) are "available" every day of the period;
 * whether a given day counts against the user is decided by period quota,
 * not by this function.
 */
export function isScheduledOn(schedule: Schedule, date: LocalDate): boolean {
  switch (schedule.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return schedule.days.includes(weekdayOf(date));
    case 'timesPerWeek':
    case 'timesPerMonth':
      return true;
  }
}

export function isFlexible(schedule: Schedule): boolean {
  return schedule.kind === 'timesPerWeek' || schedule.kind === 'timesPerMonth';
}

/** Key of the quota period a day belongs to, for flexible schedules. */
export function periodKey(schedule: Schedule, date: LocalDate, weekStart: 0 | 1): string {
  if (schedule.kind === 'timesPerMonth') return monthKey(date);
  return weekStartOf(date, weekStart);
}

export function periodQuota(schedule: Schedule): number {
  if (schedule.kind === 'timesPerWeek' || schedule.kind === 'timesPerMonth') return schedule.times;
  return 0;
}

export function isActiveOn(habit: Pick<Habit, 'startDate' | 'archived'>, date: LocalDate): boolean {
  return !habit.archived && date >= habit.startDate;
}

/**
 * Due today for the Home list. Flexible habits stay listed until the period's
 * quota is met (`doneInPeriod` counts completions in the current period,
 * excluding `date` itself so today's check doesn't hide the row).
 */
export function isDueOn(habit: Pick<Habit, 'schedule' | 'startDate' | 'archived'>, date: LocalDate, doneInPeriodExcludingDate = 0): boolean {
  if (!isActiveOn(habit, date)) return false;
  if (!isScheduledOn(habit.schedule, date)) return false;
  if (isFlexible(habit.schedule)) return doneInPeriodExcludingDate < periodQuota(habit.schedule);
  return true;
}

export function describeSchedule(schedule: Schedule, weekStart: 0 | 1 = 1): string {
  switch (schedule.kind) {
    case 'daily':
      return 'Every day';
    case 'weekdays': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = [...schedule.days].sort((a, b) => ((a - weekStart + 7) % 7) - ((b - weekStart + 7) % 7));
      if (days.length === 7) return 'Every day';
      if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
      if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
      return days.map((d) => names[d]).join(', ');
    }
    case 'timesPerWeek':
      return `${schedule.times}× a week`;
    case 'timesPerMonth':
      return `${schedule.times}× a month`;
  }
}
