import { useEffect, useState } from 'react';
import { clearHabit, completeHabit, freezeDay, minimumHabit, saveNote, saveWorkout, setHabitValue, skipHabit } from '@/app/logActions';
import type { Entry, Habit, LocalDate, WorkoutExercise } from '@/db/types';
import { formatDay } from '@/domain/dates';
import { canFreeze } from '@/domain/freezes';
import { isQuantity } from '@/domain/logging';
import { Sheet } from './Sheet';
import { WorkoutEditor } from './WorkoutEditor';

interface Props {
  habit: Habit;
  date: LocalDate | null;
  entry: Entry | undefined;
  today: LocalDate;
  freezesLeft: number;
  isGym: boolean;
  exerciseNames: string[];
  onClose: () => void;
}

const STATUS_TEXT: Record<Entry['status'], string> = {
  done: 'Done',
  partial: 'Partly done',
  minimum: 'Minimum version',
  skipped: 'Skipped (planned rest)',
  missed: 'Not done',
};

/** Everything about one habit on one day: result, amount, note, workout, freeze. */
export function DaySheet({ habit, date, entry, today, freezesLeft, isGym, exerciseNames, onClose }: Props) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [workout, setWorkout] = useState<WorkoutExercise[]>([]);

  useEffect(() => {
    if (!date) return;
    setNote(entry?.note ?? '');
    setAmount(entry && entry.value > 0 && entry.status !== 'skipped' ? String(entry.value) : '');
    setWorkout(entry?.workout ?? []);
    // Reset only when a different day opens, so live updates don't clobber typing.
  }, [date]);

  if (!date)
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    );

  const status = entry?.freeze ? 'Covered by a streak freeze' : entry ? STATUS_TEXT[entry.status] : date > today ? 'Upcoming' : 'Not done';
  const quantity = isQuantity(habit.type);

  const save = async () => {
    if (quantity && amount !== String(entry?.value ?? '')) {
      const v = Number(amount.replace(',', '.'));
      if (amount === '' && entry) await clearHabit(habit, date);
      else if (Number.isFinite(v)) await setHabitValue(habit, date, v);
    }
    if (note.trim() !== (entry?.note ?? '')) await saveNote(habit, date, note.trim());
    if (isGym && JSON.stringify(workout) !== JSON.stringify(entry?.workout ?? [])) {
      await saveWorkout(
        habit,
        date,
        workout.filter((w) => w.name.trim()).map((w) => ({ ...w, name: w.name.trim() })),
      );
    }
    onClose();
  };

  const act = (fn: () => Promise<void>) => async () => {
    await fn();
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={formatDay(date, date === today ? "'Today', d MMM" : 'EEE d MMM yyyy')}
      action={
        <button onClick={save} className="text-headline text-accent">
          Save
        </button>
      }
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="text-[28px]" aria-hidden>
          {habit.emoji}
        </span>
        <div>
          <div className="text-headline">{habit.name}</div>
          <div className="text-subhead text-secondary">
            {status}
            {entry && quantity && entry.value > 0 && entry.status !== 'skipped' ? ` · ${entry.value} ${habit.unit}` : ''}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <QuickButton onClick={act(() => completeHabit(habit, date))}>Mark done</QuickButton>
        <QuickButton onClick={act(() => minimumHabit(habit, date))}>Minimum version</QuickButton>
        <QuickButton onClick={act(() => skipHabit(habit, date))}>Skip (rest day)</QuickButton>
        {entry ? (
          <QuickButton onClick={act(() => clearHabit(habit, date))} danger>
            Clear day
          </QuickButton>
        ) : (
          <span />
        )}
        {canFreeze(entry, date, today) && (
          <button
            disabled={freezesLeft === 0}
            onClick={act(() => freezeDay(habit, date))}
            className="col-span-2 h-11 rounded-[12px] bg-[color-mix(in_srgb,var(--c-cyan)_16%,transparent)] text-subhead font-semibold text-[var(--c-cyan)] disabled:opacity-40"
          >
            🧊 Use a streak freeze ({freezesLeft} left this month)
          </button>
        )}
      </div>

      {quantity && (
        <label className="mb-5 flex min-h-[44px] items-center gap-3 rounded-row bg-bg-2 px-4">
          <span className="flex-1 text-body">Amount</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            className="tabular w-24 bg-transparent text-right text-body outline-none"
          />
          <span className="text-body text-secondary">
            / {habit.target} {habit.unit}
          </span>
        </label>
      )}

      <h3 className="mb-1.5 px-4 text-footnote uppercase text-secondary">Note</h3>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="How did it go?"
        aria-label="Note"
        className="mb-5 w-full resize-none rounded-row bg-bg-2 p-4 text-body outline-none"
      />

      {isGym && (
        <>
          <h3 className="mb-1.5 px-4 text-footnote uppercase text-secondary">Workout</h3>
          <WorkoutEditor value={workout} onChange={setWorkout} suggestions={exerciseNames} />
        </>
      )}
    </Sheet>
  );
}

function QuickButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`h-11 rounded-[12px] bg-bg-2 text-subhead font-medium ${danger ? 'text-danger-text' : 'text-accent'}`}>
      {children}
    </button>
  );
}
