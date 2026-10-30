import type { Entry, Goal, Habit, LocalDate } from '@/db/types';
import { daysBetween, shiftDate, toLocalDate } from './dates';
import { groupConsistency } from './analytics';

export interface GoalPace {
  /** 0…1 progress towards the target (metric, else milestones). */
  progress: number;
  /** 0…1 share of the time from creation to deadline that has passed; null without a deadline. */
  timeElapsed: number | null;
  /** Pooled consistency of linked habits over the last 14 days. */
  habitPace: number | null;
  daysLeft: number | null;
  status: 'on-track' | 'behind' | 'done';
}

const PACE_WINDOW = 14;

export function goalProgress(goal: Pick<Goal, 'targetValue' | 'currentValue' | 'milestones'>): number {
  if (goal.targetValue && goal.currentValue !== null) return Math.max(0, Math.min(1, goal.currentValue / goal.targetValue));
  if (goal.milestones.length) return goal.milestones.filter((m) => m.done).length / goal.milestones.length;
  return 0;
}

/**
 * On track when linked habits are being done (≥ 70% over the last 2 weeks)
 * and measurable progress isn't far behind the calendar.
 */
export function goalPace(goal: Goal, habits: Habit[], entries: Entry[], today: LocalDate, weekStart: 0 | 1): GoalPace {
  const progress = goalProgress(goal);
  const linked = habits.filter((h) => goal.habitIds.includes(h.id) && !h.archived);
  const habitPace = linked.length ? groupConsistency(linked, entries, shiftDate(today, -(PACE_WINDOW - 1)), today, today, weekStart) : null;
  const created = toLocalDate(new Date(goal.createdAt || Date.now()));
  let timeElapsed: number | null = null;
  let daysLeft: number | null = null;
  if (goal.deadline) {
    const span = Math.max(1, daysBetween(created, goal.deadline));
    timeElapsed = Math.max(0, Math.min(1, daysBetween(created, today) / span));
    daysLeft = daysBetween(today, goal.deadline);
  }
  if (goal.status === 'achieved' || progress >= 1) return { progress, timeElapsed, habitPace, daysLeft, status: 'done' };
  const habitsBehind = habitPace !== null && habitPace < 0.7;
  const progressBehind = timeElapsed !== null && (goal.targetValue !== null || goal.milestones.length > 0) && progress < timeElapsed - 0.15;
  const overdue = daysLeft !== null && daysLeft < 0;
  return { progress, timeElapsed, habitPace, daysLeft, status: habitsBehind || progressBehind || overdue ? 'behind' : 'on-track' };
}
