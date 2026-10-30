import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { generateDemoData } from './demo';
import { HabitHubDB } from './db';
import { isScheduledOn } from '@/domain/schedule';
import { todayGroups } from '@/domain/today';

describe('demo data', () => {
  const data = generateDemoData('2026-10-30');

  it('seeds 4 sections and 12 habits', () => {
    expect(data.sections).toHaveLength(4);
    expect(data.habits).toHaveLength(12);
  });

  it('has roughly six months of entries, none in the future or off-schedule', () => {
    expect(data.entries.length).toBeGreaterThan(800);
    const habits = new Map(data.habits.map((h) => [h.id, h]));
    for (const e of data.entries) {
      expect(e.date < '2026-10-30').toBe(true);
      expect(isScheduledOn(habits.get(e.habitId)!.schedule, e.date)).toBe(true);
    }
  });

  it('keeps one entry per habit per day', () => {
    const keys = new Set(data.entries.map((e) => `${e.habitId}|${e.date}`));
    expect(keys.size).toBe(data.entries.length);
  });

  it('links goals to habits both ways', () => {
    for (const g of data.goals) for (const hid of g.habitIds) expect(data.habits.find((h) => h.id === hid)!.goalIds).toContain(g.id);
  });

  it('writes into IndexedDB with the v1 schema', async () => {
    const db = new HabitHubDB('test-demo');
    await db.habits.bulkAdd(data.habits);
    await db.entries.bulkAdd(data.entries);
    expect(await db.habits.count()).toBe(12);
    expect(await db.entries.count()).toBe(data.entries.length);
    db.close();
  });

  it('produces a Home list for today', () => {
    const groups = todayGroups(data.habits, data.entries, '2026-10-30', 1);
    expect(groups.flatMap((g) => g.items).length).toBeGreaterThan(5);
    expect(groups.map((g) => g.timeOfDay)).toEqual(['morning', 'evening', 'anytime']);
  });
});
