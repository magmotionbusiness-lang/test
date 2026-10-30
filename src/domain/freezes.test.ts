import { describe, expect, it } from 'vitest';
import { canFreeze, freezesLeft } from './freezes';

describe('streak freezes', () => {
  it('allows two per calendar month across habits', () => {
    const entries = [{ date: '2026-10-03', freeze: true }, { date: '2026-10-20', freeze: true }, { date: '2026-09-30', freeze: true }];
    expect(freezesLeft(entries, '2026-10-29')).toBe(0);
    expect(freezesLeft(entries, '2026-09-15')).toBe(1);
    expect(freezesLeft(entries, '2026-11-01')).toBe(2);
  });
  it('only covers past unplanned misses', () => {
    expect(canFreeze(undefined, '2026-10-29', '2026-10-30')).toBe(true);
    expect(canFreeze({ status: 'missed' }, '2026-10-29', '2026-10-30')).toBe(true);
    expect(canFreeze({ status: 'done' }, '2026-10-29', '2026-10-30')).toBe(false);
    expect(canFreeze({ status: 'skipped' }, '2026-10-29', '2026-10-30')).toBe(false);
    expect(canFreeze(undefined, '2026-10-30', '2026-10-30')).toBe(false);
    expect(canFreeze({ status: 'missed', freeze: true }, '2026-10-29', '2026-10-30')).toBe(false);
  });
});
