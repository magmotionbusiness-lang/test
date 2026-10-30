import { describe, expect, it } from 'vitest';
import type { Entry, EntryStatus, Schedule } from '@/db/types';
import { dailyShare } from './aggregate';

function e(habitId: string, date: string, status: EntryStatus = 'done'): Entry {
  return { id: `${habitId}${date}`, habitId, date, status, value: 1, note: '', createdAt: '', updatedAt: '' };
}
const h = (id: string, schedule: Schedule = { kind: 'daily' }) => ({ id, schedule, startDate: '2026-10-01', archived: false });

describe('dailyShare', () => {
  it('computes the share of due habits done each day', () => {
    const m = dailyShare([h('a'), h('b')], [e('a', '2026-10-26'), e('a', '2026-10-27'), e('b', '2026-10-27')], '2026-10-26', '2026-10-28', 1);
    expect(m.get('2026-10-26')!.progress).toBe(0.5);
    expect(m.get('2026-10-27')!.progress).toBe(1);
    expect(m.get('2026-10-28')!.progress).toBe(0);
  });
  it('drops skipped habits and met flexible quotas from the denominator', () => {
    const weekly = h('w', { kind: 'timesPerWeek', times: 1 });
    const entries = [e('a', '2026-10-26', 'skipped'), e('w', '2026-10-26'), e('a', '2026-10-27')];
    const m = dailyShare([h('a'), weekly], entries, '2026-10-26', '2026-10-27', 1);
    expect(m.get('2026-10-26')!.progress).toBe(1); // only w due (a skipped), w done
    expect(m.get('2026-10-27')!.progress).toBe(1); // w quota met → not due; a done
  });
  it('marks days with nothing due as unscheduled', () => {
    const m = dailyShare([h('a', { kind: 'weekdays', days: [1] })], [], '2026-10-27', '2026-10-27', 1);
    expect(m.get('2026-10-27')!.state).toBe('unscheduled');
  });
});
