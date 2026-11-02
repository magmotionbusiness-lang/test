import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '@/db/db';
import { shiftDate, today as todayFn } from '@/domain/dates';
import { todayGroups } from '@/domain/today';
import type { Settings } from '@/db/types';

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function badgeSupported(): boolean {
  return typeof (navigator as BadgeNavigator).setAppBadge === 'function';
}

/**
 * Keeps the Home Screen icon badge at the number of habits still to do today.
 * iOS web apps can only update it while the app is open, so it refreshes on
 * every change and whenever the app comes back to the foreground.
 */
export function useAppBadge(settings: Settings): void {
  const today = todayFn();
  const remaining = useLiveQuery(async () => {
    if (!settings.appBadge) return null;
    const [habits, entries] = await Promise.all([
      db.habits.filter((h) => !h.archived).toArray(),
      db.entries.where('date').between(shiftDate(today, -31), today, true, true).toArray(),
    ]);
    return todayGroups(habits, entries, today, settings.weekStart)
      .flatMap((g) => g.items)
      .filter((i) => !i.completed && i.entry?.status !== 'skipped').length;
  }, [settings.appBadge, settings.weekStart, today]);

  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!badgeSupported()) return;
    if (!settings.appBadge || remaining === null || remaining === undefined || remaining === 0) void nav.clearAppBadge?.().catch(() => undefined);
    else void nav.setAppBadge?.(remaining).catch(() => undefined);
  }, [settings.appBadge, remaining]);
}
