import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/db/db';
import { upsertDailyNote } from '@/db/repo';
import type { LocalDate } from '@/db/types';
import { Card } from './ui';

const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
const MOOD_LABEL = ['Awful', 'Low', 'Okay', 'Good', 'Great'];
const ENERGY_LABEL = ['Drained', 'Low', 'Steady', 'Good', 'Charged'];

type Score = 1 | 2 | 3 | 4 | 5;

/** End-of-day reflection: mood, energy and one line. Saves as you go. */
export function DailyCheckIn({ date, title }: { date: LocalDate; title: string }) {
  const note = useLiveQuery(() => db.dailyNotes.where('date').equals(date).first(), [date]);
  const [text, setText] = useState('');

  useEffect(() => setText(note?.text ?? ''), [note?.id, date]);

  const save = (patch: { mood?: Score | null; energy?: Score | null; text?: string }) => upsertDailyNote(date, patch);

  return (
    <Card className="mb-6">
      <h2 className="text-headline">{title}</h2>
      <p className="mb-3 text-footnote text-secondary">How was it? Your coach uses this in reviews.</p>

      <div className="mb-1 text-footnote font-medium text-secondary" id={`mood-${date}`}>
        Mood
      </div>
      <div className="mb-4 flex justify-between gap-1" role="radiogroup" aria-labelledby={`mood-${date}`}>
        {MOODS.map((m, i) => {
          const v = (i + 1) as Score;
          const on = note?.mood === v;
          return (
            <button
              key={v}
              role="radio"
              aria-checked={on}
              aria-label={MOOD_LABEL[i]}
              onClick={() => save({ mood: on ? null : v })}
              className={`flex h-12 flex-1 items-center justify-center rounded-[12px] text-[26px] transition-all ${on ? 'scale-105 bg-[rgb(var(--accent)/0.15)]' : 'opacity-60 grayscale-[40%]'}`}
            >
              {m}
            </button>
          );
        })}
      </div>

      <div className="mb-1 text-footnote font-medium text-secondary" id={`energy-${date}`}>
        Energy
      </div>
      <div className="mb-4 flex gap-1" role="radiogroup" aria-labelledby={`energy-${date}`}>
        {ENERGY_LABEL.map((label, i) => {
          const v = (i + 1) as Score;
          const on = (note?.energy ?? 0) >= v;
          return (
            <button
              key={v}
              role="radio"
              aria-checked={note?.energy === v}
              aria-label={`${label} (${v} of 5)`}
              onClick={() => save({ energy: note?.energy === v ? null : v })}
              className="flex h-11 flex-1 items-end justify-center pb-2"
            >
              <span
                className="block w-full rounded-[4px] transition-colors"
                style={{ height: 8 + i * 5, background: on ? 'var(--c-yellow)' : 'rgb(var(--fill) / 0.2)' }}
              />
            </button>
          );
        })}
      </div>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== (note?.text ?? '') && save({ text: text.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        maxLength={200}
        placeholder="One line about today (optional)"
        aria-label="One line about the day"
        className="h-11 w-full rounded-[12px] bg-[rgb(var(--fill)/0.1)] px-3 text-body outline-none"
      />
    </Card>
  );
}
