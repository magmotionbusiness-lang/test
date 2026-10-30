import { describe, expect, it } from 'vitest';
import type { Entry, EntryStatus, Schedule } from '@/db/types';
import { consistency, quantityStats, tileFor, weekdayRates } from './score';

function e(date: string, status: EntryStatus = 'done', value = 1, extra: Partial<Entry> = {}): Entry {
  return { id: date, habitId: 'h', date, status, value, note: '', createdAt: '', updatedAt: '', ...extra };
}
const daily = { schedule: { kind: 'daily' } as Schedule, startDate: '2026-10-01', type: 'check' as const, target: 1 };

describe('tileFor', () => {
  const t = '2026-10-30';
  it('maps entries to states', () => {
    expect(tileFor(daily, e('2026-10-29'), '2026-10-29', t).state).toBe('done');
    expect(tileFor(daily, e('2026-10-29', 'minimum'), '2026-10-29', t).state).toBe('minimum');
    expect(tileFor(daily, e('2026-10-29', 'skipped'), '2026-10-29', t).state).toBe('skipped');
    expect(tileFor(daily, e('2026-10-29', 'missed', 0, { freeze: true }), '2026-10-29', t).state).toBe('skipped');
    expect(tileFor(daily, undefined, '2026-10-29', t).state).toBe('missed');
    expect(tileFor(daily, undefined, '2026-10-31', t).state).toBe('future');
    expect(tileFor(daily, undefined, '2026-09-01', t).state).toBe('unscheduled');
  });
  it('computes partial progress', () => {
    const h = { ...daily, type: 'count' as const, target: 4 };
    expect(tileFor(h, e('2026-10-29', 'partial', 1), '2026-10-29', t)).toEqual({ state: 'partial', progress: 0.25 });
  });
  it('treats unscheduled weekdays and empty flexible days as quiet', () => {
    const mwf = { ...daily, schedule: { kind: 'weekdays', days: [1, 3, 5] } as Schedule };
    expect(tileFor(mwf, undefined, '2026-10-27', t).state).toBe('unscheduled');
    const flex = { ...daily, schedule: { kind: 'timesPerWeek', times: 3 } as Schedule };
    expect(tileFor(flex, undefined, '2026-10-27', t).state).toBe('unscheduled');
  });
});

describe('consistency', () => {
  it('scores done days against scheduled days', () => {
    const entries = [e('2026-10-27'), e('2026-10-28')];
    const c = consistency(daily, entries, '2026-10-27', '2026-10-30', '2026-10-30', 1);
    // 27, 28 done; 29 missed; today (30) not counted until logged.
    expect(c.expected).toBe(3);
    expect(c.score).toBeCloseTo(2 / 3);
  });
  it('excludes skips and freezes, credits partials', () => {
    const h = { ...daily, type: 'count' as const, target: 4 };
    const entries = [e('2026-10-27', 'skipped', 0), e('2026-10-28', 'partial', 2), e('2026-10-29', 'missed', 0, { freeze: true })];
    const c = consistency(h, entries, '2026-10-27', '2026-10-29', '2026-10-30', 1);
    expect(c).toMatchObject({ expected: 1, earned: 0.5, score: 0.5 });
  });
  it('returns null before the habit started', () => {
    expect(consistency({ ...daily, startDate: '2026-11-01' }, [], '2026-10-01', '2026-10-30', '2026-10-30', 1).score).toBeNull();
  });
  it('handles weekly quotas, and the current week only helps', () => {
    const flex = { ...daily, schedule: { kind: 'timesPerWeek', times: 2 } as Schedule, startDate: '2026-10-12' };
    // Week of Oct 12: 2/2. Week of Oct 19: 1/2. Week of Oct 26 (current): 1 so far.
    const entries = [e('2026-10-13'), e('2026-10-15'), e('2026-10-21'), e('2026-10-27')];
    const c = consistency(flex, entries, '2026-10-12', '2026-10-30', '2026-10-30', 1);
    expect(c.expected).toBe(5);
    expect(c.earned).toBe(4);
  });
});

describe('quantityStats and weekdayRates', () => {
  it('totals, averages and trends', () => {
    const entries = [e('2026-10-29', 'done', 10), e('2026-10-28', 'partial', 4), e('2026-09-20', 'done', 7)];
    const s = quantityStats(entries, '2026-10-30');
    expect(s.total).toBe(21);
    expect(s.average).toBe(7);
    expect(s.trend).toBeCloseTo(1); // 14 vs 7
  });
  it('computes per-weekday rates', () => {
    // Mon 26 done, Tue 27 missed, Wed 28 done
    const r = weekdayRates({ ...daily, startDate: '2026-10-26' }, [e('2026-10-26'), e('2026-10-28')], '2026-10-26', '2026-10-28', '2026-10-30');
    expect(r[1]).toBe(1);
    expect(r[2]).toBe(0);
    expect(r[3]).toBe(1);
    expect(r[0]).toBeNull();
  });
});
