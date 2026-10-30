import { describe, expect, it } from 'vitest';
import { daysBetween, eachDay, fromLocalDate, shiftDate, toLocalDate, weekStartOf, weekdayOf } from './dates';

describe('dates', () => {
  it('round-trips local dates', () => {
    expect(toLocalDate(fromLocalDate('2026-03-29'))).toBe('2026-03-29');
  });

  it('shifts across month and year boundaries', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
  });

  // EU (last Sunday in March / October) and US (2nd Sunday in March, 1st in November) DST switches.
  it.each([
    ['2026-03-28', '2026-03-30'],
    ['2026-10-24', '2026-10-26'],
    ['2026-03-07', '2026-03-09'],
    ['2026-10-31', '2026-11-02'],
  ])('counts calendar days across DST: %s → %s', (a, b) => {
    expect(daysBetween(a, b)).toBe(2);
    expect(eachDay(a, b)).toHaveLength(3);
    expect(shiftDate(a, 2)).toBe(b);
  });

  it('computes weekdays and week starts', () => {
    expect(weekdayOf('2026-10-30')).toBe(5); // Friday
    expect(weekStartOf('2026-10-30', 1)).toBe('2026-10-26');
    expect(weekStartOf('2026-10-30', 0)).toBe('2026-10-25');
    expect(weekStartOf('2026-10-25', 1)).toBe('2026-10-19'); // Sunday belongs to previous Monday week
  });
});
