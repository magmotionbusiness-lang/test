import { db } from './db';
import type { DailyNote, Entry, Goal, Habit, LocalDate, Section, Settings, VisionSection } from './types';
import { STARTER_SECTIONS } from '@/domain/vision';
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
export async function upsertEntry(habitId: string, date: LocalDate, patch: Partial<Omit<Entry, 'id' | 'habitId' | 'date'>>): Promise<Entry> {
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

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  await db.goals.update(id, { ...patch, updatedAt: nowIso() });
}

/** Links or unlinks a habit and a goal on both sides. */
export async function setHabitGoalLink(habitId: string, goalId: string, linked: boolean): Promise<void> {
  await db.transaction('rw', db.habits, db.goals, async () => {
    const [habit, goal] = await Promise.all([db.habits.get(habitId), db.goals.get(goalId)]);
    if (!habit || !goal) return;
    const now = nowIso();
    const toggle = (ids: string[], id: string) => (linked ? [...new Set([...ids, id])] : ids.filter((x) => x !== id));
    await db.habits.update(habitId, { goalIds: toggle(habit.goalIds, goalId), updatedAt: now });
    await db.goals.update(goalId, { habitIds: toggle(goal.habitIds, habitId), updatedAt: now });
  });
}

// Vision board ----------------------------------------------------------------

export const visionPhotoId = (sectionId: string) => `vision-photo:${sectionId}`;

/** Creates the starter tiles the first time the board opens. Safe to call repeatedly. */
export async function ensureVisionBoard(): Promise<void> {
  await db.transaction('rw', db.vision, db.settings, async () => {
    const settings = await getSettings();
    if (settings.visionSeeded) return;
    if ((await db.vision.count()) === 0) {
      const now = nowIso();
      await db.vision.bulkAdd(
        STARTER_SECTIONS.map((s, i) => ({
          ...s,
          id: uuid(),
          description: '',
          photoId: null,
          photoAspect: null,
          focusX: 50,
          focusY: 50,
          progress: 0,
          goalId: null,
          order: i,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
    await db.settings.put({ ...settings, visionSeeded: true, id: 'settings', updatedAt: nowIso() });
  });
}

export async function createVisionSection(data: Pick<VisionSection, 'title' | 'emoji' | 'color'>): Promise<VisionSection> {
  const last = await db.vision.orderBy('order').last();
  const section = stamp<VisionSection>({
    ...data,
    description: '',
    photoId: null,
    photoAspect: null,
    focusX: 50,
    focusY: 50,
    progress: 0,
    goalId: null,
    order: (last?.order ?? -1) + 1,
  });
  await db.vision.add(section);
  return section;
}

export async function updateVisionSection(id: string, patch: Partial<VisionSection>): Promise<void> {
  await db.vision.update(id, { ...patch, updatedAt: nowIso() });
}

/** Stores a prepared photo for a tile and centres it in the frame. */
export async function setVisionPhoto(id: string, photo: { blob: Blob; aspect: number }): Promise<void> {
  const photoId = visionPhotoId(id);
  await db.transaction('rw', db.blobs, db.vision, async () => {
    await db.blobs.put({ id: photoId, blob: photo.blob, updatedAt: nowIso() });
    await db.vision.update(id, { photoId, photoAspect: photo.aspect, focusX: 50, focusY: 50, updatedAt: nowIso() });
  });
}

export async function removeVisionPhoto(id: string): Promise<void> {
  await db.transaction('rw', db.blobs, db.vision, async () => {
    await db.blobs.delete(visionPhotoId(id));
    await db.vision.update(id, { photoId: null, photoAspect: null, updatedAt: nowIso() });
  });
}

export async function deleteVisionSection(id: string): Promise<void> {
  await db.transaction('rw', db.blobs, db.vision, async () => {
    await db.blobs.delete(visionPhotoId(id));
    await db.vision.delete(id);
  });
}
