import type { DailyNote, Entry, Goal, Habit, LocalDate, Section } from '@/db/types';
import { groupConsistency } from './analytics';
import { daysBetween, eachDay, shiftDate } from './dates';
import { goalPace } from './goals';
import { describeSchedule, isActiveOn, isFlexible, isScheduledOn, periodKey, periodQuota } from './schedule';
import { consistency, weekdayRates, type Tile } from './score';
import { computeStreak } from './streaks';
import { isCompleted } from './today';

type HabitLike = Pick<Habit, 'id' | 'schedule' | 'startDate' | 'archived'>;

/**
 * Share of each day's due habits that were completed, as tiles whose
 * `progress` is 0…1 (for intensity grids). A flexible habit counts as due on
 * a day until its period quota is met — the same rule the Home list uses.
 */
export function dailyShare(habits: HabitLike[], entries: Entry[], start: LocalDate, end: LocalDate, weekStart: 0 | 1): Map<LocalDate, Tile> {
  const byHabit = new Map<string, Map<LocalDate, Entry>>();
  for (const e of entries) {
    let m = byHabit.get(e.habitId);
    if (!m) byHabit.set(e.habitId, (m = new Map()));
    m.set(e.date, e);
  }
  // Running completions per (habit, period) for flexible schedules.
  const periodDone = new Map<string, number>();
  const out = new Map<LocalDate, Tile>();

  for (const d of eachDay(start, end)) {
    let due = 0;
    let done = 0;
    for (const h of habits) {
      // Archived habits still count for their past; only the start date limits them.
      if (!isActiveOn({ ...h, archived: false }, d) || !isScheduledOn(h.schedule, d)) continue;
      const entry = byHabit.get(h.id)?.get(d);
      if (entry?.status === 'skipped' || entry?.freeze) continue;
      const completed = isCompleted(entry);
      if (isFlexible(h.schedule)) {
        const key = `${h.id}|${periodKey(h.schedule, d, weekStart)}`;
        const before = periodDone.get(key) ?? 0;
        if (completed) periodDone.set(key, before + 1);
        if (before >= periodQuota(h.schedule) && !completed) continue;
      }
      due++;
      if (completed) done++;
    }
    out.set(
      d,
      due === 0 ? { state: 'unscheduled', progress: 0 } : { state: done === due ? 'done' : done > 0 ? 'partial' : 'missed', progress: done / due },
    );
  }
  return out;
}

/** Mean of a list, or null when empty. */
export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// ---- AI payloads ------------------------------------------------------------

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));
const change = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 100));

export interface ReviewInput {
  habits: Habit[];
  sections: Section[];
  entries: Entry[];
  notes: DailyNote[];
  goals: Goal[];
  from: LocalDate;
  to: LocalDate;
  today: LocalDate;
  weekStart: 0 | 1;
  includeNotes: boolean;
  /** Restrict to one section. */
  sectionId?: string;
  label: string;
}

/**
 * Compact, privacy-minded review payload. Only aggregates leave the device;
 * note text is included only when the user opted in.
 */
export function buildReviewPayload(input: ReviewInput) {
  const { from, today, weekStart } = input;
  const to = input.to < today ? input.to : today;
  const days = daysBetween(from, to) + 1;
  const prevTo = shiftDate(from, -1);
  const prevFrom = shiftDate(from, -days);
  const sectionName = new Map(input.sections.map((s) => [s.id, s.name]));
  const habits = input.habits.filter((h) => !h.archived && h.startDate <= to && (!input.sectionId || h.sectionId === input.sectionId));
  const ids = new Set(habits.map((h) => h.id));
  const entries = input.entries.filter((e) => ids.has(e.habitId));
  const byHabit = (id: string) => entries.filter((e) => e.habitId === id);

  const habitRows = habits.map((h) => {
    const es = byHabit(h.id);
    const inRange = es.filter((e) => e.date >= from && e.date <= to);
    const cur = consistency(h, es, from, to, today, weekStart);
    const prev = consistency(h, es, prevFrom, prevTo, today, weekStart);
    const counts = { done: 0, partial: 0, minimum: 0, skipped: 0, missed: 0 };
    for (const e of inRange) if (e.status !== 'missed') counts[e.status]++;
    if (!isFlexible(h.schedule)) {
      const logged = new Set(inRange.filter((e) => e.status !== 'missed' || e.freeze).map((e) => e.date));
      for (const d of eachDay(from > h.startDate ? from : h.startDate, to))
        if (d < today && isScheduledOn(h.schedule, d) && !logged.has(d)) counts.missed++;
    }
    const rates = weekdayRates(h, es, from, to, today);
    const ranked = rates.map((r, i) => ({ r, i })).filter((x): x is { r: number; i: number } => x.r !== null);
    ranked.sort((a, b) => b.r - a.r);
    const streak = computeStreak(h, es, today, weekStart);
    return {
      name: h.name,
      section: sectionName.get(h.sectionId) ?? '',
      type: h.type,
      schedule: describeSchedule(h.schedule, weekStart),
      ...(h.type === 'count' || h.type === 'duration' || h.type === 'numeric' ? { target: `${h.target} ${h.unit}` } : {}),
      expectedDays: Math.round(cur.expected * 10) / 10,
      ...counts,
      consistency: pct(cur.score),
      previousConsistency: pct(prev.score),
      change: change(cur.score, prev.score),
      currentStreak: `${streak.current} ${streak.unit}s`,
      bestWeekday: ranked.length > 1 ? WEEKDAYS[ranked[0]!.i] : null,
      worstWeekday: ranked.length > 1 ? WEEKDAYS[ranked[ranked.length - 1]!.i] : null,
    };
  });

  const sectionRows = input.sections
    .filter((s) => !s.archived && (!input.sectionId || s.id === input.sectionId))
    .map((s) => {
      const hs = habits.filter((h) => h.sectionId === s.id);
      const cur = groupConsistency(hs, entries, from, to, today, weekStart);
      const prev = groupConsistency(hs, entries, prevFrom, prevTo, today, weekStart);
      return { name: s.name, consistency: pct(cur), previousConsistency: pct(prev), change: change(cur, prev) };
    })
    .filter((s) => s.consistency !== null);

  const notes = input.notes.filter((n) => n.date >= from && n.date <= to);
  const moods = notes.map((n) => n.mood).filter((x): x is NonNullable<typeof x> => x !== null);
  const energies = notes.map((n) => n.energy).filter((x): x is NonNullable<typeof x> => x !== null);
  const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

  const overall = groupConsistency(habits, entries, from, to, today, weekStart);
  const overallPrev = groupConsistency(habits, entries, prevFrom, prevTo, today, weekStart);

  return {
    period: { label: input.label, from, to, days, comparedWith: { from: prevFrom, to: prevTo } },
    overall: { consistency: pct(overall), previousConsistency: pct(overallPrev), change: change(overall, overallPrev) },
    habits: habitRows,
    sections: sectionRows,
    checkIns: {
      daysWithCheckIn: notes.length,
      averageMood: round1(mean(moods)),
      averageEnergy: round1(mean(energies)),
      ...(input.includeNotes
        ? {
            notes: notes
              .filter((n) => n.text.trim())
              .slice(-14)
              .map((n) => ({ date: n.date, mood: n.mood, energy: n.energy, text: n.text.slice(0, 160) })),
          }
        : {}),
    },
    goals: input.goals
      .filter((g) => g.status === 'active' && (!input.sectionId || g.habitIds.some((id) => ids.has(id))))
      .map((g) => {
        const p = goalPace(g, input.habits, input.entries, today, weekStart);
        return {
          title: g.title,
          deadline: g.deadline,
          progress: pct(p.progress),
          linkedHabits: input.habits.filter((h) => g.habitIds.includes(h.id)).map((h) => h.name),
          linkedHabitConsistency14d: pct(p.habitPace),
          onPace: p.status !== 'behind',
        };
      }),
  };
}

export type ReviewPayload = ReturnType<typeof buildReviewPayload>;

/** Payload for "Am I on track?" on a goal page. */
export function buildCheckinPayload(goal: Goal, habits: Habit[], entries: Entry[], today: LocalDate, weekStart: 0 | 1) {
  const p = goalPace(goal, habits, entries, today, weekStart);
  const linked = habits.filter((h) => goal.habitIds.includes(h.id));
  return {
    today,
    goal: {
      title: goal.title,
      why: goal.why,
      metric: goal.metric,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      deadline: goal.deadline,
      daysLeft: p.daysLeft,
      timeElapsedPercent: pct(p.timeElapsed),
      progressPercent: pct(p.progress),
      milestones: goal.milestones.map((m) => ({ title: m.title, done: m.done })),
    },
    linkedHabits: linked.map((h) => {
      const es = entries.filter((e) => e.habitId === h.id);
      const s = computeStreak(h, es, today, weekStart);
      return {
        name: h.name,
        schedule: describeSchedule(h.schedule, weekStart),
        ...(h.type === 'count' || h.type === 'duration' || h.type === 'numeric' ? { target: `${h.target} ${h.unit}` } : {}),
        minimumVersion: h.minimumVersion || null,
        consistency14d: pct(consistency(h, es, shiftDate(today, -13), today, today, weekStart).score),
        consistency30d: pct(consistency(h, es, shiftDate(today, -29), today, today, weekStart).score),
        currentStreak: `${s.current} ${s.unit}s`,
      };
    }),
  };
}
