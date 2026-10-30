import { describe, expect, it } from 'vitest';
import { generateDemoData } from '@/db/demo';
import { aiRequest, MAX_BODY_BYTES } from '@/ai/schemas';
import { buildCheckinPayload, buildReviewPayload } from './aggregate';
import { shiftDate } from './dates';

describe('AI payloads', () => {
  const today = '2026-10-30';
  const data = generateDemoData(today);
  const base = { ...data, notes: data.dailyNotes, today, weekStart: 1 as const, label: 'This week' };

  it('builds a compact weekly review payload', () => {
    const p = buildReviewPayload({ ...base, from: '2026-10-26', to: today, includeNotes: false });
    expect(p.period.days).toBe(5);
    expect(p.period.comparedWith).toEqual({ from: '2026-10-21', to: '2026-10-25' });
    expect(p.habits).toHaveLength(12);
    expect(p.sections).toHaveLength(4);
    expect(p.goals).toHaveLength(2);
    expect('notes' in p.checkIns).toBe(false);
    const h = p.habits.find((x) => x.name === 'Meditate')!;
    expect(h.consistency).toBeGreaterThanOrEqual(0);
    expect(h.consistency).toBeLessThanOrEqual(100);
    expect(aiRequest.safeParse({ task: 'review', payload: p }).success).toBe(true);
  });

  it('includes note text only when opted in, and stays under the size cap for a month', () => {
    const p = buildReviewPayload({ ...base, from: shiftDate(today, -29), to: today, includeNotes: true });
    expect('notes' in p.checkIns).toBe(true);
    expect(JSON.stringify({ task: 'review', payload: p }).length).toBeLessThan(MAX_BODY_BYTES);
  });

  it('scopes to a section', () => {
    const gym = data.sections.find((s) => s.name === 'Gym')!;
    const p = buildReviewPayload({ ...base, from: '2026-10-01', to: today, includeNotes: false, sectionId: gym.id, label: 'Gym' });
    expect(p.habits.every((h) => h.section === 'Gym')).toBe(true);
    expect(p.goals.map((g) => g.title)).toEqual(['Bench 100 kg']);
  });

  it('builds a goal check-in payload', () => {
    const goal = data.goals[0]!;
    const p = buildCheckinPayload(goal, data.habits, data.entries, today, 1);
    expect(p.goal.title).toBe('Bench 100 kg');
    expect(p.linkedHabits).toHaveLength(1);
    expect(p.linkedHabits[0]!.consistency14d).not.toBeNull();
  });
});
