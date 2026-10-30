import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { freezesLeft } from '@/domain/freezes';
import { monthKey } from '@/domain/dates';
import type { LocalDate } from '@/db/types';

/** Streak freezes left in the month of `date` (shared by all habits). */
export function useFreezesLeft(date: LocalDate | null): number {
  const m = date ? monthKey(date) : '';
  return (
    useLiveQuery(async () => {
      if (!date) return 0;
      const entries = await db.entries.where('date').between(`${m}-01`, `${m}-31`, true, true).toArray();
      return freezesLeft(entries, date);
    }, [m]) ?? 0
  );
}
