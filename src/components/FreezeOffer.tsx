import { useState } from 'react';
import { freezeDay } from '@/app/logActions';
import type { Habit, LocalDate } from '@/db/types';
import { shiftDate } from '@/domain/dates';
import { Card } from './ui';

const KEY = 'hh-freeze-dismissed';

function dismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Offers a streak freeze for yesterday's unplanned misses. */
export function FreezeOffer({
  candidates,
  today,
  freezesLeft,
}: {
  candidates: { habit: Habit; streak: number }[];
  today: LocalDate;
  freezesLeft: number;
}) {
  const [hidden, setHidden] = useState(dismissed);
  const yesterday = shiftDate(today, -1);
  const visible = candidates.filter((c) => !hidden.includes(`${c.habit.id}|${yesterday}`)).slice(0, 2);
  if (visible.length === 0 || freezesLeft === 0) return null;

  const dismiss = (id: string) => {
    const next = [...hidden.filter((k) => k.endsWith(yesterday)), `${id}|${yesterday}`];
    setHidden(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* per-device convenience only */
    }
  };

  return (
    <>
      {visible.map(({ habit, streak }) => (
        <Card key={habit.id} className="mb-4 !p-4">
          <div className="flex items-start gap-3">
            <span className="text-[26px] leading-none" aria-hidden>
              🧊
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-headline">
                Protect your {streak}-day {habit.name} streak?
              </p>
              <p className="mt-0.5 text-subhead text-secondary">
                Yesterday slipped by. A streak freeze keeps it alive — you have {freezesLeft} left this month.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={async () => {
                    await freezeDay(habit, yesterday);
                    dismiss(habit.id);
                  }}
                  className="h-9 rounded-full bg-[var(--c-cyan)] px-4 text-subhead font-semibold text-white"
                >
                  Use a freeze
                </button>
                <button onClick={() => dismiss(habit.id)} className="h-9 rounded-full px-3 text-subhead text-accent">
                  Not now
                </button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}
