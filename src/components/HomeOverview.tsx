import { Flame, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Entry, Goal, Habit, LocalDate } from '@/db/types';
import { dailyShare } from '@/domain/aggregate';
import { streakLeaders, rollingWeek } from '@/domain/analytics';
import { formatDay, shiftDate } from '@/domain/dates';
import { goalPace } from '@/domain/goals';
import { formatStreak } from '@/domain/streaks';
import { formatPercent } from '@/lib/format';
import { TileGrid } from './TileGrid';
import { Card } from './ui';

interface Props {
  habits: Habit[];
  entries: Entry[];
  goals: Goal[];
  today: LocalDate;
  weekStart: 0 | 1;
}

/** The "whole picture" cards under the Today list. */
export function HomeOverview({ habits, entries, goals, today, weekStart }: Props) {
  const navigate = useNavigate();
  const start = shiftDate(today, -181);
  const grid = useMemo(() => dailyShare(habits, entries, start, today, weekStart), [habits, entries, start, today, weekStart]);
  const week = useMemo(() => rollingWeek(habits, entries, today, weekStart), [habits, entries, today, weekStart]);
  const leaders = useMemo(
    () =>
      streakLeaders(habits, entries, today, weekStart)
        .filter((l) => l.streak.current > 0)
        .slice(0, 3),
    [habits, entries, today, weekStart],
  );
  const atRisk = useMemo(
    () =>
      goals
        .filter((g) => g.status === 'active')
        .map((g) => ({ goal: g, pace: goalPace(g, habits, entries, today, weekStart) }))
        .filter((g) => g.pace.status === 'behind'),
    [goals, habits, entries, today, weekStart],
  );

  const delta = week.thisWeek !== null && week.lastWeek !== null ? Math.round((week.thisWeek - week.lastWeek) * 100) : null;

  return (
    <section aria-label="Overview" className="mt-2">
      <h2 className="mb-1.5 px-4 text-footnote uppercase text-secondary">The whole picture</h2>
      <Card className="mb-3">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-headline">Last 26 weeks</h3>
          <span className="text-footnote text-secondary">Share of habits done each day</span>
        </div>
        <TileGrid
          color="rgb(var(--success))"
          tiles={grid}
          start={start}
          today={today}
          weekStart={weekStart}
          mode="intensity"
          label="All habits, daily completion"
        />
        <div className="mt-2 flex items-center justify-end gap-1 text-caption text-secondary" aria-hidden>
          Less
          {[0, 0.3, 0.5, 0.75, 1].map((o) => (
            <span
              key={o}
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: o ? 'rgb(var(--success))' : 'rgb(var(--fill)/0.12)', opacity: o || 1 }}
            />
          ))}
          More
        </div>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <div className="text-footnote text-secondary">Last 7 days</div>
          <div className="tabular text-title">{week.thisWeek === null ? '—' : formatPercent(week.thisWeek)}</div>
          {delta !== null && (
            <div className={`mt-0.5 flex items-center gap-1 text-footnote font-medium ${delta >= 0 ? 'text-success-text' : 'text-danger-text'}`}>
              {delta >= 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
              {delta >= 0 ? '+' : '−'}
              {Math.abs(delta)} pts vs the 7 days before
            </div>
          )}
        </Card>
        <Card className="!p-4">
          <div className="mb-1 text-footnote text-secondary">Best active streaks</div>
          {leaders.length === 0 && <div className="text-subhead text-secondary">Start one today</div>}
          {leaders.map(({ habit, streak }) => (
            <button
              key={habit.id}
              onClick={() => navigate(`/habits/${habit.id}`, { state: { back: 'Today' } })}
              className="flex w-full items-center gap-1.5 py-0.5 text-left"
            >
              <span aria-hidden>{habit.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-subhead">{habit.name}</span>
              <span className="tabular flex items-center text-footnote font-semibold text-secondary">
                <Flame size={12} className="text-[var(--c-orange)]" aria-hidden />
                {formatStreak(streak)}
              </span>
            </button>
          ))}
        </Card>
      </div>

      {atRisk.length > 0 && (
        <Card className="mb-3">
          <h3 className="mb-2 flex items-center gap-2 text-headline">
            <Target size={18} className="text-danger-text" aria-hidden /> Goals at risk
          </h3>
          {atRisk.map(({ goal, pace }) => (
            <button
              key={goal.id}
              onClick={() => navigate(`/goals/${goal.id}`)}
              className="flex w-full items-center justify-between gap-3 py-1.5 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-body">{goal.title}</span>
                <span className="block text-footnote text-secondary">
                  {pace.habitPace !== null ? `Habits at ${formatPercent(pace.habitPace)} lately` : 'No linked habits'}
                  {goal.deadline ? ` · due ${formatDay(goal.deadline, 'd MMM')}` : ''}
                </span>
              </span>
              <span className="tabular shrink-0 text-subhead text-secondary">{formatPercent(pace.progress)}</span>
            </button>
          ))}
        </Card>
      )}
    </section>
  );
}
