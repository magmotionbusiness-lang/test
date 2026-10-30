import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Entry, Habit } from '@/db/types';
import { presetsFor } from '@/domain/logging';
import { Sheet } from './Sheet';

interface Props {
  habit: Habit | null;
  entry: Entry | undefined;
  onClose: () => void;
  onSave: (value: number) => void;
}

/** Exact-amount input for count, duration and numeric habits. */
export function AmountSheet({ habit, entry, onClose, onSave }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (habit) setText(entry && entry.status !== 'skipped' && entry.value > 0 ? String(entry.value) : '');
  }, [habit, entry]);

  const value = Number(text.replace(',', '.'));
  const valid = text !== '' && Number.isFinite(value) && value >= 0;
  const step = habit && habit.target >= 100 ? Math.round(habit.target / 10) : 1;

  const save = () => {
    if (!valid) return;
    onSave(value);
    onClose();
  };

  return (
    <Sheet
      open={habit !== null}
      onClose={onClose}
      title={habit?.name}
      action={
        <button onClick={save} disabled={!valid} className="text-headline text-accent disabled:opacity-30">
          Save
        </button>
      }
    >
      {habit && (
        <div className="flex flex-col items-center pb-4">
          <p className="text-subhead text-secondary">
            Target: {habit.target} {habit.unit}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => setText(String(Math.max(0, (valid ? value : 0) - step)))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-2 text-accent"
              aria-label={`Minus ${step}`}
            >
              <Minus size={20} aria-hidden />
            </button>
            <label className="flex items-baseline gap-2">
              <input
                autoFocus
                inputMode="decimal"
                value={text}
                onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="0"
                aria-label={`Amount in ${habit.unit}`}
                className="tabular w-32 bg-transparent text-center text-[48px] font-semibold outline-none"
              />
              <span className="text-body text-secondary">{habit.unit}</span>
            </label>
            <button
              onClick={() => setText(String((valid ? value : 0) + step))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-2 text-accent"
              aria-label={`Plus ${step}`}
            >
              <Plus size={20} aria-hidden />
            </button>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {presetsFor(habit).map((p) => (
              <button
                key={p}
                onClick={() => {
                  onSave(p);
                  onClose();
                }}
                className="tabular h-11 min-w-[64px] rounded-full bg-bg-2 px-4 text-body font-medium"
              >
                {p} {habit.unit}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
