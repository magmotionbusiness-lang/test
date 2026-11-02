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

export type ProgressMode = 'add' | 'remove' | 'set';

/** The goal's new current value after adding, removing or setting an amount. Never below zero; rounded to 2 decimals. */
export function applyProgress(current: number | null, mode: ProgressMode, amount: number): number {
  const base = current ?? 0;
  const next = mode === 'add' ? base + amount : mode === 'remove' ? base - amount : amount;
  return Math.max(0, Math.round(next * 100) / 100);
}

/**
 * Handy one-tap amounts for a goal's target: "nice" numbers (1, 2, 5 × 10ⁿ)
 * between about 1% and 25% of the target, at most five. Whole-number targets
 * get whole-number amounts.
 */
export function quickAmounts(target: number): number[] {
  if (!(target > 0)) return [1, 5, 10];
  const whole = Number.isInteger(target) && target >= 3;
  const nice: number[] = [];
  for (let e = -2; e <= 9; e++) for (const m of [1, 2, 5]) nice.push(Number((m * 10 ** e).toPrecision(3)));
  const pick = (hi: number) => nice.filter((n) => n >= target / 100 && n <= hi && (!whole || Number.isInteger(n)));
  let out = pick(target / 4);
  if (out.length < 3) out = pick(target / 2);
  if (out.length === 0) out = [whole ? 1 : Number((target / 10).toPrecision(2))];
  return out.slice(-5);
}
