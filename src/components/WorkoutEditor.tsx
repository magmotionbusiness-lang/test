import { Plus, Trash2, X } from 'lucide-react';
import type { WorkoutExercise } from '@/db/types';

interface Props {
  value: WorkoutExercise[];
  onChange: (w: WorkoutExercise[]) => void;
  /** Exercise names used before, offered as quick picks. */
  suggestions: string[];
}

/** Exercises with sets of reps × weight (kg). */
export function WorkoutEditor({ value, onChange, suggestions }: Props) {
  const update = (i: number, ex: WorkoutExercise) => onChange(value.map((v, j) => (j === i ? ex : v)));
  const unused = suggestions.filter((s) => !value.some((v) => v.name === s)).slice(0, 8);

  return (
    <div>
      {value.map((ex, i) => (
        <div key={i} className="mb-3 overflow-hidden rounded-row bg-bg-2">
          <div className="flex items-center gap-2 border-b border-[rgb(var(--separator)/0.29)] px-4">
            <input
              value={ex.name}
              onChange={(e) => update(i, { ...ex, name: e.target.value })}
              placeholder="Exercise"
              aria-label="Exercise name"
              className="h-11 min-w-0 flex-1 bg-transparent text-headline outline-none"
            />
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-11 w-11 items-center justify-center text-danger" aria-label={`Remove ${ex.name || 'exercise'}`}>
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
          {ex.sets.map((set, k) => (
            <div key={k} className="flex items-center gap-2 px-4 py-1">
              <span className="w-12 text-footnote text-secondary">Set {k + 1}</span>
              <NumberInput label={`Set ${k + 1} reps`} value={set.reps} onChange={(reps) => update(i, { ...ex, sets: ex.sets.map((s, m) => (m === k ? { ...s, reps } : s)) })} />
              <span className="text-secondary">×</span>
              <NumberInput label={`Set ${k + 1} weight`} value={set.weight} onChange={(weight) => update(i, { ...ex, sets: ex.sets.map((s, m) => (m === k ? { ...s, weight } : s)) })} />
              <span className="text-footnote text-secondary">kg</span>
              <button onClick={() => update(i, { ...ex, sets: ex.sets.filter((_, m) => m !== k) })} className="ml-auto flex h-11 w-9 items-center justify-center text-tertiary" aria-label={`Remove set ${k + 1}`}>
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
          <button
            onClick={() => update(i, { ...ex, sets: [...ex.sets, ex.sets[ex.sets.length - 1] ?? { reps: 8, weight: 20 }] })}
            className="flex h-11 w-full items-center gap-2 border-t border-[rgb(var(--separator)/0.29)] px-4 text-body text-accent"
          >
            <Plus size={18} aria-hidden /> Add set
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {unused.map((s) => (
          <button key={s} onClick={() => onChange([...value, { name: s, sets: [{ reps: 5, weight: 20 }] }])} className="h-9 rounded-full bg-bg-2 px-3 text-subhead">
            + {s}
          </button>
        ))}
        <button onClick={() => onChange([...value, { name: '', sets: [{ reps: 8, weight: 20 }] }])} className="h-9 rounded-full bg-accent px-3 text-subhead font-medium text-white">
          + Exercise
        </button>
      </div>
    </div>
  );
}

function NumberInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      inputMode="decimal"
      value={Number.isFinite(value) ? String(value) : ''}
      onChange={(e) => {
        const v = Number(e.target.value.replace(',', '.'));
        onChange(Number.isFinite(v) ? v : 0);
      }}
      aria-label={label}
      className="tabular h-9 w-16 rounded-[8px] bg-[rgb(var(--fill)/0.12)] text-center text-body outline-none"
    />
  );
}
