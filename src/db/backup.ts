import { z } from 'zod';
import { db } from './db';
import { DEFAULT_SETTINGS, updateSettings } from './repo';
import { nowIso } from '@/lib/id';

const FORMAT = 'habit-hub-backup';
const VERSION = 1;

const rows = z.array(z.record(z.unknown()).and(z.object({ id: z.string() })));

const backupSchema = z.object({
  format: z.literal(FORMAT),
  version: z.number().int().min(1).max(VERSION),
  exportedAt: z.string(),
  data: z.object({
    sections: rows,
    habits: rows,
    entries: rows,
    dailyNotes: rows,
    goals: rows,
    aiReviews: rows.optional(),
    settings: rows.optional(),
  }),
});

export async function exportBackup(): Promise<Blob> {
  const [sections, habits, entries, dailyNotes, goals, aiReviews, settings] = await Promise.all([
    db.sections.toArray(),
    db.habits.toArray(),
    db.entries.toArray(),
    db.dailyNotes.toArray(),
    db.goals.toArray(),
    db.aiReviews.toArray(),
    db.settings.toArray(),
  ]);
  const body = {
    format: FORMAT,
    version: VERSION,
    exportedAt: nowIso(),
    data: { sections, habits, entries, dailyNotes, goals, aiReviews, settings },
  };
  await updateSettings({ lastBackupAt: nowIso() });
  return new Blob([JSON.stringify(body)], { type: 'application/json' });
}

export function backupFileName(): string {
  return `habit-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export interface ImportSummary {
  sections: number;
  habits: number;
  entries: number;
}

/** Parses and validates a backup without touching the database. */
export function parseBackup(text: string): z.infer<typeof backupSchema> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) throw new Error('That file isn’t a Habit Hub backup.');
  return parsed.data;
}

/** Replaces everything on the device with the backup's contents. */
export async function importBackup(backup: z.infer<typeof backupSchema>): Promise<ImportSummary> {
  const d = backup.data;
  await db.transaction('rw', db.tables, async () => {
    // Keep the user's own files (e.g. their completion sound); backups don't carry them.
    await Promise.all(db.tables.filter((t) => t.name !== 'blobs').map((t) => t.clear()));
    await db.sections.bulkPut(d.sections as never[]);
    await db.habits.bulkPut(d.habits as never[]);
    await db.entries.bulkPut(d.entries as never[]);
    await db.dailyNotes.bulkPut(d.dailyNotes as never[]);
    await db.goals.bulkPut(d.goals as never[]);
    if (d.aiReviews) await db.aiReviews.bulkPut(d.aiReviews as never[]);
    const s = d.settings?.find((x) => x.id === 'settings');
    await db.settings.put({ ...DEFAULT_SETTINGS, ...(s as object), id: 'settings', onboardingDone: true, updatedAt: nowIso() });
  });
  return { sections: d.sections.length, habits: d.habits.length, entries: d.entries.length };
}

/** Saves a file via the share sheet when available (iOS), else a download. */
export async function saveFile(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
