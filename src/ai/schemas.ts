import { z } from 'zod';

/*
 * Request and response contracts for /api/ai, shared by the browser and the
 * serverless function. Imports use explicit `.js` extensions so the Vercel
 * function (Node ESM) can load this file too.
 */

export const MAX_BODY_BYTES = 30 * 1024;

// ---- Responses -------------------------------------------------------------

const point = z.object({ title: z.string().min(1).max(120), detail: z.string().min(1).max(400) });

export const reviewResult = z.object({
  headline: z.string().min(1).max(120),
  score: z.number().min(0).max(100),
  summary: z.string().min(1).max(700),
  strong: z.array(point).max(5),
  weak: z.array(point).max(5),
  patterns: z.array(z.string().min(1).max(300)).max(5),
  goals: z
    .array(z.object({ goal: z.string().max(120), status: z.enum(['on-track', 'behind', 'ahead', 'unclear']), note: z.string().max(300) }))
    .max(6),
  nextSteps: z
    .array(z.object({ action: z.string().min(1).max(160), why: z.string().min(1).max(300) }))
    .min(1)
    .max(4),
});
export type ReviewResult = z.infer<typeof reviewResult>;

export const goalQuestionsResult = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        question: z.string().min(1).max(200),
        options: z.array(z.string().min(1).max(60)).max(5),
      }),
    )
    .max(3),
});
export type GoalQuestionsResult = z.infer<typeof goalQuestionsResult>;

const schedule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily') }),
  z.object({ kind: z.literal('weekdays'), days: z.array(z.number().int().min(0).max(6)).min(1).max(7) }),
  z.object({ kind: z.literal('timesPerWeek'), times: z.number().int().min(1).max(7) }),
  z.object({ kind: z.literal('timesPerMonth'), times: z.number().int().min(1).max(31) }),
]);

export const planHabit = z.object({
  name: z.string().min(1).max(60),
  emoji: z.string().min(1).max(8),
  sectionName: z.string().min(1).max(40),
  type: z.enum(['check', 'count', 'duration', 'numeric', 'avoid']),
  target: z.number().positive().max(100000),
  unit: z.string().max(16),
  schedule,
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
  minimumVersion: z.string().max(80),
  cue: z.string().max(80),
  why: z.string().max(140),
  /** Set when the plan reuses one of the user's existing habits instead of creating one. */
  reuseHabitId: z.string().max(64).nullable(),
});
export type PlanHabit = z.infer<typeof planHabit>;

export const goalPlanResult = z.object({
  summary: z.string().min(1).max(600),
  goal: z.object({
    title: z.string().min(1).max(80),
    metric: z.string().max(80),
    targetValue: z.number().nullable(),
    currentValue: z.number().nullable(),
  }),
  milestones: z.array(z.string().min(1).max(100)).min(1).max(6),
  habits: z.array(planHabit).min(1).max(5),
});
export type GoalPlanResult = z.infer<typeof goalPlanResult>;

export const goalCheckinResult = z.object({
  status: z.enum(['on-track', 'behind', 'ahead']),
  reasoning: z.string().min(1).max(600),
  adjustment: z.object({
    kind: z.enum(['lower-target', 'add-minimum-version', 'change-schedule', 'add-habit', 'keep-going', 'other']),
    description: z.string().min(1).max(300),
    habitName: z.string().max(60).nullable(),
  }),
});
export type GoalCheckinResult = z.infer<typeof goalCheckinResult>;

// ---- Requests ---------------------------------------------------------------

const json = z.record(z.unknown());

export const aiRequest = z.discriminatedUnion('task', [
  z.object({ task: z.literal('review'), payload: json }),
  z.object({
    task: z.literal('goalQuestions'),
    payload: z.object({
      goal: z.string().min(1).max(200),
      deadline: z.string().max(10).nullable(),
      why: z.string().max(300),
      today: z.string().max(10),
    }),
  }),
  z.object({
    task: z.literal('goalPlan'),
    payload: z.object({
      goal: z.string().min(1).max(200),
      deadline: z.string().max(10).nullable(),
      why: z.string().max(300),
      today: z.string().max(10),
      answers: z.array(z.object({ question: z.string().max(200), answer: z.string().max(300) })).max(3),
      existingHabits: z.array(json).max(60),
      sections: z.array(z.string().max(40)).max(30),
    }),
  }),
  z.object({ task: z.literal('goalCheckin'), payload: json }),
]);
export type AIRequest = z.infer<typeof aiRequest>;
export type AITask = AIRequest['task'];

export const resultSchemas = {
  review: reviewResult,
  goalQuestions: goalQuestionsResult,
  goalPlan: goalPlanResult,
  goalCheckin: goalCheckinResult,
} as const;

export type AIResult<T extends AITask> = z.infer<(typeof resultSchemas)[T]>;

export type AIResponse<T extends AITask = AITask> =
  | { ok: true; result: AIResult<T> }
  | { ok: false; error: string; code: 'bad-request' | 'too-large' | 'rate-limited' | 'upstream' | 'invalid-output' | 'not-configured' };
