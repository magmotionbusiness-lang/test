import { describe, expect, it } from 'vitest';
import type { Entry, EntryStatus, Schedule } from '@/db/types';
import { computeStreak } from './streaks';

function e(date: string, status: EntryStatus = 'done', extra: Partial<Entry> = {}): Entry {
  return { id: date, habitId: 'h', date, status, value: 1, note: '', createdAt: '', updatedAt: '', ...extra };
}

const daily: Schedule = { kind: 'daily' };

describe('fixed-schedule streaks', () => {
  it('counts consecutive done days', () => {
    const s = computeStreak({ schedule: daily, startDate: '2026-10-25' }, [e('2026-10-27'), e('2026-10-28'), e('2026-10-29')], '2026-10-29', 1);
    expect(s).toEqual({ current: 3, best: 3, unit: 'day' });
  });

  it('an unfinished today does not break the streak', () => {
    const s = computeStreak({ schedule: daily, startDate: '2026-10-27' }, [e('2026-10-27'), e('2026-10-28')], '2026-10-29', 1);
    expect(s.current).toBe(2);
  });

  it('a missed day breaks it, and best remembers the longest run', () => {
    const entries = [e('2026-10-20'), e('2026-10-21'), e('2026-10-22'), e('2026-10-24'), e('2026-10-25')];
    const s = computeStreak({ schedule: daily, startDate: '2026-10-20' }, entries, '2026-10-25', 1);
    expect(s).toMatchObject({ current: 2, best: 3 });
  });

  it('skipped days and freezes are neutral', () => {
    const entries = [e('2026-10-20'), e('2026-10-21', 'skipped'), e('2026-10-22'), e('2026-10-23', 'missed', { freeze: true }), e('2026-10-24')];
    const s = computeStreak({ schedule: daily, startDate: '2026-10-20' }, entries, '2026-10-24', 1);
    expect(s.current).toBe(3);
  });

  it('minimum-version days count as done', () => {
    const s = computeStreak({ schedule: daily, startDate: '2026-10-28' }, [e('2026-10-28', 'minimum'), e('2026-10-29')], '2026-10-29', 1);
    expect(s.current).toBe(2);
  });

  it('partial days break a streak', () => {
    const s = computeStreak({ schedule: daily, startDate: '2026-10-27' }, [e('2026-10-27'), e('2026-10-28', 'partial'), e('2026-10-29')], '2026-10-29', 1);
    expect(s.current).toBe(1);
  });

  it('ignores unscheduled days', () => {
    const mwf: Schedule = { kind: 'weekdays', days: [1, 3, 5] };
    // Mon 26, Wed 28, Fri 30 done; Tue/Thu not scheduled.
    const s = computeStreak({ schedule: mwf, startDate: '2026-10-26' }, [e('2026-10-26'), e('2026-10-28'), e('2026-10-30')], '2026-10-31', 1);
    expect(s.current).toBe(3);
  });

  it('works across a DST switch', () => {
    const entries = ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30'].map((d) => e(d));
    const s = computeStreak({ schedule: daily, startDate: '2026-03-27' }, entries, '2026-03-30', 1);
    expect(s.current).toBe(4);
  });
});

describe('flexible-schedule streaks', () => {
  const weekly: Schedule = { kind: 'timesPerWeek', times: 2 };

  it('counts consecutive weeks that met the quota', () => {
    // Weeks (Mon start): Oct 12, Oct 19, Oct 26 (current).
    const entries = [e('2026-10-13'), e('2026-10-15'), e('2026-10-20'), e('2026-10-22')];
    const s = computeStreak({ schedule: weekly, startDate: '2026-10-12' }, entries, '2026-10-27', 1);
    expect(s).toEqual({ current: 2, best: 2, unit: 'week' });
  });

  it('a week short of quota breaks the streak', () => {
    const entries = [e('2026-10-13'), e('2026-10-15'), e('2026-10-20')];
    const s = computeStreak({ schedule: weekly, startDate: '2026-10-12' }, entries, '2026-10-27', 1);
    expect(s).toMatchObject({ current: 0, best: 1 });
  });

  it('respects the week-start setting', () => {
    // Sun Oct 18 + Mon Oct 19: same week if Sunday-start, different weeks if Monday-start.
    const entries = [e('2026-10-18'), e('2026-10-19')];
    expect(computeStreak({ schedule: weekly, startDate: '2026-10-18' }, entries, '2026-10-24', 0).current).toBe(1);
    expect(computeStreak({ schedule: weekly, startDate: '2026-10-18' }, entries, '2026-10-24', 1).current).toBe(0);
  });
});
