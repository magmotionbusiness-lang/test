import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { tapHabit } from '@/app/logActions';
import { spring } from '@/app/motion';
import type { Entry, Habit, LocalDate } from '@/db/types';
import { isQuantity, progressOf } from '@/domain/logging';
import { colorVar } from '@/lib/colors';
import { rewardTap } from '@/lib/feedback';
import { Burst } from './Burst';
import { DrawnCheck } from './DrawnCheck';

interface Props {
  habit: Habit;
  entry: Entry | undefined;
  date: LocalDate;
  /** Duration/number habits ask for an amount instead of a plain toggle. */
  onAmount: () => void;
  /** `large` is the full-width button on the habit page. */
  size?: 'small' | 'large';
}

/**
 * A clear, satisfying "Done" button for a habit on one day. Check/avoid
 * toggle; count adds one; amount habits open the amount sheet until their
 * target is met. Completing it bounces, bursts, draws the check and plays a
 * pop with a light vibration.
 */
export function DoneButton({ habit, entry, date, onAmount, size = 'small' }: Props) {
  const done = entry?.status === 'done' || entry?.status === 'minimum';
  const quantity = isQuantity(habit.type);
  const progress = progressOf(habit, entry);
  const value = entry && entry.status !== 'skipped' ? entry.value : 0;
  const color = colorVar(habit.color);
  const bounce = useAnimationControls();
  const [fire, setFire] = useState(0);
  const wasDone = useRef(done);

  // Celebrate every transition to done (taps, swipes, the amount sheet), never on first render.
  useEffect(() => {
    if (done && !wasDone.current) {
      setFire((f) => f + 1);
      void bounce.start({ scale: [1, 1.12, 0.97, 1], transition: { duration: 0.45, times: [0, 0.35, 0.7, 1], ease: 'easeOut' } });
    }
    wasDone.current = done;
  }, [done, bounce]);

  const label = done
    ? 'Done'
    : habit.type === 'count'
      ? `${value}/${habit.target}`
      : quantity
        ? value > 0
          ? `${value}/${habit.target} ${habit.unit}`
          : 'Log'
        : habit.type === 'avoid'
          ? 'Stayed clean'
          : 'Mark done';

  const onClick = () => {
    if (!done && (habit.type === 'duration' || habit.type === 'numeric')) return onAmount();
    if (!done) rewardTap(habit.type === 'count' && value + 1 < habit.target ? 'tick' : 'done');
    void tapHabit(habit, date);
  };

  const large = size === 'large';
  return (
    <motion.div animate={bounce} className={`relative shrink-0 ${large ? 'w-full' : ''}`}>
      <Burst fire={fire} color={color} />
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        whileTap={{ scale: 0.93 }}
        transition={spring}
        aria-pressed={done}
        aria-label={`${habit.name}: ${done ? 'done. Tap to undo' : label}`}
        className={`relative flex items-center justify-center gap-1.5 overflow-hidden rounded-full font-semibold transition-[background-color,color,box-shadow] duration-300 ${
          large ? 'h-[56px] w-full text-headline' : 'h-11 min-w-[108px] px-4 text-subhead'
        } ${done ? 'text-white' : 'bg-[rgb(var(--fill)/0.14)] text-label'}`}
        style={
          done
            ? {
                background: `linear-gradient(135deg, rgb(var(--accent-fill)), color-mix(in srgb, rgb(var(--accent-fill)) 70%, ${color}))`,
                boxShadow: '0 6px 18px rgb(var(--accent-fill) / 0.35)',
              }
            : undefined
        }
      >
        {/* Partial progress fills the button from the left. */}
        {!done && progress > 0 && (
          <motion.span
            className="absolute inset-y-0 left-0"
            style={{ background: `color-mix(in srgb, ${color} 28%, transparent)` }}
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={spring}
            aria-hidden
          />
        )}
        {/* A sheen sweeps across when it turns done. */}
        {done && fire > 0 && (
          <motion.span
            key={fire}
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/30"
            initial={{ left: '-40%' }}
            animate={{ left: '120%' }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            aria-hidden
          />
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={done ? 'done' : 'todo'}
            className="relative flex items-center gap-1.5"
            initial={{ opacity: 0, scale: 0.5, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -6 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            {done ? (
              <DrawnCheck size={large ? 22 : 18} />
            ) : habit.type === 'count' ? (
              <Plus size={large ? 20 : 16} strokeWidth={2.6} aria-hidden />
            ) : null}
            {label}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}
