import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { spring } from '@/app/motion';
import { updateGoal } from '@/db/repo';
import type { Goal } from '@/db/types';
import { applyProgress, quickAmounts, type ProgressMode } from '@/domain/goals';
import { rewardTap } from '@/lib/feedback';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import { Segmented } from './ui';

const MODES: { value: ProgressMode; label: string }[] = [
  { value: 'add', label: 'Add' },
  { value: 'remove', label: 'Remove' },
  { value: 'set', label: 'Set total' },
];

interface Props {
  goal: Goal;
  /** Which tab the sheet opens on; null keeps it closed. */
  mode: ProgressMode | null;
  onClose: () => void;
}

/**
 * Update a goal's number by any amount: add some, take some away, or type
 * the new total. Quick amounts sized to the target fill the field in one tap.
 */
export function GoalProgressSheet({ goal, mode: openMode, onClose }: Props) {
  const [mode, setMode] = useState<ProgressMode>('add');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!openMode) return;
    setMode(openMode);
    setText(openMode === 'set' ? String(goal.currentValue ?? 0) : '');
    // Only when the sheet opens, not on every goal update.
  }, [openMode]);

  const pickMode = (m: ProgressMode) => {
    setMode(m);
    setText(m === 'set' ? String(goal.currentValue ?? 0) : '');
  };

  const current = goal.currentValue ?? 0;
  const target = goal.targetValue ?? 0;
  const amount = Number(text.replace(',', '.'));
  const valid = text !== '' && Number.isFinite(amount) && amount >= 0 && (mode === 'set' || amount > 0);
  const next = valid ? applyProgress(current, mode, amount) : current;
  const unit = goal.metric.trim();

  const save = async () => {
    if (!valid || next === current) return onClose();
    const before = goal.currentValue;
    await updateGoal(goal.id, { currentValue: next });
    if (next > current) rewardTap(target > 0 && next >= target && current < target ? 'done' : 'tick');
    onClose();
    toast(`Progress: ${fmt(next)}${target ? ` of ${fmt(target)}` : ''}`, () => updateGoal(goal.id, { currentValue: before }));
  };

  const verb = mode === 'add' ? 'Add' : mode === 'remove' ? 'Remove' : 'Set to';

  return (
    <Sheet
      open={openMode !== null}
      onClose={onClose}
      title="Update progress"
      action={
        <button onClick={save} disabled={!valid} className="text-headline text-accent disabled:opacity-30">
          Save
        </button>
      }
    >
      <div className="flex flex-col items-center pb-2">
        <div className="w-full">
          <Segmented label="How to update" value={mode} options={MODES} onChange={pickMode} />
        </div>

        <label className="mt-6 flex w-full flex-col items-center">
          <span className="flex items-baseline justify-center gap-1">
            {mode !== 'set' && (
              <span className="text-[40px] font-semibold text-secondary" aria-hidden>
                {mode === 'add' ? '+' : '−'}
              </span>
            )}
            <input
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              placeholder="0"
              aria-label={mode === 'set' ? 'New total' : `Amount to ${mode}`}
              className="tabular min-w-[1.2ch] max-w-[9ch] bg-transparent text-center text-[48px] font-semibold outline-none"
              // Grows with the number so the + or − sign stays right next to it.
              style={{ caretColor: 'rgb(var(--accent))', width: `${(text || '0').length + 0.4}ch` }}
            />
          </span>
          {unit && <span className="max-w-full truncate text-subhead text-secondary">{unit}</span>}
        </label>

        {mode !== 'set' && target > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {quickAmounts(target).map((n) => {
              const active = valid && amount === n;
              return (
                <motion.button
                  key={n}
                  whileTap={{ scale: 0.92 }}
                  transition={spring}
                  onClick={() => setText(String(n))}
                  aria-pressed={active}
                  className={`tabular h-11 min-w-[64px] rounded-full px-4 text-body font-medium transition-colors ${
                    active ? 'bg-accent-fill text-white' : 'bg-bg-2 text-label'
                  }`}
                >
                  {mode === 'add' ? '+' : '−'}
                  {fmt(n)}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* What it will be after saving. */}
        <div className="mt-6 flex items-center gap-2 text-subhead text-secondary" aria-live="polite">
          <span className="tabular">{fmt(current)}</span>
          <ArrowRight size={16} aria-hidden />
          <span className={`tabular font-semibold ${valid && next !== current ? 'text-label' : ''}`}>{fmt(next)}</span>
          {target > 0 && <span className="tabular">of {fmt(target)}</span>}
        </div>
        {target > 0 && (
          <div className="mt-2 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-[rgb(var(--fill)/0.2)]" aria-hidden>
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${Math.min(1, next / target) * 100}%` }}
              transition={spring}
            />
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={spring}
          onClick={() => void save()}
          disabled={!valid}
          className="mt-7 h-[50px] w-full rounded-[14px] bg-accent-fill text-headline text-white disabled:opacity-40"
        >
          {valid ? `${verb} ${fmt(amount)}` : mode === 'set' ? 'Enter the new total' : 'Enter an amount'}
        </motion.button>
      </div>
    </Sheet>
  );
}

/** Exact to two decimals, with thousands separators (12,500 · 2.25). */
function fmt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}
