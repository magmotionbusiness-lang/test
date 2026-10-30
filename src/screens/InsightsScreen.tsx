import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AIError, cachedReview, callAI, hashInput, saveReview } from '@/ai/client';
import { reviewResult, type ReviewResult } from '@/ai/schemas';
import { useOnline } from '@/app/useOnline';
import { useSettings } from '@/app/useSettings';
import { db } from '@/db/db';
import type { AIReview, LocalDate } from '@/db/types';
import { Page } from '@/components/Page';
import { ErrorCard, ReviewCards, SkeletonCards } from '@/components/ReviewCards';
import { Sheet } from '@/components/Sheet';
import { EmptyState, ListGroup, ListRow, PrimaryButton, Segmented } from '@/components/ui';
import { buildReviewPayload } from '@/domain/aggregate';
import { daysBetween, formatDay, shiftDate, today as todayFn, weekStartOf } from '@/domain/dates';

type Range = 'day' | 'week' | 'month' | 'custom';
const RANGE_LABEL: Record<Range, string> = { day: 'Today', week: 'This week', month: 'This month', custom: 'Custom range' };
const MAX_CUSTOM_DAYS = 92;

export function InsightsScreen() {
  const settings = useSettings();
  const online = useOnline();
  const navigate = useNavigate();
  const location = useLocation();
  const today = todayFn();
  const [range, setRange] = useState<Range>('week');
  const [customFrom, setCustomFrom] = useState(shiftDate(today, -13));
  const [customTo, setCustomTo] = useState(today);
  const [sectionId, setSectionId] = useState<string | undefined>((location.state as { sectionId?: string } | null)?.sectionId);
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' } | { kind: 'error'; message: string; offline: boolean }>({ kind: 'idle' });
  const [hash, setHash] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AIReview | null>(null);

  useEffect(() => {
    const s = (location.state as { sectionId?: string } | null)?.sectionId;
    if (s) setSectionId(s);
  }, [location.state]);

  const { from, to } = useMemo(() => {
    if (range === 'day') return { from: today, to: today };
    if (range === 'week') return { from: weekStartOf(today, settings.weekStart), to: today };
    if (range === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
    const a = customFrom <= customTo ? customFrom : customTo;
    const b = customFrom <= customTo ? customTo : customFrom;
    return { from: daysBetween(a, b) >= MAX_CUSTOM_DAYS ? shiftDate(b, -(MAX_CUSTOM_DAYS - 1)) : a, to: b > today ? today : b };
  }, [range, today, settings.weekStart, customFrom, customTo]);

  const days = daysBetween(from, to) + 1;
  const data = useLiveQuery(async () => {
    const [habits, sections, entries, notes, goals, reviews] = await Promise.all([
      db.habits.toArray(),
      db.sections.toArray(),
      db.entries
        .where('date')
        .between(shiftDate(from, -Math.max(days, 30) - 400), to, true, true)
        .toArray(),
      db.dailyNotes.where('date').between(from, to, true, true).toArray(),
      db.goals.toArray(),
      db.aiReviews
        .orderBy('updatedAt')
        .reverse()
        .filter((r) => r.scope !== 'goal')
        .toArray(),
    ]);
    return { habits, sections, entries, notes, goals, reviews };
  }, [from, to, days]);

  const section = data?.sections.find((s) => s.id === sectionId);
  const label = `${RANGE_LABEL[range]}${section ? ` · ${section.name}` : ''}`;

  const payload = useMemo(
    () =>
      data && data.habits.length
        ? buildReviewPayload({ ...data, from, to, today, weekStart: settings.weekStart, includeNotes: settings.includeNotesInAI, sectionId, label })
        : null,
    [data, from, to, today, settings.weekStart, settings.includeNotesInAI, sectionId, label],
  );

  useEffect(() => {
    let live = true;
    setHash(null);
    if (payload) void hashInput('review', payload).then((h) => live && setHash(h));
    return () => {
      live = false;
    };
  }, [payload]);

  const current = useLiveQuery(async () => (hash ? ((await cachedReview(hash)) ?? null) : null), [hash]);

  const generate = async () => {
    if (!payload || !hash) return;
    setStatus({ kind: 'loading' });
    try {
      const result = await callAI('review', payload);
      await saveReview({ scope: range, rangeStart: from, rangeEnd: to, subjectId: sectionId, inputHash: hash, result: { label, data: result } });
      setStatus({ kind: 'idle' });
    } catch (e) {
      const err = e instanceof AIError ? e : new AIError('Something went wrong. Please try again.', 'failed');
      setStatus({ kind: 'error', message: err.message, offline: err.kind === 'offline' });
    }
  };

  const unwrap = (r: unknown): { label?: string; data: ReviewResult } | null => {
    const obj = r as { label?: string; data?: unknown };
    const p = reviewResult.safeParse(obj?.data);
    return p.success ? { label: obj.label, data: p.data } : null;
  };
  const shown = current ? unwrap(current.result) : null;

  const past = (data?.reviews ?? []).filter((r) => r.id !== current?.id).slice(0, 20);

  return (
    <Page title="Insights">
      <Segmented
        label="Review range"
        value={range}
        onChange={(r) => {
          setRange(r);
          setStatus({ kind: 'idle' });
        }}
        options={[
          { value: 'day', label: 'Today' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'custom', label: 'Custom' },
        ]}
      />

      {range === 'custom' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DateField label="From" value={customFrom} max={today} onChange={setCustomFrom} />
          <DateField label="To" value={customTo} max={today} onChange={setCustomTo} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-footnote text-secondary">
        <span>
          {formatDay(from, 'd MMM')}
          {from !== to ? ` – ${formatDay(to, 'd MMM')}` : ''} · compared with the {days === 1 ? 'day' : `${days} days`} before
        </span>
        {section && (
          <button
            onClick={() => setSectionId(undefined)}
            className="flex h-7 items-center gap-1 rounded-full bg-bg-2 px-2.5 text-footnote font-medium text-label"
            aria-label={`Remove ${section.name} filter`}
          >
            {section.emoji} {section.name} <X size={13} aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-4">
        {data && data.habits.length === 0 ? (
          <EmptyState title="Nothing to review yet" message="Add a few habits and log some days — your coach will have plenty to say." />
        ) : status.kind === 'loading' ? (
          <SkeletonCards />
        ) : shown ? (
          <>
            {status.kind === 'error' && (
              <div className="mb-3">
                <ErrorCard message={status.message} offline={status.offline} onRetry={generate} />
              </div>
            )}
            <ReviewCards
              result={shown.data}
              meta={`Generated ${formatDay(current!.updatedAt.slice(0, 10), 'd MMM')} at ${new Date(current!.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · cached`}
              onRefresh={online ? generate : undefined}
            />
          </>
        ) : status.kind === 'error' ? (
          <ErrorCard message={status.message} offline={status.offline} onRetry={generate} />
        ) : !online ? (
          <ErrorCard offline message="AI reviews need a connection. Your past reviews below are still available." />
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, var(--c-indigo), var(--c-purple))' }}
            >
              <Sparkles size={26} className="text-white" aria-hidden />
            </div>
            <h2 className="text-title3">Review {RANGE_LABEL[range].toLowerCase()}</h2>
            <p className="mt-1 max-w-xs text-subhead text-secondary">
              Your coach looks at {section ? `${section.name}` : 'your habits'}, compares with the period before and suggests next steps. Only
              summaries leave your device.
            </p>
            <div className="mt-5">
              <PrimaryButton onClick={generate} disabled={!payload || !hash}>
                Generate review
              </PrimaryButton>
            </div>
            <button onClick={() => navigate('/settings', { state: { focus: 'ai' } })} className="mt-3 h-9 text-footnote text-accent">
              See what gets sent
            </button>
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="mt-8">
          <ListGroup header="Past reviews">
            {past.map((r) => {
              const u = unwrap(r.result);
              return (
                <ListRow
                  key={r.id}
                  title={u?.data.headline ?? 'Review'}
                  subtitle={`${u?.label ?? r.scope} · ${formatDay(r.rangeStart, 'd MMM')}${r.rangeStart !== r.rangeEnd ? ` – ${formatDay(r.rangeEnd, 'd MMM')}` : ''}`}
                  detail={u ? <span className="tabular">{Math.round(u.data.score)}</span> : undefined}
                  chevron
                  onClick={() => setViewing(r)}
                />
              );
            })}
          </ListGroup>
        </div>
      )}

      <Sheet open={viewing !== null} onClose={() => setViewing(null)} title={viewing ? (unwrap(viewing.result)?.label ?? 'Review') : ''}>
        {viewing && unwrap(viewing.result) && (
          <ReviewCards
            result={unwrap(viewing.result)!.data}
            meta={`${formatDay(viewing.rangeStart, 'd MMM')} – ${formatDay(viewing.rangeEnd, 'd MMM yyyy')}`}
          />
        )}
      </Sheet>
    </Page>
  );
}

function DateField({ label, value, max, onChange }: { label: string; value: LocalDate; max: LocalDate; onChange: (v: LocalDate) => void }) {
  return (
    <label className="flex h-11 items-center justify-between gap-2 rounded-row bg-bg-2 px-3">
      <span className="text-subhead text-secondary">{label}</span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="bg-transparent text-subhead outline-none"
      />
    </label>
  );
}
