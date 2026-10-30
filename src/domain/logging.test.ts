import { describe, expect, it } from 'vitest';
import { presetsFor, progressOf, tapEntry, valueEntry } from './logging';

describe('tapEntry', () => {
  it('toggles check and avoid habits', () => {
    for (const type of ['check', 'avoid'] as const) {
      const h = { type, target: 1 };
      expect(tapEntry(h, undefined)).toEqual({ value: 1, status: 'done' });
      expect(tapEntry(h, { value: 1, status: 'done' })).toBeNull();
    }
  });

  it('counts up to the target, then resets', () => {
    const h = { type: 'count' as const, target: 3 };
    let cur = tapEntry(h, undefined);
    expect(cur).toEqual({ value: 1, status: 'partial' });
    cur = tapEntry(h, cur!);
    cur = tapEntry(h, cur!);
    expect(cur).toEqual({ value: 3, status: 'done' });
    expect(tapEntry(h, cur!)).toBeNull();
  });

  it('counts from zero after a skip', () => {
    expect(tapEntry({ type: 'count', target: 3 }, { value: 0, status: 'skipped' })).toEqual({ value: 1, status: 'partial' });
  });

  it('logs the full target for duration and numeric', () => {
    const h = { type: 'duration' as const, target: 10 };
    expect(tapEntry(h, undefined)).toEqual({ value: 10, status: 'done' });
    expect(tapEntry(h, { value: 10, status: 'done' })).toBeNull();
  });
});

describe('valueEntry and progress', () => {
  const h = { type: 'numeric' as const, target: 20 };
  it('maps amounts to statuses', () => {
    expect(valueEntry(h, 0)).toBeNull();
    expect(valueEntry(h, 5)).toEqual({ value: 5, status: 'partial' });
    expect(valueEntry(h, 25)).toEqual({ value: 25, status: 'done' });
  });
  it('computes progress', () => {
    expect(progressOf(h, { value: 5, status: 'partial' })).toBe(0.25);
    expect(progressOf(h, { value: 1, status: 'minimum' })).toBe(0.5);
    expect(progressOf(h, undefined)).toBe(0);
  });
  it('offers sensible presets', () => {
    expect(presetsFor({ type: 'duration', target: 90 })).toEqual([25, 45, 90, 135]);
    expect(presetsFor({ type: 'count', target: 8 })).toEqual([2, 4, 8, 12]);
  });
});
