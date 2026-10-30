import { describe, expect, it } from 'vitest';
import type { Entry, Goal, Habit } from '@/db/types';
import { goalPace, goalProgress } from './goals';
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
