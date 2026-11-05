import { describe, expect, it } from 'vitest';
import { buildPrompt } from './prompts';
import { aiRequest, visionStepsResult } from './schemas';

describe('visionSteps AI task', () => {
  const req = { task: 'visionSteps', payload: { area: 'Health', vision: 'Run a half marathon', progress: 1, linkedGoal: null, today: '2026-11-05' } };

  it('accepts a well-formed request and builds a prompt from it', () => {
    const parsed = aiRequest.parse(req);
    const prompt = buildPrompt(parsed);
    expect(prompt).toContain('"Health"');
    expect(prompt).toContain('Run a half marathon');
    expect(prompt).toContain('Progress: 1/4');
  });

  it('rejects out-of-range progress and free-form extras', () => {
    expect(aiRequest.safeParse({ ...req, payload: { ...req.payload, progress: 7 } }).success).toBe(false);
    expect(aiRequest.safeParse({ task: 'visionSteps', payload: { area: '' } }).success).toBe(false);
  });

  it('validates the reply shape', () => {
    const good = {
      headline: 'Build the base first',
      firstStep: { action: 'Walk 15 minutes after lunch', why: 'Starts the habit today' },
      actions: [
        { action: 'Run 3× a week, 20–30 min', why: 'Aerobic base', cadence: 'weekly' },
        { action: 'Sign up for a race in spring', why: 'A date makes it real', cadence: 'once' },
      ],
      milestones: ['Run 5 km without stopping', 'Run 15 km'],
    };
    expect(visionStepsResult.safeParse(good).success).toBe(true);
    expect(visionStepsResult.safeParse({ ...good, actions: [] }).success).toBe(false);
  });
});
