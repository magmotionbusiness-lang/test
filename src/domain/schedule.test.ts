import { describe, expect, it } from 'vitest';
import { describeSchedule, isDueOn, isScheduledOn, periodKey } from './schedule';

const base = { startDate: '2026-01-01', archived: false };

describe('schedule', () => {
  it('daily is always scheduled', () => {
    expect(isScheduledOn({ kind: 'daily' }, '2026-10-30')).toBe(true);
  });

  it('weekdays matches only listed days', () => {
    const s = { kind: 'weekdays' as const, days: [1, 3, 5] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[] };
    expect(isScheduledOn(s, '2026-10-26')).toBe(true); // Mon
    expect(isScheduledOn(s, '2026-10-27')).toBe(false); // Tue
    expect(isScheduledOn(s, '2026-10-30')).toBe(true); // Fri
  });

  it('flexible habits are due until the quota is met', () => {
    const habit = { ...base, schedule: { kind: 'timesPerWeek' as const, times: 3 } };
    expect(isDueOn(habit, '2026-10-30', 2)).toBe(true);
    expect(isDueOn(habit, '2026-10-30', 3)).toBe(false);
  });

  it('habits are not due before start or when archived', () => {
    const habit = { schedule: { kind: 'daily' as const }, startDate: '2026-11-01', archived: false };
    expect(isDueOn(habit, '2026-10-30')).toBe(false);
    expect(isDueOn({ ...habit, startDate: '2026-01-01', archived: true }, '2026-10-30')).toBe(false);
  });

  it('period keys group by week or month', () => {
    const week = { kind: 'timesPerWeek' as const, times: 2 };
    expect(periodKey(week, '2026-10-26', 1)).toBe(periodKey(week, '2026-11-01', 1));
    expect(periodKey(week, '2026-11-01', 1)).not.toBe(periodKey(week, '2026-11-02', 1));
    const month = { kind: 'timesPerMonth' as const, times: 4 };
    expect(periodKey(month, '2026-10-01', 1)).toBe('2026-10');
  });

  it('describes schedules in plain words', () => {
    expect(describeSchedule({ kind: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe('Weekdays');
    expect(describeSchedule({ kind: 'weekdays', days: [5, 1] })).toBe('Mon, Fri');
    expect(describeSchedule({ kind: 'timesPerMonth', times: 4 })).toBe('4× a month');
  });
});
