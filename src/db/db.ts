import Dexie, { type Table } from 'dexie';
import type { AIReview, DailyNote, Entry, Goal, Habit, Section, Settings } from './types';

/**
 * Local IndexedDB store. Screens never touch this directly — they go through
 * `src/db/repo.ts`, so a sync backend can be slotted in later.
 *
 * Schema changes: add a new `this.version(n)` block with an `upgrade()` that
 * transforms existing rows. Never edit or remove an old version block.
 */
export class HabitHubDB extends Dexie {
  sections!: Table<Section, string>;
  habits!: Table<Habit, string>;
  entries!: Table<Entry, string>;
  dailyNotes!: Table<DailyNote, string>;
  goals!: Table<Goal, string>;
  aiReviews!: Table<AIReview, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'habit-hub') {
    super(name);
    this.version(1).stores({
      sections: 'id, order, archived, updatedAt',
      habits: 'id, sectionId, order, archived, updatedAt',
      entries: 'id, &[habitId+date], habitId, date, updatedAt',
      dailyNotes: 'id, &date, updatedAt',
      goals: 'id, status, deadline, updatedAt',
      aiReviews: 'id, &inputHash, scope, rangeStart, updatedAt',
      settings: 'id',
    });
  }
}

export const db = new HabitHubDB();
