import { Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Entry, Habit, LocalDate, Section } from '@/db/types';
import { dailyShare, type ReviewPayload } from '@/domain/aggregate';
import { groupWeekdayRates } from '@/domain/analytics';
import { daysBetween, formatDay, shiftDate } from '@/domain/dates';
import { colorVar } from '@/lib/colors';
import { formatPercent } from '@/lib/format';
import { BarChart, LineChart } from './charts';
import { TileGrid } from './TileGrid';
import { Card } from './ui';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  payload: ReviewPayload;
  habits: Habit[];
  sections: Section[];
  entries: Entry[];
  from: LocalDate;
  to: LocalDate;
  today: LocalDate;
  weekStart: 0 | 1;
  sectionId?: string;
}

/**
 * Everything about the chosen period in one place: the same numbers the AI
 * coach receives (from the review payload), plus charts drawn from them.
 */
export function InsightsData({ payload, habits, sections, entries, from, to, today, weekStart, sectionId }: Props) {
  const navigate = useNavigate();
  const days = daysBetween(from, to) + 1;
  const active = useMemo(() => habits.filter((h) => !h.archived && (!sectionId || h.sectionId === sectionId)), [habits, sectionId]);
  const byName = useMemo(() => new Map(active.map((h) => [h.name, h])), [active]);
  const sectionByName = useMemo(() => new Map(sections.map((s) => [s.name, s])), [sections]);

  const daily = useMemo(() => dailyShare(active, entries, from, to, weekStart), [active, entries, from, to, weekStart]);
  const gridStart = shiftDate(today, -181);
  const grid = useMemo(() => dailyShare(active, entries, gridStart, today, weekStart), [active, entries, gridStart, today, weekStart]);
  // Short periods say little about weekdays, so fall back to the last 90 days.
  const wdFrom = days >= 14 ? from : shiftDate(today, -89);
  const weekdays = useMemo(() => groupWeekdayRates(active, entries, wdFrom, to, today), [active, entries, wdFrom, to, today]);

  const o = payload.overall;
  const totals = payload.habits.reduce(
    (t, h) => ({ done: t.done + h.done + h.minimum, partial: t.partial + h.partial, skipped: t.skipped + h.skipped, missed: t.missed + h.missed }),
    { done: 0, partial: 0, skipped: 0, missed: 0 },
  );
  const ranked = [...payload.habits].sort((a, b) => (b.consistency ?? -1) - (a.consistency ?? -1));
  const streaks = [...payload.habits]
    .sort((a, b) => parseInt(b.currentStreak) - parseInt(a.currentStreak))
    .filter((h) => parseInt(h.currentStreak) > 0);
  const pct = (v: number) => formatPercent(v);
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  const dailyPoints = [...daily.entries()].map(([d, t]) => ({
    label: formatDay(d, 'EEE d MMM'),
    tick: days <= 7 ? formatDay(d, 'EEE') : formatDay(d, 'd/M'),
    value: t.state === 'unscheduled' ? null : t.progress,
  }));

  return (
    <div className="grid gap-3 [&>*]:min-w-0">
      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-footnote text-secondary">Consistency</div>
            <div className="tabular text-[40px] font-bold leading-tight">{o.consistency === null ? '—' : `${o.consistency}%`}</div>
          </div>
          {o.change !== null && (
            <div className="text-right">
              <div
                className={`tabular flex items-center justify-end gap-1 text-headline ${o.change >= 0 ? 'text-success-text' : 'text-danger-text'}`}
              >
                {o.change >= 0 ? <TrendingUp size={18} aria-hidden /> : <TrendingDown size={18} aria-hidden />}
                {o.change >= 0 ? '+' : '−'}
                {Math.abs(o.change)} pts
              </div>
              <div className="text-footnote text-secondary">vs {o.previousConsistency}% the period before</div>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[rgb(var(--separator)/0.29)] pt-3 text-center">
          <Mini label="Done" value={totals.done} />
          <Mini label="Partial" value={totals.partial} />
          <Mini label="Skipped" value={totals.skipped} />
          <Mini label="Missed" value={totals.missed} />
        </div>
      </Card>

      {days > 1 && (
        <Card>
          <h3 className="text-headline">Day by day</h3>
          <p className="mb-2 text-footnote text-secondary">Share of each day’s habits done</p>
          {days <= 31 ? (
            <BarChart
              title="Daily completion"
              data={dailyPoints}
              color="rgb(var(--accent))"
              format={pct}
              max={1}
              tickEvery={days <= 7 ? 1 : Math.ceil(days / 6)}
            />
          ) : (
            <LineChart title="Daily completion" data={dailyPoints} color="rgb(var(--accent))" format={pct} max={1} />
          )}
        </Card>
      )}

      {payload.sections.length > 1 && (
        <Card>
          <h3 className="mb-3 text-headline">Sections</h3>
          <ul className="grid gap-3">
            {payload.sections.map((s) => {
              const sec = sectionByName.get(s.name);
              return (
                <li key={s.name}>
                  <button onClick={() => sec && navigate(`/sections/${sec.id}`)} className="w-full text-left">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-subhead">
                        {sec?.emoji} {s.name}
                      </span>
                      <span className="tabular text-subhead">
                        {s.consistency}%{' '}
                        {s.change !== null && (
                          <span className={`text-footnote ${s.change >= 0 ? 'text-success-text' : 'text-danger-text'}`}>
                            {s.change >= 0 ? '+' : '−'}
                            {Math.abs(s.change)}
                          </span>
                        )}
                      </span>
                    </div>
                    <Bar value={(s.consistency ?? 0) / 100} color={sec ? colorVar(sec.color) : 'rgb(var(--accent))'} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <h3 className="mb-3 text-headline">Habits</h3>
        <ul className="grid gap-3">
          {ranked.map((h) => {
            const habit = byName.get(h.name);
            return (
              <li key={h.name}>
                <button onClick={() => habit && navigate(`/habits/${habit.id}`, { state: { back: 'Insights' } })} className="w-full text-left">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-subhead">
                      {habit?.emoji} {h.name}
                    </span>
                    <span className="tabular shrink-0 text-subhead">
                      {h.consistency === null ? '—' : `${h.consistency}%`}{' '}
                      {h.change !== null && (
                        <span className={`text-footnote ${h.change >= 0 ? 'text-success-text' : 'text-danger-text'}`}>
                          {h.change >= 0 ? '+' : '−'}
                          {Math.abs(h.change)}
                        </span>
                      )}
                    </span>
                  </div>
                  <Bar value={(h.consistency ?? 0) / 100} color={habit ? colorVar(habit.color) : 'rgb(var(--accent))'} />
                  <div className="mt-1 text-caption text-secondary">
                    {h.done + h.minimum} done{h.partial ? ` · ${h.partial} partial` : ''}
                    {h.skipped ? ` · ${h.skipped} skipped` : ''}
                    {h.missed ? ` · ${h.missed} missed` : ''}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <div className="mb-1 text-footnote text-secondary">Active streaks</div>
          {streaks.length === 0 && <div className="text-subhead text-secondary">None yet</div>}
          {streaks.slice(0, 4).map((h) => (
            <div key={h.name} className="flex items-center gap-1.5 py-0.5">
              <span className="min-w-0 flex-1 truncate text-subhead">{h.name}</span>
              <span className="tabular flex items-center text-footnote font-semibold text-secondary">
                <Flame size={12} className="text-[var(--c-orange)]" aria-hidden />
                {parseInt(h.currentStreak)}
              </span>
            </div>
          ))}
        </Card>
        <Card className="!p-4">
          <div className="mb-1 text-footnote text-secondary">Check-ins</div>
          <div className="text-subhead">
            Mood <span className="tabular font-semibold">{payload.checkIns.averageMood ?? '—'}</span>
            <span className="text-secondary"> / 5</span>
          </div>
          <div className="text-subhead">
            Energy <span className="tabular font-semibold">{payload.checkIns.averageEnergy ?? '—'}</span>
            <span className="text-secondary"> / 5</span>
          </div>
          <div className="mt-1 text-caption text-secondary">{payload.checkIns.daysWithCheckIn} days logged</div>
        </Card>
      </div>

      <Card>
        <h3 className="text-headline">Weekdays</h3>
        <p className="mb-2 text-footnote text-secondary">Completion rate{days >= 14 ? ' in this period' : ', last 90 days'}</p>
        <BarChart
          title="Completion by weekday"
          data={order.map((d) => ({ label: WEEKDAY[d]!, tick: WEEKDAY[d]!.slice(0, 2), value: weekdays[d] ?? null }))}
          color="rgb(var(--accent))"
          format={pct}
          max={1}
        />
      </Card>

      <Card>
        <h3 className="mb-3 text-headline">Last 26 weeks</h3>
        <TileGrid
          color="rgb(var(--success))"
          tiles={grid}
          start={gridStart}
          today={today}
          weekStart={weekStart}
          mode="intensity"
          label="Daily completion, last 26 weeks"
        />
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="tabular text-headline">{value}</div>
      <div className="text-caption text-secondary">{label}</div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--fill)/0.2)]" aria-hidden>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </div>
  );
}
