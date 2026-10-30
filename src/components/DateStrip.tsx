import { useEffect, useRef } from 'react';
import type { LocalDate } from '@/db/types';
import { formatDay, shiftDate } from '@/domain/dates';

const DAYS = 21;

/** Horizontal strip of recent days for retroactive logging; ends at today. */
export function DateStrip({
  value,
  today,
  onChange,
  completion,
}: {
  value: LocalDate;
  today: LocalDate;
  onChange: (d: LocalDate) => void;
  completion: Map<LocalDate, number>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: DAYS }, (_, i) => shiftDate(today, i - DAYS + 1));

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div ref={ref} className="no-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4" role="listbox" aria-label="Choose a day to log">
      {days.map((d) => {
        const active = d === value;
        const pct = completion.get(d) ?? 0;
        return (
          <button
            key={d}
            role="option"
            aria-selected={active}
            aria-label={`${formatDay(d, 'EEEE d MMMM')}${d === today ? ', today' : ''}, ${Math.round(pct * 100)}% done`}
            onClick={() => onChange(d)}
            className={`flex h-[62px] w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] transition-colors ${active ? 'bg-accent text-white' : ''}`}
          >
            <span className={`text-[11px] font-medium uppercase ${active ? 'text-white/80' : 'text-secondary'}`}>{formatDay(d, 'EEEEE')}</span>
            <span className={`tabular text-[17px] ${d === today && !active ? 'font-bold text-accent' : 'font-semibold'}`}>{formatDay(d, 'd')}</span>
            <span
              className="h-1 w-5 overflow-hidden rounded-full"
              style={{ background: active ? 'rgba(255,255,255,0.3)' : 'rgb(var(--fill) / 0.2)' }}
              aria-hidden
            >
              <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: active ? '#fff' : 'rgb(var(--success))' }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
