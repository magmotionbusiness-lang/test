import { db } from '@/db/db';
import { getSettings, updateSettings } from '@/db/repo';
import type { AIReview, LocalDate, ReviewScope } from '@/db/types';
import { today } from '@/domain/dates';
import { nowIso, uuid } from '@/lib/id';
import { MAX_BODY_BYTES, resultSchemas, type AIResponse, type AIResult, type AITask } from './schemas';

export class AIError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'limit' | 'too-large' | 'failed',
  ) {
    super(message);
  }
}

const CLIENT_TIMEOUT_MS = 40_000;

/** SHA-256 of a stable JSON string, used to key cached results. */
export async function hashInput(task: AITask, payload: unknown): Promise<string> {
  const data = new TextEncoder().encode(`${task}:${JSON.stringify(payload)}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function aiUsage(): Promise<{ used: number; limit: number }> {
  const s = await getSettings();
  return { used: s.aiCallsDate === today() ? s.aiCallsToday : 0, limit: s.aiDailyLimit };
}

/**
 * Calls /api/ai with client-side guardrails: online check, per-device daily
 * limit, size cap, timeout and schema validation of the reply.
 */
export async function callAI<T extends AITask>(task: T, payload: unknown): Promise<AIResult<T>> {
  if (import.meta.env.VITE_PREVIEW === 'true')
    throw new AIError(
      'The AI coach runs on the deployed app (Vercel). This preview has no server, so everything else works but AI doesn’t.',
      'failed',
    );
  if (!navigator.onLine) throw new AIError('You’re offline. AI features need a connection — everything else works offline.', 'offline');
  const { used, limit } = await aiUsage();
  if (used >= limit) throw new AIError(`You’ve used today’s ${limit} AI requests. The limit resets tomorrow, or raise it in Settings.`, 'limit');

  const body = JSON.stringify({ task, payload });
  if (new Blob([body]).size > MAX_BODY_BYTES) throw new AIError('That’s too much data to send at once. Try a shorter date range.', 'too-large');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal });
  } catch {
    throw new AIError(
      navigator.onLine ? 'Couldn’t reach the AI coach. Please try again.' : 'You’re offline.',
      navigator.onLine ? 'failed' : 'offline',
    );
  } finally {
    clearTimeout(timer);
  }

  // Count every request that reached the server.
  await updateSettings({ aiCallsToday: used + 1, aiCallsDate: today() });

  let data: AIResponse<T>;
  try {
    data = (await res.json()) as AIResponse<T>;
  } catch {
    throw new AIError('The AI coach sent an unexpected reply. Please try again.', 'failed');
  }
  if (!data.ok) throw new AIError(data.error, data.code === 'rate-limited' ? 'limit' : 'failed');
  const parsed = resultSchemas[task].safeParse(data.result);
  if (!parsed.success) throw new AIError('The AI gave an answer we couldn’t read. Please try again.', 'failed');
  return parsed.data as AIResult<T>;
}

/** Cached result for an identical input, if one exists. */
export async function cachedReview(inputHash: string): Promise<AIReview | undefined> {
  return db.aiReviews.where('inputHash').equals(inputHash).first();
}

export async function saveReview(r: {
  scope: ReviewScope;
  rangeStart: LocalDate;
  rangeEnd: LocalDate;
  subjectId?: string;
  inputHash: string;
  result: unknown;
}): Promise<AIReview> {
  const now = nowIso();
  const existing = await cachedReview(r.inputHash);
  const review: AIReview = { ...r, id: existing?.id ?? uuid(), createdAt: existing?.createdAt ?? now, updatedAt: now };
  await db.aiReviews.put(review);
  return review;
}
