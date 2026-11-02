import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { HabitHubDB } from './db';

describe('schema migrations', () => {
  it('upgrading from v1 keeps every row', async () => {
    const name = 'migrate-test';
    const v1 = new Dexie(name);
    v1.version(1).stores({
      sections: 'id, order, archived, updatedAt',
      habits: 'id, sectionId, order, archived, updatedAt',
      entries: 'id, &[habitId+date], habitId, date, updatedAt',
      dailyNotes: 'id, &date, updatedAt',
      goals: 'id, status, deadline, updatedAt',
      aiReviews: 'id, &inputHash, scope, rangeStart, updatedAt',
      settings: 'id',
    });
    await v1.table('habits').add({ id: 'h1', sectionId: 's1', order: 0, archived: false, updatedAt: '' });
    await v1.table('entries').add({ id: 'e1', habitId: 'h1', date: '2026-11-01', updatedAt: '' });
    v1.close();

    const db = new HabitHubDB(name);
    expect(await db.habits.count()).toBe(1);
    expect(await db.entries.get('e1')).toBeDefined();
    await db.blobs.put({ id: 'sound', blob: new Blob(['x']), updatedAt: '' });
    expect(await db.blobs.count()).toBe(1);
    db.close();
  });
});
