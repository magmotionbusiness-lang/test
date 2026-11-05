import { inJsLoop } from '@/app/motion';
import { animate, AnimatePresence, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Pencil, RotateCw, Sparkles, Target, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AIError, callAI } from '@/ai/client';
import { visionStepsResult, type VisionStepsResult } from '@/ai/schemas';
import { useOnline } from '@/app/useOnline';
import { db } from '@/db/db';
import { updateVisionSection } from '@/db/repo';
import type { VisionSection } from '@/db/types';
import { today } from '@/domain/dates';
import { goalProgress } from '@/domain/goals';
import { colorVar } from '@/lib/colors';
import { haptic } from '@/lib/feedback';
import { formatPercent } from '@/lib/format';
import { useBlobUrl } from '@/lib/useBlobUrl';
import { GoalForm } from '../GoalForm';
import { Polaroid } from './Polaroid';

export interface Origin {
  /** Centre of the tile on screen and its unrotated width. */
  cx: number;
  cy: number;
  w: number;
}

interface Props {
  section: VisionSection;
  tilt: number;
  /** Where the tile sits on the board right now (measured again on close). */
  getOrigin: () => Origin | null;
  onEdit: () => void;
  onClosed: () => void;
}

/** Opening: a long, soft landing. Closing: quicker, like setting the photo back down. */
const FLY_IN = { duration: 0.85, ease: [0.16, 1, 0.3, 1] } as const;
const FLY_OUT = { duration: 0.5, ease: [0.32, 0.72, 0, 1] } as const;
const CADENCE: Record<VisionStepsResult['actions'][number]['cadence'], string> = {
  once: 'Once',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/**
 * A vision tile, opened. The polaroid lifts off the board, straightens and
 * glides to the centre while the room dims and takes on the photo's colours;
 * the photo develops, and the words rise in underneath. Closing flies it back
 * to its exact spot on the board.
 */
export function VisionDetail({ section, tilt, getOrigin, onEdit, onClosed }: Props) {
  const navigate = useNavigate();
  const online = useOnline();
  const photoUrl = useBlobUrl(section.photoId);
  const goal = useLiveQuery(() => (section.goalId ? db.goals.get(section.goalId) : undefined), [section.goalId]);
  const color = colorVar(section.color);

  const polaroidRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);
  const [closing, setClosing] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [ai, setAi] = useState<{ kind: 'idle' | 'loading' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const breakdown = visionStepsResult.safeParse(section.breakdown);

  // Fly in from the tile (FLIP: start where the tile is, animate to the natural spot).
  useLayoutEffect(() => {
    const el = polaroidRef.current;
    const from = getOrigin();
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    x.set(from.cx - (to.left + to.width / 2));
    y.set(from.cy - (to.top + to.height / 2));
    scale.set(from.w / to.width);
    rotate.set(tilt);
    void animate(x, 0, FLY_IN);
    void animate(y, 0, FLY_IN);
    void animate(scale, 1, FLY_IN);
    // The tilt settles with a little give, like paper.
    void animate(rotate, 0, { type: 'spring', stiffness: 70, damping: 9, mass: 0.9 });
    haptic();
    // Runs once, on open.
  }, []);

  const close = () => {
    if (closing) return;
    setClosing(true);
    const el = polaroidRef.current;
    const to = getOrigin();
    if (!el || !to) return onClosed();
    // Where the polaroid's untransformed box is, so the deltas land it exactly on the tile.
    const r = el.getBoundingClientRect();
    const s = scale.get();
    const cx = r.left + r.width / 2 - x.get();
    const cy = r.top + r.height / 2 - y.get();
    const naturalW = r.width / s;
    void animate(x, to.cx - cx, FLY_OUT);
    void animate(y, to.cy - cy, FLY_OUT);
    void animate(rotate, tilt, FLY_OUT);
    void animate(scale, to.w / naturalW, FLY_OUT).then(onClosed);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 700) close();
    else void animate(y, 0, { type: 'spring', stiffness: 400, damping: 32 });
  };

  const askAI = async () => {
    setAi({ kind: 'loading' });
    try {
      const result = await callAI('visionSteps', {
        area: section.title.slice(0, 60) || 'Life',
        vision: section.description.slice(0, 1000),
        progress: Math.max(0, Math.min(4, Math.round(section.progress))),
        linkedGoal: goal?.title ?? null,
        today: today(),
      });
      await updateVisionSection(section.id, { breakdown: result });
      setAi({ kind: 'idle' });
    } catch (e) {
      setAi({ kind: 'error', message: e instanceof AIError ? e.message : 'Something went wrong. Please try again.' });
    }
  };

  const rise = (i: number) => ({
    onUpdate: inJsLoop,
    initial: { opacity: 0, y: 28, filter: 'blur(6px)' },
    animate: closing ? { opacity: 0, y: 16, filter: 'blur(4px)', transition: { duration: 0.2 } } : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.7, delay: 0.45 + i * 0.09, ease: [0.16, 1, 0.3, 1] },
  });

  return createPortal(
    <div className="fixed inset-0 z-[43]" role="dialog" aria-modal="true" aria-label={section.title}>
      {/* The room dims and takes on the photo's colours. */}
      <motion.div
        className="absolute inset-0 overflow-hidden bg-[#07060a]/80 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        onUpdate={inJsLoop}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: closing ? 0.45 : 0.6, ease: 'easeOut' }}
        onClick={close}
      >
        {photoUrl ? (
          <motion.img
            src={photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full scale-125 object-cover blur-[60px]"
            initial={{ opacity: 0 }}
            onUpdate={inJsLoop}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 1.4, delay: 0.2 }}
          />
        ) : (
          <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(60% 45% at 50% 30%, ${color}, transparent 70%)` }} />
        )}
        {/* A warm light leak drifts across once, like the start of a film. */}
        <motion.div
          className="absolute -inset-y-1/4 w-2/3 -skew-x-12"
          style={{ background: 'linear-gradient(90deg, transparent, rgb(255 190 140 / 0.16), transparent)' }}
          initial={{ left: '-70%' }}
          animate={{ left: '120%' }}
          transition={{ duration: 2.4, delay: 0.3, ease: [0.45, 0, 0.2, 1] }}
        />
      </motion.div>

      <div className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar">
        <div className="mx-auto flex min-h-full max-w-[460px] flex-col items-center px-6 pb-[calc(env(safe-area-inset-bottom)+40px)] pt-[calc(env(safe-area-inset-top)+64px)]">
          <motion.div
            ref={polaroidRef}
            className="relative z-10 w-[min(70vw,300px)] touch-pan-x"
            style={{ x, y, scale, rotate }}
            // Pull the photo down to put it back on the board.
            drag="y"
            dragMomentum={false}
            onDragEnd={onDragEnd}
            onClick={() => !section.photoId && onEdit()}
          >
            <Polaroid
              section={section}
              photoUrl={photoUrl}
              develop
              onProgress={(n) => {
                haptic();
                void updateVisionSection(section.id, { progress: n });
              }}
            />
          </motion.div>

          <motion.div {...rise(0)} className="mt-7 w-full text-center">
            <h2 className="font-serif text-[34px] font-semibold italic leading-tight text-white">
              <span className="mr-2 not-italic" aria-hidden>
                {section.emoji}
              </span>
              {section.title}
            </h2>
          </motion.div>

          <motion.div {...rise(1)} className="mt-4 w-full">
            {section.description ? (
              <button onClick={onEdit} className="block w-full text-left">
                <p
                  className="whitespace-pre-line border-l-2 pl-4 font-serif text-[19px] leading-relaxed text-white/90"
                  style={{ borderColor: color }}
                >
                  {section.description}
                </p>
              </button>
            ) : (
              <button
                onClick={onEdit}
                className="w-full rounded-2xl border border-dashed border-white/25 px-4 py-4 text-left text-subhead text-white/70"
              >
                Write what this looks like when it comes true, so you can come back and read it.
              </button>
            )}
          </motion.div>

          <motion.div {...rise(2)} className="mt-6 grid w-full grid-cols-2 gap-3">
            {goal ? (
              <button
                onClick={() => navigate(`/goals/${goal.id}`)}
                className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-white px-4 text-headline text-[#111]"
              >
                <Target size={18} aria-hidden />
                <span className="truncate">Goal · {formatPercent(goalProgress(goal))}</span>
              </button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setGoalOpen(true)}
                className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-white px-4 text-headline text-[#111]"
              >
                <Target size={18} aria-hidden /> Make it a goal
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={askAI}
              disabled={!online || ai.kind === 'loading'}
              className="relative flex h-[52px] items-center justify-center gap-2 overflow-hidden rounded-full px-4 text-headline text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(120deg, #6d5cff, #b45cff 55%, #ff5fa2)' }}
            >
              <span className="shimmer-sweep pointer-events-none absolute inset-0" aria-hidden />
              {ai.kind === 'loading' ? (
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }} aria-hidden>
                  <Sparkles size={18} />
                </motion.span>
              ) : (
                <Sparkles size={18} aria-hidden />
              )}
              {breakdown.success ? 'Refresh plan' : 'Break it down'}
            </motion.button>
          </motion.div>
          {!online && <p className="mt-2 text-center text-footnote text-white/60">You’re offline. The AI needs a connection.</p>}

          <AnimatePresence mode="wait" initial={false}>
            {ai.kind === 'loading' ? (
              <motion.div key="loading" {...fade} className="mt-5 w-full space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="relative h-16 overflow-hidden rounded-2xl bg-white/[0.07]">
                    <span className="shimmer-sweep absolute inset-0" style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1.6s' }} />
                  </div>
                ))}
              </motion.div>
            ) : ai.kind === 'error' ? (
              <motion.div key="error" {...fade} className="mt-5 w-full rounded-2xl bg-white/[0.07] p-4 text-subhead text-white/85">
                <p>{ai.message}</p>
                <button onClick={askAI} className="mt-2 flex items-center gap-1.5 font-semibold text-white">
                  <RotateCw size={15} aria-hidden /> Try again
                </button>
              </motion.div>
            ) : breakdown.success ? (
              <motion.div key="plan" {...fade} className="w-full">
                <Breakdown plan={breakdown.data} color={color} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Glass controls, always within reach, over a soft shade so scrolled content doesn't fight them. */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/45 to-transparent px-4 pb-6 pt-[calc(env(safe-area-inset-top)+10px)]"
        initial={{ opacity: 0 }}
        onUpdate={inJsLoop}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.4, delay: closing ? 0 : 0.35 }}
      >
        <GlassButton label="Close" onClick={close}>
          <X size={20} aria-hidden />
        </GlassButton>
        <GlassButton label={`Edit ${section.title}`} onClick={onEdit}>
          <Pencil size={18} aria-hidden />
        </GlassButton>
      </motion.div>

      <GoalForm
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        initial={{
          title: section.title,
          why: section.description,
          milestones: breakdown.success ? breakdown.data.milestones : undefined,
        }}
        onCreated={(id) => void updateVisionSection(section.id, { goalId: id })}
      />
    </div>,
    document.body,
  );
}

const fade = {
  onUpdate: inJsLoop,
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
} as const;

function GlassButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md"
    >
      {children}
    </button>
  );
}

function Breakdown({ plan, color }: { plan: VisionStepsResult; color: string }) {
  const item = (i: number) => ({
    onUpdate: inJsLoop,
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: 0.08 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  });
  return (
    <div className="mt-6 space-y-4">
      <p className="text-center font-serif text-[20px] italic leading-snug text-white">{plan.headline}</p>

      <motion.div
        {...item(0)}
        className="rounded-2xl p-4 text-white"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 55%, transparent), rgb(255 255 255 / 0.06))` }}
      >
        <div className="text-caption font-semibold uppercase tracking-[0.18em] text-white/75">Start today</div>
        <div className="mt-1 text-headline">{plan.firstStep.action}</div>
        <div className="mt-0.5 text-subhead text-white/75">{plan.firstStep.why}</div>
      </motion.div>

      <div className="overflow-hidden rounded-2xl bg-white/[0.07] [&>*+*]:border-t [&>*+*]:border-white/10">
        {plan.actions.map((a, i) => (
          <motion.div key={a.action} {...item(i + 1)} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-caption font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-body font-semibold text-white">{a.action}</span>
                <span className="mt-0.5 shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-caption font-semibold text-white/85">
                  {CADENCE[a.cadence]}
                </span>
              </div>
              <div className="mt-0.5 text-subhead text-white/65">{a.why}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div {...item(plan.actions.length + 1)} className="rounded-2xl bg-white/[0.07] p-4">
        <div className="text-caption font-semibold uppercase tracking-[0.18em] text-white/60">Milestones</div>
        <ol className="mt-2 space-y-1.5">
          {plan.milestones.map((m) => (
            <li key={m} className="flex items-center gap-2 text-subhead text-white/90">
              <ArrowRight size={14} className="shrink-0 text-white/50" aria-hidden /> {m}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-caption text-white/50">“Make it a goal” adds these as the goal’s milestones.</p>
      </motion.div>
    </div>
  );
}
