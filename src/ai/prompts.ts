import type { AIRequest } from './schemas.js';

/*
 * Every prompt the app sends to the model lives here. The serverless function
 * builds prompts from structured payloads, so the browser can never send
 * free-form instructions on our API key.
 */

export const SYSTEM_PROMPT = `You are the coach inside Habit Hub, a habit tracker.
Voice: calm, warm, honest and specific. Never preachy, never guilt-tripping, no hype or exclamation marks. Missing a day is data, not failure.
Rules:
- Use ONLY the data provided. Never invent habits, numbers, dates or events.
- Every claim about the user's behaviour must cite a number from the data (e.g. "Meditate: 86% consistency, up 12 points").
- Percentages in the data are already 0-100. Weekday names are given in plain English.
- Prefer small, concrete, doable suggestions over big changes.
- Reply with a single JSON object that matches the requested shape exactly. No markdown, no code fences, no extra keys.`;

const REVIEW_SHAPE = `{
  "headline": string (max 12 words, the one-line story of this period),
  "score": number 0-100 (overall consistency for the period, from the data),
  "summary": string (2-3 sentences),
  "strong": [{ "title": string, "detail": string citing numbers }] (1-3 items),
  "weak": [{ "title": string, "detail": string citing numbers }] (0-3 items),
  "patterns": [string] (0-3 observations, e.g. weekday effects, mood links),
  "goals": [{ "goal": string, "status": "on-track" | "behind" | "ahead" | "unclear", "note": string }] (one per active goal, empty if none),
  "nextSteps": [{ "action": string (imperative, specific), "why": string }] (1-3 items)
}`;

const QUESTIONS_SHAPE = `{
  "questions": [{ "id": string (short slug), "question": string, "options": [string] (2-4 short quick replies) }] (1-3 questions)
}`;

const PLAN_SHAPE = `{
  "summary": string (2-3 sentences: the approach and why it fits),
  "goal": { "title": string (short), "metric": string (what is measured, with unit), "targetValue": number | null, "currentValue": number | null },
  "milestones": [string] (2-5, in order),
  "habits": [{
    "name": string, "emoji": string (one emoji), "sectionName": string (reuse an existing section name when it fits, else a short new one),
    "type": "check" | "count" | "duration" | "numeric" | "avoid",
    "target": number (1 for check/avoid), "unit": string ("" for check/avoid, e.g. "min", "pages"),
    "schedule": { "kind": "daily" } | { "kind": "weekdays", "days": [0-6, 0 = Sunday] } | { "kind": "timesPerWeek", "times": 1-7 } | { "kind": "timesPerMonth", "times": 1-31 },
    "timeOfDay": "morning" | "afternoon" | "evening" | "anytime",
    "minimumVersion": string (tiny fallback that still counts), "cue": string (habit stacking, "After ..."), "why": string,
    "reuseHabitId": string | null (the id of an existing habit to reuse instead of creating a new one)
  }] (1-5 habits)
}`;

const CHECKIN_SHAPE = `{
  "status": "on-track" | "behind" | "ahead",
  "reasoning": string (2-3 sentences citing numbers),
  "adjustment": {
    "kind": "lower-target" | "add-minimum-version" | "change-schedule" | "add-habit" | "keep-going" | "other",
    "description": string (one specific change),
    "habitName": string | null
  }
}`;

const VISION_SHAPE = `{
  "headline": string (one sentence, max 20 words, that names what will really move this forward),
  "firstStep": { "action": string (something doable today in under 15 minutes), "why": string },
  "actions": [{ "action": string (imperative, specific, measurable), "why": string, "cadence": "once" | "daily" | "weekly" | "monthly" }] (3-5 items, highest leverage first),
  "milestones": [string] (2-4 measurable checkpoints, in order)
}`;

export function buildPrompt(req: AIRequest): string {
  switch (req.task) {
    case 'review':
      return `Review this period of the user's habit data.
Focus on what changed versus the previous period of equal length, what's working, what's slipping, and patterns (weekdays, mood/energy, sections).
If there's little data, say so plainly and keep the review short.

Return JSON with this shape:
${REVIEW_SHAPE}

Data:
${JSON.stringify(req.payload)}`;

    case 'goalQuestions':
      return `The user wants to set a goal. Ask up to 3 short clarifying questions that would most change the plan: current level, time available, constraints. Skip anything the goal already answers. Give 2-4 quick-reply options per question.

Goal: ${JSON.stringify(req.payload.goal)}
Deadline: ${req.payload.deadline ?? 'none'}
Why it matters: ${JSON.stringify(req.payload.why || 'not given')}
Today: ${req.payload.today}

Return JSON with this shape:
${QUESTIONS_SHAPE}`;

    case 'goalPlan':
      return `Turn the user's goal into a concrete plan of small daily or weekly habits.
Constraints:
- Propose at most 3 NEW habits. If an existing habit already serves the goal, reuse it by setting "reuseHabitId" to its id (reused habits don't count towards the 3).
- Keep the total new daily load small and realistic for the time the user said they have.
- Each habit needs a minimum version and a cue.
- Milestones should be measurable steps toward the deadline.

Goal: ${JSON.stringify(req.payload.goal)}
Deadline: ${req.payload.deadline ?? 'none'}
Why: ${JSON.stringify(req.payload.why || 'not given')}
Today: ${req.payload.today}
Answers to clarifying questions: ${JSON.stringify(req.payload.answers)}
Existing sections: ${JSON.stringify(req.payload.sections)}
Existing habits: ${JSON.stringify(req.payload.existingHabits)}

Return JSON with this shape:
${PLAN_SHAPE}`;

    case 'visionSteps':
      return `This is one tile of the user's vision board: a life area and, in their own words, what they want it to become.
Break it down into the specific actions that would actually move the needle. Be concrete (numbers, frequencies, names of things to do), not generic advice. Favour a few high-leverage actions over many small ones, and make the first step tiny and doable today.
If the vision is vague or empty, infer a sensible, modest ambition for the area and say so in the headline.
Progress dots are 0-4 (0 = not started, 4 = there).

Area: ${JSON.stringify(req.payload.area)}
Their vision: ${JSON.stringify(req.payload.vision || 'not written yet')}
Progress: ${req.payload.progress}/4
Linked goal: ${JSON.stringify(req.payload.linkedGoal ?? 'none')}
Today: ${req.payload.today}

Return JSON with this shape:
${VISION_SHAPE}`;

    case 'goalCheckin':
      return `Is the user on track for this goal? Judge from the goal's progress and deadline and from how consistently the linked habits were done recently. Then suggest exactly ONE adjustment (e.g. lower a target, add a minimum version, change a schedule) — or "keep-going" if nothing should change.

Return JSON with this shape:
${CHECKIN_SHAPE}

Data:
${JSON.stringify(req.payload)}`;
  }
}

/** Sent on the retry after an unparseable or invalid reply. */
export function repairPrompt(error: string): string {
  return `Your previous reply could not be used (${error.slice(0, 300)}). Reply again with ONLY the JSON object in the exact shape requested, nothing else.`;
}
