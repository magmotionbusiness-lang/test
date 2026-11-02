import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildPrompt, repairPrompt, SYSTEM_PROMPT } from '../src/ai/prompts.js';
import type { ZodTypeAny } from 'zod';
import { aiRequest, MAX_BODY_BYTES, resultSchemas, type AIResponse } from '../src/ai/schemas.js';

/**
 * POST /api/ai — the only place the Gemini key is used.
 * Validates input size and shape, builds the prompt server-side, calls Gemini
 * with a timeout, validates the JSON reply (retrying once), returns typed JSON.
 */

const DEFAULT_MODEL = 'gemini-flash-lite-latest';
const TIMEOUT_MS = 25_000;
/** Server-side sanity cap per IP per day (the client enforces the user's own limit). */
const SERVER_DAILY_CAP = 100;

const usage = new Map<string, { day: string; count: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, body: AIResponse) => res.status(status).json(body);

  if (req.method !== 'POST') return send(405, { ok: false, code: 'bad-request', error: 'Use POST.' });

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return send(413, { ok: false, code: 'too-large', error: 'Request is too large.' });

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return send(400, { ok: false, code: 'bad-request', error: 'Body must be JSON.' });
  }
  const parsed = aiRequest.safeParse(body);
  if (!parsed.success) return send(400, { ok: false, code: 'bad-request', error: 'Unknown task or malformed payload.' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(503, { ok: false, code: 'not-configured', error: 'The AI coach isn’t set up yet (GEMINI_API_KEY is missing).' });

  const ip = String(req.headers['x-forwarded-for'] ?? 'unknown')
    .split(',')[0]!
    .trim();
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(ip);
  const count = u && u.day === day ? u.count : 0;
  if (count >= SERVER_DAILY_CAP) return send(429, { ok: false, code: 'rate-limited', error: 'Daily AI limit reached. Try again tomorrow.' });
  usage.set(ip, { day, count: count + 1 });

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const schema: ZodTypeAny = resultSchemas[parsed.data.task];
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [{ role: 'user', parts: [{ text: buildPrompt(parsed.data) }] }];

  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      text = await callGemini(key, model, contents);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('gemini error', msg);
      return send(502, {
        ok: false,
        code: 'upstream',
        error: msg.includes('abort') ? 'The AI took too long to answer.' : explainGeminiError(msg),
      });
    }
    const check = validate(text, schema);
    if (check.ok) return send(200, { ok: true, result: check.value } as AIResponse);
    console.warn('invalid model output', check.error);
    contents.push({ role: 'model', parts: [{ text }] }, { role: 'user', parts: [{ text: repairPrompt(check.error) }] });
  }
  return send(502, { ok: false, code: 'invalid-output', error: 'The AI gave an answer we couldn’t read. Please try again.' });
}

async function callGemini(key: string, model: string, contents: unknown[]): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 4096 },
      }),
    });
    if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
  } finally {
    clearTimeout(timer);
  }
}

function validate(text: string, schema: ZodTypeAny) {
  let value: unknown;
  try {
    // Tolerate stray code fences.
    value = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ok: false as const, error: 'Reply was not valid JSON.' };
  }
  const r = schema.safeParse(value);
  return r.success ? { ok: true as const, value: r.data } : { ok: false as const, error: r.error.message };
}

/**
 * Turns Gemini's error into a plain explanation the user can act on (the key
 * itself is never echoed). Unknown errors include Google's own short message.
 */
function explainGeminiError(raw: string): string {
  const status = Number(raw.match(/Gemini HTTP (\d+)/)?.[1] ?? 0);
  let reason = '';
  try {
    const body = JSON.parse(raw.slice(raw.indexOf('{'))) as { error?: { status?: string; message?: string } };
    reason = `${body.error?.status ?? ''} ${body.error?.message ?? ''}`.trim();
  } catch {
    reason = raw.replace(/^Gemini HTTP \d+:\s*/, '');
  }
  reason = reason.replace(/AIza[\w-]{20,}|AQ\.[\w-]{20,}/g, '[key]').slice(0, 180);
  const r = reason.toLowerCase();
  if (r.includes('api key not valid') || r.includes('api_key_invalid') || r.includes('invalid api key'))
    return 'Google says the API key isn’t valid. Copy the key again from Google AI Studio into GEMINI_API_KEY on Vercel (no spaces or quotes), then redeploy.';
  if (r.includes('location is not supported') || r.includes('user location'))
    return 'Google says Gemini isn’t available for this account’s region without billing. Turn on billing for the key in Google AI Studio, then try again.';
  if (r.includes('billing') || r.includes('free tier'))
    return 'Google says billing needs to be set up for this key. Finish billing in Google AI Studio, then try again.';
  if (status === 403 || r.includes('permission_denied') || r.includes('referer') || r.includes('blocked'))
    return `Google refused the key (permission denied). If the key has website or app restrictions in Google Cloud, remove them. Details: ${reason}`;
  if (status === 429 || r.includes('resource_exhausted') || r.includes('quota'))
    return 'Google’s quota for this key is used up for now. Try again later, or raise the quota/billing in Google AI Studio.';
  if (status === 404 || r.includes('not found'))
    return `Google couldn’t find the AI model. Check or remove GEMINI_MODEL on Vercel. Details: ${reason}`;
  return `The AI service returned an error (${status || 'network'}). Details: ${reason || 'none'}`;
}
