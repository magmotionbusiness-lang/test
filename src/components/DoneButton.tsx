import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { tapHabit } from '@/app/logActions';
import { spring } from '@/app/motion';
import type { Entry, Habit, LocalDate } from '@/db/types';
import { isQuantity, progressOf } from '@/domain/logging';

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
 * A clear "Done" button for a habit on one day — the easy alternative to
 * tapping small calendar tiles. Check/avoid toggle; count adds one; amount
 * habits open the amount sheet until their target is met.
 */
export function DoneButton({ habit, entry, date, onAmount, size = 'small' }: Props) {
  const done = entry?.status === 'done' || entry?.status === 'minimum';
  const quantity = isQuantity(habit.type);
  const progress = progressOf(habit, entry);
  const value = entry && entry.status !== 'skipped' ? entry.value : 0;

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
    if (!done && (habit.type === 'duration' || habit.type === 'numeric')) onAmount();
    else void tapHabit(habit, date);
  };

  const large = size === 'large';
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      whileTap={{ scale: 0.95 }}
      transition={spring}
      aria-pressed={done}
      aria-label={`${habit.name}: ${done ? 'done. Tap to undo' : label}`}
      className={`relative flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full font-semibold transition-colors duration-300 ${
        large ? 'h-[52px] w-full text-headline' : 'h-11 min-w-[104px] px-4 text-subhead'
      } ${done ? 'bg-accent-fill text-white' : 'bg-[rgb(var(--fill)/0.14)] text-label'}`}
    >
      {/* Partial progress fills the button from the left. */}
      {!done && progress > 0 && (
        <motion.span
          className="absolute inset-y-0 left-0 bg-[rgb(var(--accent-fill)/0.22)]"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={spring}
          aria-hidden
        />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={done ? 'done' : 'todo'}
          className="relative flex items-center gap-1.5"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          {done ? (
            <Check size={large ? 22 : 18} strokeWidth={3} aria-hidden />
          ) : habit.type === 'count' ? (
            <Plus size={large ? 20 : 16} strokeWidth={2.6} aria-hidden />
          ) : null}
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
