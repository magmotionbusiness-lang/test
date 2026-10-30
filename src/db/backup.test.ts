import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from './db';
import { generateDemoData } from './demo';
import { exportBackup, importBackup, parseBackup } from './backup';

describe('backup', () => {
  it('round-trips everything through export and import', async () => {
    const data = generateDemoData('2026-10-30');
    await db.habits.bulkAdd(data.habits);
    await db.sections.bulkAdd(data.sections);
    await db.entries.bulkAdd(data.entries);
    await db.goals.bulkAdd(data.goals);
    const text = await (await exportBackup()).text();

    await db.entries.clear();
    await db.habits.clear();
    const summary = await importBackup(parseBackup(text));
    expect(summary.habits).toBe(12);
    expect(await db.entries.count()).toBe(data.entries.length);
    expect((await db.settings.get('settings'))!.onboardingDone).toBe(true);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(/valid JSON/);
    expect(() => parseBackup('{"format":"other"}')).toThrow(/Habit Hub backup/);
  });
});
