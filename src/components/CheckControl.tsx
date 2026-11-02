import { motion } from 'framer-motion';
import { Check, Minus, Plus } from 'lucide-react';
import { useRef } from 'react';
import { spring } from '@/app/motion';
import type { Entry, Habit } from '@/db/types';
import { progressOf } from '@/domain/logging';
import { colorVar } from '@/lib/colors';

interface Props {
  habit: Habit;
  entry: Entry | undefined;
  onTap: () => void;
  /** Long-press (count habits): open the exact-value sheet. */
  onLongPress?: () => void;
}

const LONG_PRESS_MS = 450;

/**
 * The one-tap control at the end of each row. A ring that fills with the
 * habit colour; partial progress draws as an arc.
 */
export function CheckControl({ habit, entry, onTap, onLongPress }: Props) {
  const progress = progressOf(habit, entry);
  const done = entry?.status === 'done' || entry?.status === 'minimum';
  const skipped = entry?.status === 'skipped';
  const color = colorVar(habit.color);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const longPressed = useRef(false);

  const size = 40;
  const r = 18;
  const c = 2 * Math.PI * r;

  const start = () => {
    longPressed.current = false;
    if (!onLongPress) return;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const cancel = () => clearTimeout(timer.current);

  const label = (() => {
    const base = habit.name;
    if (skipped) return `${base}: skipped. Tap to log.`;
    if (habit.type === 'count')
      return `${base}: ${entry?.value ?? 0} of ${habit.target}. Tap to add one${onLongPress ? ', hold to set a number' : ''}.`;
    if (habit.type === 'duration' || habit.type === 'numeric') return `${base}: ${entry?.value ?? 0} of ${habit.target} ${habit.unit}.`;
    return `${base}: ${done ? 'done' : 'not done'}.`;
  })();

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      transition={spring}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        if (longPressed.current) return;
        onTap();
      }}
      aria-label={label}
      aria-pressed={done}
      className="relative -mr-1.5 flex h-12 w-12 shrink-0 items-center justify-center"
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeOpacity={skipped ? 0.25 : 0.35}
          strokeWidth={2.8}
          strokeDasharray={skipped ? '3 3' : undefined}
        />
        {!done && progress > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: c * (1 - progress) }}
            transition={spring}
          />
        )}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r + 1.25}
          fill={color}
          initial={false}
          animate={{ scale: done ? 1 : 0, opacity: done ? (entry?.status === 'minimum' ? 0.55 : 1) : 0 }}
          style={{ transformOrigin: 'center' }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
        {done ? (
          <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}>
            <Check size={22} strokeWidth={3.2} className="text-white" />
          </motion.span>
        ) : skipped ? (
          <Minus size={18} strokeWidth={2.8} style={{ color }} />
        ) : habit.type === 'count' && (entry?.value ?? 0) > 0 ? (
          <span className="tabular text-[13px] font-semibold text-label">{entry!.value}</span>
        ) : habit.type === 'count' ? (
          <Plus size={18} strokeWidth={2.8} style={{ color }} />
        ) : null}
      </span>
    </motion.button>
  );
}
