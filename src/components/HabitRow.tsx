import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Check, Ellipsis, Flame, SkipForward } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Entry, Habit } from '@/db/types';
import type { Streak } from '@/domain/streaks';
import { formatStreak } from '@/domain/streaks';
import { colorVar } from '@/lib/colors';
import { CheckControl } from './CheckControl';

interface Props {
  habit: Habit;
  entry: Entry | undefined;
  sectionColor: string;
  streak?: Streak;
  onTap: () => void;
  onLongPress?: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onMore: () => void;
  onOpen: () => void;
}

const ACTIONS_WIDTH = 148;
const COMPLETE_THRESHOLD = 96;

/**
 * Today-list row. Tap the control to log; tap the row to open the habit.
 * Swipe right to complete; swipe left to reveal Skip and More.
 */
export function HabitRow({ habit, entry, sectionColor, streak, onTap, onLongPress, onComplete, onSkip, onMore, onOpen }: Props) {
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  // Set while a swipe is in progress so the click that ends it doesn't open the habit.
  const dragged = useRef(false);
  const completeOpacity = useTransform(x, [0, COMPLETE_THRESHOLD], [0, 1]);
  const completeScale = useTransform(x, [0, COMPLETE_THRESHOLD], [0.6, 1]);
  const done = entry?.status === 'done' || entry?.status === 'minimum';

  const settle = (to: number) => {
    void animate(x, to, { type: 'spring', stiffness: 400, damping: 30 });
    setOpen(to !== 0);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => (dragged.current = false), 80);
    const dx = info.offset.x + (open ? -ACTIONS_WIDTH : 0);
    if (dx > COMPLETE_THRESHOLD) {
      settle(0);
      if (!done) onComplete();
    } else if (dx < -ACTIONS_WIDTH / 2 || info.velocity.x < -400) settle(-ACTIONS_WIDTH);
    else settle(0);
  };

  const subtitle =
    habit.type === 'count' || habit.type === 'duration' || habit.type === 'numeric'
      ? `${entry?.value ?? 0} / ${habit.target} ${habit.unit}`
      : entry?.status === 'minimum'
        ? habit.minimumVersion || 'Minimum version'
        : habit.cue;

  return (
    <div className="relative overflow-hidden">
      {/* Swipe-right background: complete */}
      <div className="absolute inset-0 flex items-center bg-success pl-5" aria-hidden>
        <motion.span style={{ opacity: completeOpacity, scale: completeScale }} className="flex items-center gap-2 font-semibold text-white">
          <Check size={22} strokeWidth={3} /> Done
        </motion.span>
      </div>
      {/* Swipe-left actions */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_WIDTH }} aria-hidden={!open}>
        <button
          tabIndex={open ? 0 : -1}
          onClick={() => {
            settle(0);
            onSkip();
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-[#8E8E93] text-caption font-medium text-white"
        >
          <SkipForward size={20} aria-hidden />
          Skip
        </button>
        <button
          tabIndex={open ? 0 : -1}
          onClick={() => {
            settle(0);
            onMore();
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-accent text-caption font-medium text-white"
        >
          <Ellipsis size={20} aria-hidden />
          More
        </button>
      </div>

      <motion.div
        style={{ x, touchAction: 'pan-y' }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTIONS_WIDTH, right: COMPLETE_THRESHOLD + 40 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={onDragEnd}
        className="relative flex min-h-[60px] items-center gap-3 bg-bg-2 py-2 pl-4 pr-3"
      >
        <button
          type="button"
          onClick={() => {
            if (dragged.current) return;
            if (open) settle(0);
            else onOpen();
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Open ${habit.name}`}
        >
          <span className="text-[24px] leading-none" aria-hidden>
            {habit.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-body transition-colors ${done ? 'text-secondary' : ''}`}>{habit.name}</span>
            <span className="flex items-center gap-1.5 text-footnote text-secondary">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: sectionColor }} aria-hidden />
              <span className="truncate">{subtitle || ' '}</span>
            </span>
          </span>
          {streak && streak.current > 0 && (
            <span
              className="tabular flex shrink-0 items-center gap-0.5 text-footnote font-medium"
              style={{ color: colorVar('orange') }}
              aria-label={`Streak ${streak.current} ${streak.unit}s`}
            >
              <Flame size={14} strokeWidth={2.2} aria-hidden />
              {formatStreak(streak)}
            </span>
          )}
        </button>
        <CheckControl habit={habit} entry={entry} onTap={() => !dragged.current && onTap()} onLongPress={onLongPress} />
      </motion.div>
    </div>
  );
}
