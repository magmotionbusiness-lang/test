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

describe('vision board', () => {
  it('creates the starter tiles once, even when asked twice at the same time', async () => {
    const { ensureVisionBoard } = await import('./repo');
    await db.vision.clear();
    await db.settings.clear();
    await Promise.all([ensureVisionBoard(), ensureVisionBoard()]);
    expect(await db.vision.count()).toBe(6);
    // Deleted tiles stay deleted.
    await db.vision.clear();
    await ensureVisionBoard();
    expect(await db.vision.count()).toBe(0);
  });

  it('carries tiles and their photos through a backup', async () => {
    const { createVisionSection, setVisionPhoto, updateVisionSection } = await import('./repo');
    await db.vision.clear();
    const tile = await createVisionSection({ title: 'Travel', emoji: '✈️', color: 'cyan' });
    await updateVisionSection(tile.id, { description: 'See Japan in spring', progress: 2 });
    await setVisionPhoto(tile.id, { blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }), aspect: 1.5 });
    const text = await (await exportBackup()).text();

    await db.vision.clear();
    await db.blobs.clear();
    await importBackup(parseBackup(text));
    const back = await db.vision.get(tile.id);
    expect(back).toMatchObject({ title: 'Travel', description: 'See Japan in spring', progress: 2, photoAspect: 1.5 });
    const photo = await db.blobs.get(back!.photoId!);
    expect([...new Uint8Array(await photo!.blob.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });
});
