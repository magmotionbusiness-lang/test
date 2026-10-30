import { describe, expect, it } from 'vitest';
import type { Entry, EntryStatus, Schedule, WorkoutExercise } from '@/db/types';
import { freezeCandidates, groupConsistency, groupWeekdayRates, personalRecords, weekOverWeek, weeklyVolume, workoutSessions } from './analytics';

function e(habitId: string, date: string, status: EntryStatus = 'done', workout?: WorkoutExercise[]): Entry {
  return { id: `${habitId}${date}`, habitId, date, status, value: 1, note: '', createdAt: '', updatedAt: '', workout };
}
const h = (id: string, schedule: Schedule = { kind: 'daily' }, startDate = '2026-10-01') => ({
  id,
  schedule,
  startDate,
  type: 'check' as const,
  target: 1,
});

describe('group analytics', () => {
  it('pools consistency across habits', () => {
    const entries = [e('a', '2026-10-26'), e('a', '2026-10-27'), e('b', '2026-10-26')];
    expect(groupConsistency([h('a'), h('b')], entries, '2026-10-26', '2026-10-27', '2026-10-30', 1)).toBe(0.75);
  });
  it('compares this week with last week', () => {
    const entries = [e('a', '2026-10-19'), e('a', '2026-10-26'), e('a', '2026-10-27')];
    const w = weekOverWeek([h('a')], entries, '2026-10-28', 1);
    expect(w.thisWeek).toBe(1); // 26, 27 done; today 28 not yet counted
    expect(w.lastWeek).toBeCloseTo(1 / 7);
  });
  it('pools weekday rates', () => {
    const r = groupWeekdayRates([h('a'), h('b')], [e('a', '2026-10-26'), e('b', '2026-10-26')], '2026-10-26', '2026-10-27', '2026-10-30');
    expect(r[1]).toBe(1);
    expect(r[2]).toBe(0);
  });
});

describe('gym analytics', () => {
  const w1: WorkoutExercise[] = [
    {
      name: 'Bench press',
      sets: [
        { reps: 5, weight: 80 },
        { reps: 5, weight: 80 },
      ],
    },
  ];
  const w2: WorkoutExercise[] = [
    { name: 'Bench press', sets: [{ reps: 3, weight: 85 }] },
    { name: 'Squat', sets: [{ reps: 5, weight: 100 }] },
  ];
  const entries = [e('g', '2026-10-20', 'done', w1), e('g', '2026-10-27', 'done', w2)];

  it('lists sessions newest first with volume', () => {
    const s = workoutSessions(entries);
    expect(s[0]!.date).toBe('2026-10-27');
    expect(s[0]!.volume).toBe(3 * 85 + 5 * 100);
    expect(s[1]!.volume).toBe(800);
  });
  it('sums volume per week', () => {
    const v = weeklyVolume(entries, 2, '2026-10-30', 1);
    expect(v.map((x) => x.volume)).toEqual([800, 755]);
  });
  it('finds personal records', () => {
    const pr = personalRecords(entries);
    const bench = pr.find((p) => p.exercise === 'Bench press')!;
    expect(bench).toMatchObject({ weight: 85, reps: 3, date: '2026-10-27' });
    expect(bench.estimated1RM).toBeCloseTo(93.5);
  });
});

describe('freezeCandidates', () => {
  it('offers a freeze when yesterday broke a streak of 3+', () => {
    const entries = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'].map((d) => e('a', d));
    const c = freezeCandidates([h('a')], entries, '2026-10-30', 1);
    expect(c).toHaveLength(1);
    expect(c[0]!.streak).toBe(4);
  });
  it('does not offer one for short streaks, logged days or unscheduled days', () => {
    expect(freezeCandidates([h('a')], [e('a', '2026-10-28')], '2026-10-30', 1)).toHaveLength(0);
    const done = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].map((d) => e('a', d));
    expect(freezeCandidates([h('a')], done, '2026-10-30', 1)).toHaveLength(0);
    // Mon/Wed/Fri habit; yesterday (Thu 29) wasn't scheduled.
    const mwf = h('m', { kind: 'weekdays', days: [1, 3, 5] });
    const mwfEntries = ['2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28'].map((d) => e('m', d));
    expect(freezeCandidates([mwf], mwfEntries, '2026-10-30', 1)).toHaveLength(0);
  });
});
