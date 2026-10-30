import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { LocalDate } from '@/db/types';
import { eachDay, fromLocalDate, shiftDate, toLocalDate, weekdayOf } from '@/domain/dates';
import type { Tile, TileState } from '@/domain/score';
import { useLongPress } from '@/lib/useLongPress';

interface Props {
  color: string;
  tiles: Map<LocalDate, Tile>;
  start: LocalDate;
  today: LocalDate;
  weekStart: 0 | 1;
  onTap: (date: LocalDate) => void;
  onLongPress: (date: LocalDate) => void;
}

/** Any known Sunday, used to label weekday columns. */
const A_SUNDAY = '2026-10-04';

const STATE_LABEL: Record<TileState, string> = {
  done: 'done',
  partial: 'partly done',
  minimum: 'minimum version',
  skipped: 'skipped',
  missed: 'missed',
  unscheduled: 'not scheduled',
  future: 'upcoming',
};

/** Classic 7-column month calendar with large tiles; each day is a button. */
export function MonthCalendar({ color, tiles, start, today, weekStart, onTap, onLongPress }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(fromLocalDate(today)));
  const first = toLocalDate(month);
  const last = toLocalDate(endOfMonth(month));
  const lead = (weekdayOf(first) - weekStart + 7) % 7;
  const days = eachDay(first, last);
  const canPrev = first > start;
  const canNext = last < today;
  const headers = Array.from({ length: 7 }, (_, i) => format(fromLocalDate(shiftDate(A_SUNDAY, (i + weekStart) % 7)), 'EEEEE'));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setMonth((m) => addMonths(m, -1))} disabled={!canPrev} className="flex h-11 w-11 items-center justify-center text-accent disabled:opacity-30" aria-label="Previous month">
          <ChevronLeft size={22} aria-hidden />
        </button>
        <h3 className="text-headline">{format(month, 'MMMM yyyy')}</h3>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} disabled={!canNext} className="flex h-11 w-11 items-center justify-center text-accent disabled:opacity-30" aria-label="Next month">
          <ChevronRight size={22} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="grid">
        {headers.map((h, i) => (
          <div key={i} className="pb-1 text-center text-caption font-medium text-secondary" aria-hidden>
            {h}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead${i}`} />
        ))}
        {days.map((d) => (
          <DayCell key={d} date={d} tile={tiles.get(d) ?? { state: d > today ? 'future' : 'unscheduled', progress: 0 }} isToday={d === today} color={color} disabled={d > today || d < start} onTap={onTap} onLongPress={onLongPress} />
        ))}
      </div>
    </div>
  );
}

function DayCell({ date, tile, isToday, color, disabled, onTap, onLongPress }: { date: LocalDate; tile: Tile; isToday: boolean; color: string; disabled: boolean; onTap: (d: LocalDate) => void; onLongPress: (d: LocalDate) => void }) {
  const lp = useLongPress(() => onLongPress(date), () => onTap(date));
  const filled = tile.state === 'done' || tile.state === 'minimum' || tile.state === 'partial';
  const bg =
    tile.state === 'done'
      ? color
      : tile.state === 'partial'
        ? `color-mix(in srgb, ${color} ${Math.round(Math.max(0.25, tile.progress * 0.85) * 100)}%, transparent)`
        : tile.state === 'minimum'
          ? `color-mix(in srgb, ${color} 50%, transparent)`
          : tile.state === 'skipped'
            ? 'rgb(var(--fill) / 0.22)'
            : tile.state === 'unscheduled'
              ? 'rgb(var(--fill) / 0.08)'
              : 'transparent';

  return (
    <button
      {...(disabled ? {} : lp)}
      disabled={disabled}
      aria-label={`${format(fromLocalDate(date), 'EEEE d MMMM')}: ${STATE_LABEL[tile.state]}${isToday ? ', today' : ''}`}
      className="relative flex aspect-square min-h-[40px] items-center justify-center rounded-[10px] disabled:opacity-40"
      style={{
        background: bg,
        boxShadow: isToday ? `0 0 0 2px ${color}` : tile.state === 'missed' ? 'inset 0 0 0 1px rgb(var(--fill) / 0.35)' : undefined,
        backgroundImage: tile.state === 'skipped' ? 'linear-gradient(135deg, transparent 47%, rgb(var(--fill) / 0.7) 47%, rgb(var(--fill) / 0.7) 53%, transparent 53%)' : undefined,
      }}
    >
      <span className={`tabular text-subhead ${tile.state === 'done' ? 'font-semibold text-white' : filled ? 'font-semibold' : 'text-secondary'}`}>{Number(date.slice(8))}</span>
      {tile.state === 'minimum' && <span className="absolute bottom-1.5 h-1 w-1 rounded-full" style={{ background: color }} aria-hidden />}
    </button>
  );
}
