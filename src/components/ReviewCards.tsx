import { motion } from 'framer-motion';
import { ArrowRight, CircleCheck, CircleAlert, Lightbulb, RefreshCw, Target, WifiOff } from 'lucide-react';
import type { ReviewResult } from '@/ai/schemas';
import { spring } from '@/app/motion';
import { Card, ProgressRing } from './ui';

const GOAL_LABEL = { 'on-track': 'On track', behind: 'Behind', ahead: 'Ahead', unclear: 'Unclear' } as const;

export function ReviewCards({
  result,
  meta,
  onRefresh,
  refreshing,
}: {
  result: ReviewResult;
  meta?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="grid gap-3">
      <Card>
        <div className="flex items-center gap-4">
          <div className="relative">
            <ProgressRing value={result.score} total={100} size={64} stroke={6} label={`Score ${result.score} out of 100`} />
            <span className="tabular absolute inset-0 flex items-center justify-center text-headline">{Math.round(result.score)}</span>
          </div>
          <h2 className="text-title3">{result.headline}</h2>
        </div>
        <p className="mt-3 text-body">{result.summary}</p>
        {(meta || onRefresh) && (
          <div className="mt-3 flex items-center justify-between gap-2 text-footnote text-secondary">
            <span>{meta}</span>
            {onRefresh && (
              <button onClick={onRefresh} disabled={refreshing} className="flex h-9 items-center gap-1.5 text-accent disabled:opacity-40">
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden /> Refresh
              </button>
            )}
          </div>
        )}
      </Card>

      {result.strong.length > 0 && (
        <Card>
          <CardTitle icon={<CircleCheck size={18} className="text-success" aria-hidden />}>Strong</CardTitle>
          <Points items={result.strong} />
        </Card>
      )}
      {result.weak.length > 0 && (
        <Card>
          <CardTitle icon={<CircleAlert size={18} className="text-[var(--c-orange)]" aria-hidden />}>Needs care</CardTitle>
          <Points items={result.weak} />
        </Card>
      )}
      {result.patterns.length > 0 && (
        <Card>
          <CardTitle icon={<Lightbulb size={18} className="text-[var(--c-yellow)]" aria-hidden />}>Patterns</CardTitle>
          <ul className="grid gap-2">
            {result.patterns.map((p, i) => (
              <li key={i} className="text-subhead">
                {p}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {result.goals.length > 0 && (
        <Card>
          <CardTitle icon={<Target size={18} className="text-accent" aria-hidden />}>Goals</CardTitle>
          <ul className="grid gap-2.5">
            {result.goals.map((g, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-headline">{g.goal}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${
                      g.status === 'behind'
                        ? 'bg-danger/15 text-danger'
                        : g.status === 'unclear'
                          ? 'bg-[rgb(var(--fill)/0.16)] text-secondary'
                          : 'bg-success/15 text-success'
                    }`}
                  >
                    {GOAL_LABEL[g.status]}
                  </span>
                </div>
                <p className="text-subhead text-secondary">{g.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardTitle icon={<ArrowRight size={18} className="text-accent" aria-hidden />}>Next steps</CardTitle>
        <ol className="grid gap-3">
          {result.nextSteps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-headline">{s.action}</span>
                <span className="block text-subhead text-secondary">{s.why}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
      <p className="px-4 text-center text-caption text-secondary">AI can make mistakes. Every number here comes from your own data.</p>
    </motion.div>
  );
}

function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-headline">
      {icon}
      {children}
    </h3>
  );
}

function Points({ items }: { items: { title: string; detail: string }[] }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((p, i) => (
        <li key={i}>
          <div className="text-subhead font-semibold">{p.title}</div>
          <div className="text-subhead text-secondary">{p.detail}</div>
        </li>
      ))}
    </ul>
  );
}

export function SkeletonCards() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Your review is being written">
      {[96, 72, 72, 88].map((h, i) => (
        <Card key={i}>
          <div className="animate-pulse">
            <div className="mb-3 h-4 w-1/3 rounded bg-[rgb(var(--fill)/0.18)]" />
            <div className="mb-2 h-3 w-full rounded bg-[rgb(var(--fill)/0.14)]" />
            <div className="h-3 rounded bg-[rgb(var(--fill)/0.14)]" style={{ width: `${h}%` }} />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ErrorCard({ message, offline, onRetry }: { message: string; offline?: boolean; onRetry?: () => void }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--fill)/0.14)]">
        {offline ? <WifiOff size={20} className="text-secondary" aria-hidden /> : <CircleAlert size={20} className="text-secondary" aria-hidden />}
      </div>
      <p className="text-headline">{offline ? 'You’re offline' : 'That didn’t work'}</p>
      <p className="mx-auto mt-1 max-w-xs text-subhead text-secondary">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 h-11 rounded-full bg-accent px-5 text-headline text-white">
          Retry
        </button>
      )}
    </Card>
  );
}
