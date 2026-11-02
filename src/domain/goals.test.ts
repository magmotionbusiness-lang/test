import { describe, expect, it } from 'vitest';
import type { Entry, Goal, Habit } from '@/db/types';
import { applyProgress, goalPace, goalProgress, quickAmounts } from './goals';
import { eachDay } from './dates';

const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: 'g',
  title: 'Bench 100',
  why: '',
  deadline: '2026-12-31',
  metric: 'kg',
  targetValue: 100,
  currentValue: 50,
  status: 'active',
  milestones: [],
  habitIds: ['h'],
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '',
  ...patch,
});
const habit = { id: 'h', schedule: { kind: 'daily' }, startDate: '2026-09-01', archived: false, type: 'check', target: 1 } as Habit;
const done = (from: string, to: string): Entry[] =>
  eachDay(from, to).map((date) => ({ id: date, habitId: 'h', date, status: 'done', value: 1, note: '', createdAt: '', updatedAt: '' }));

describe('goals', () => {
  it('measures progress by metric, else milestones', () => {
    expect(goalProgress(goal())).toBe(0.5);
    expect(
      goalProgress(
        goal({
          targetValue: null,
          currentValue: null,
          milestones: [
            { id: '1', title: 'a', done: true },
            { id: '2', title: 'b', done: false },
          ],
        }),
      ),
    ).toBe(0.5);
  });
  it('is on track when habits are done and progress keeps up', () => {
    const p = goalPace(goal(), [habit], done('2026-10-01', '2026-10-29'), '2026-10-30', 1);
    expect(p.status).toBe('on-track');
    expect(p.habitPace).toBe(1);
  });
  it('is behind when linked habits slip', () => {
    expect(goalPace(goal(), [habit], done('2026-10-01', '2026-10-15'), '2026-10-30', 1).status).toBe('behind');
  });
  it('is behind when progress lags the calendar', () => {
    expect(goalPace(goal({ currentValue: 10 }), [habit], done('2026-10-01', '2026-10-29'), '2026-10-30', 1).status).toBe('behind');
  });
  it('is done once the target is reached', () => {
    expect(goalPace(goal({ currentValue: 100 }), [habit], [], '2026-10-30', 1).status).toBe('done');
  });
});

describe('progress updates', () => {
  it('adds, removes and sets, never going below zero', () => {
    expect(applyProgress(1250, 'add', 50)).toBe(1300);
    expect(applyProgress(1250, 'remove', 300)).toBe(950);
    expect(applyProgress(10, 'remove', 25)).toBe(0);
    expect(applyProgress(1250, 'set', 4000)).toBe(4000);
    expect(applyProgress(null, 'add', 2.5)).toBe(2.5);
    expect(applyProgress(0.1, 'add', 0.2)).toBe(0.3);
  });

  it('suggests nice amounts that fit the target', () => {
    expect(quickAmounts(5000)).toEqual([50, 100, 200, 500, 1000]);
    expect(quickAmounts(10)).toEqual([1, 2, 5]);
    expect(quickAmounts(12)).toEqual([1, 2, 5]);
    expect(quickAmounts(2.5)).toEqual([0.05, 0.1, 0.2, 0.5]);
    expect(quickAmounts(100)).toEqual([1, 2, 5, 10, 20]);
  });
});
