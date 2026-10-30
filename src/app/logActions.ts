import { deleteEntry, getEntry, restoreEntry, upsertEntry } from '@/db/repo';
import type { Habit, LocalDate, WorkoutExercise } from '@/db/types';
import { tapEntry, valueEntry, type EntryPatch } from '@/domain/logging';
import { toast } from '@/components/Toast';

/**
 * Logging actions shared by Home rows, swipe actions and sheets. Every one
 * snapshots the previous state so the toast can offer Undo.
 */
async function apply(habit: Habit, date: LocalDate, patch: (Partial<EntryPatch> & { note?: string; workout?: undefined }) | null, message?: string) {
  const previous = await getEntry(habit.id, date);
  if (patch === null) await deleteEntry(habit.id, date);
  else await upsertEntry(habit.id, date, { ...patch, freeze: false });
  if (message) toast(message, () => restoreEntry(habit.id, date, previous));
}

export async function tapHabit(habit: Habit, date: LocalDate): Promise<void> {
  const current = await getEntry(habit.id, date);
  await apply(habit, date, tapEntry(habit, current));
}

export async function completeHabit(habit: Habit, date: LocalDate): Promise<void> {
  const value = habit.type === 'check' || habit.type === 'avoid' ? 1 : habit.target;
  await apply(habit, date, { value, status: 'done' }, `${habit.name} done`);
}

export async function setHabitValue(habit: Habit, date: LocalDate, value: number): Promise<void> {
  await apply(habit, date, valueEntry(habit, value));
}

export async function skipHabit(habit: Habit, date: LocalDate): Promise<void> {
  await apply(habit, date, { value: 0, status: 'skipped' }, `Skipped ${habit.name} — your streak is safe`);
}

export async function minimumHabit(habit: Habit, date: LocalDate): Promise<void> {
  const value = habit.type === 'check' || habit.type === 'avoid' ? 1 : Math.max(1, Math.round(habit.target * 0.25));
  await apply(habit, date, { value, status: 'minimum' }, `Minimum version logged`);
}

export async function clearHabit(habit: Habit, date: LocalDate): Promise<void> {
  await apply(habit, date, null, `${habit.name} cleared`);
}

export async function saveNote(habit: Habit, date: LocalDate, note: string): Promise<void> {
  const current = await getEntry(habit.id, date);
  // A note on a day with no result yet is stored on a "missed" entry; it keeps the day empty in grids.
  await upsertEntry(habit.id, date, current ? { note } : { note, status: 'missed', value: 0 });
}

export async function freezeDay(habit: Habit, date: LocalDate): Promise<void> {
  const previous = await getEntry(habit.id, date);
  await upsertEntry(habit.id, date, { status: 'missed', value: 0, freeze: true });
  toast('Streak freeze used — your streak is protected', () => restoreEntry(habit.id, date, previous));
}

export async function saveWorkout(habit: Habit, date: LocalDate, workout: WorkoutExercise[]): Promise<void> {
  const current = await getEntry(habit.id, date);
  const hasSets = workout.some((x) => x.sets.length > 0);
  // Logging a workout marks a check-type gym habit as done.
  const patch =
    hasSets && !(current?.status === 'done' || current?.status === 'minimum')
      ? { status: 'done' as const, value: habit.type === 'check' ? 1 : current?.value || habit.target }
      : {};
  await upsertEntry(habit.id, date, { ...patch, workout, freeze: false });
}
