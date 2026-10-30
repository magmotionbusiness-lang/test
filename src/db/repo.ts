import { db } from './db';
import type { DailyNote, Entry, Goal, Habit, LocalDate, Section, Settings } from './types';
import { nowIso, uuid } from '@/lib/id';

/**
 * The only module screens use to read and write data. Every write stamps
 * `updatedAt`, which a future sync backend (e.g. Supabase) can use for
 * last-write-wins reconciliation without screens changing.
 */

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'system',
  weekStart: 1,
  accent: 'blue',
  aiDailyLimit: 20,
  aiCallsToday: 0,
  aiCallsDate: null,
  includeNotesInAI: false,
  onboardingDone: false,
  installGuideSeen: false,
  lastBackupAt: null,
  updatedAt: new Date(0).toISOString(),
};

type New<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

function stamp<T>(data: New<T>): T {
  const now = nowIso();
  return { ...data, id: data.id ?? uuid(), createdAt: now, updatedAt: now } as T;
}

// Settings ------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings', updatedAt: nowIso() });
}

// Sections ------------------------------------------------------------------

export async function createSection(data: New<Section>): Promise<Section> {
  const section = stamp<Section>(data);
  await db.sections.add(section);
  return section;
}

export async function updateSection(id: string, patch: Partial<Section>): Promise<void> {
  await db.sections.update(id, { ...patch, updatedAt: nowIso() });
}

// Habits --------------------------------------------------------------------

export async function createHabit(data: New<Habit>): Promise<Habit> {
  const habit = stamp<Habit>(data);
  await db.habits.add(habit);
  return habit;
}

export async function updateHabit(id: string, patch: Partial<Habit>): Promise<void> {
  await db.habits.update(id, { ...patch, updatedAt: nowIso() });
}

// Entries -------------------------------------------------------------------

export async function getEntry(habitId: string, date: LocalDate): Promise<Entry | undefined> {
  return db.entries.where('[habitId+date]').equals([habitId, date]).first();
}

/** Insert or replace the single entry for (habit, day). */
export async function upsertEntry(
  habitId: string,
  date: LocalDate,
  patch: Partial<Omit<Entry, 'id' | 'habitId' | 'date'>>,
): Promise<Entry> {
  const existing = await getEntry(habitId, date);
  if (existing) {
    const next = { ...existing, ...patch, updatedAt: nowIso() };
    await db.entries.put(next);
    return next;
  }
  const entry = stamp<Entry>({ habitId, date, value: 0, status: 'missed', note: '', ...patch });
  await db.entries.add(entry);
  return entry;
}

export async function deleteEntry(habitId: string, date: LocalDate): Promise<void> {
  await db.entries.where('[habitId+date]').equals([habitId, date]).delete();
}

// Daily notes ----------------------------------------------------------------

export async function upsertDailyNote(date: LocalDate, patch: Partial<DailyNote>): Promise<void> {
  const existing = await db.dailyNotes.where('date').equals(date).first();
  if (existing) await db.dailyNotes.put({ ...existing, ...patch, updatedAt: nowIso() });
  else await db.dailyNotes.add(stamp<DailyNote>({ date, mood: null, energy: null, text: '', ...patch }));
}

// Goals ---------------------------------------------------------------------

export async function createGoal(data: New<Goal>): Promise<Goal> {
  const goal = stamp<Goal>(data);
  await db.goals.add(goal);
  return goal;
}

// Whole-database operations --------------------------------------------------

export async function eraseAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

export async function hasAnyData(): Promise<boolean> {
  return (await db.habits.count()) > 0;
}

/** Puts a day back exactly as it was (used by Undo). */
export async function restoreEntry(habitId: string, date: LocalDate, previous: Entry | undefined): Promise<void> {
  if (previous) await db.entries.put(previous);
  else await deleteEntry(habitId, date);
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.entries.where('habitId').equals(id).delete();
    await db.habits.delete(id);
  });
}

export async function deleteSection(id: string): Promise<void> {
  const habits = await db.habits.where('sectionId').equals(id).toArray();
  for (const h of habits) await deleteHabit(h.id);
  await db.sections.delete(id);
}

/** Persists a new order for sections or habits after a drag reorder. */
export async function reorder(table: 'sections' | 'habits', ids: string[]): Promise<void> {
  const now = nowIso();
  const t = db.table<{ id: string; order: number; updatedAt: string }, string>(table);
  await db.transaction('rw', t, async () => {
    await Promise.all(ids.map((id, order) => t.update(id, { order, updatedAt: now })));
  });
}

export async function nextOrder(table: 'sections' | 'habits', sectionId?: string): Promise<number> {
  const rows = sectionId ? await db.habits.where('sectionId').equals(sectionId).toArray() : await db[table].toArray();
  return rows.reduce((m, r) => Math.max(m, r.order + 1), 0);
}
