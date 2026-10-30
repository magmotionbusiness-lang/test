import { Check, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { HabitColor, Weekday } from '@/db/types';
import { COLOR_NAMES, PALETTE, colorVar } from '@/lib/colors';

/** Inset-grouped form section (no shadow, sheet background). */
export function FormGroup({ header, footer, children }: { header?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      {header && <h3 className="mb-1.5 px-4 text-footnote uppercase text-secondary">{header}</h3>}
      <div className="overflow-hidden rounded-row bg-bg-2 [&>*+*]:border-t [&>*+*]:border-[rgb(var(--separator)/0.29)]">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-secondary">{footer}</p>}
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 80,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 px-4">
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className="h-11 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-[rgb(var(--label-3)/0.3)]"
      />
    </label>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 px-4 py-1.5">
      <span className="flex-1 text-body">{label}</span>
      {children}
    </div>
  );
}

const EMOJI_SUGGESTIONS = ['💪', '🏃', '🧘', '📚', '✍️', '💧', '🥦', '🌙', '🎯', '🧠', '🎸', '💊', '🚭', '🧹', '💰', '🙏', '🌿', '☀️'];

export function EmojiField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <input
          value={value}
          onChange={(e) => onChange([...e.target.value].slice(-2).join('') || '')}
          aria-label="Emoji"
          className="h-14 w-14 rounded-[14px] bg-[rgb(var(--fill)/0.12)] text-center text-[30px] outline-none"
        />
        <p className="text-footnote text-secondary">Tap to type any emoji, or pick one below.</p>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4">
        {EMOJI_SUGGESTIONS.map((e) => (
          <button key={e} onClick={() => onChange(e)} className="h-11 w-11 shrink-0 rounded-[10px] text-[24px] active:bg-[rgb(var(--fill)/0.16)]" aria-label={`Use ${e}`}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: HabitColor; onChange: (c: HabitColor) => void }) {
  return (
    <div className="grid grid-cols-6 gap-3 px-4 py-4" role="radiogroup" aria-label="Color">
      {COLOR_NAMES.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={PALETTE[c].label}
          onClick={() => onChange(c)}
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: colorVar(c), boxShadow: value === c ? `0 0 0 3px rgb(var(--bg-2)), 0 0 0 5px ${colorVar(c)}` : undefined }}
        >
          {value === c && <Check size={18} strokeWidth={3} className="text-white" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WeekdayPicker({ value, onChange, weekStart }: { value: Weekday[]; onChange: (d: Weekday[]) => void; weekStart: 0 | 1 }) {
  const order = Array.from({ length: 7 }, (_, i) => ((i + weekStart) % 7) as Weekday);
  return (
    <div className="flex justify-between px-4 py-3" role="group" aria-label="Days of the week">
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            aria-pressed={on}
            aria-label={DAY_NAMES[d]}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={`h-10 w-10 rounded-full text-subhead font-semibold transition-colors ${on ? 'bg-accent text-white' : 'bg-[rgb(var(--fill)/0.12)]'}`}
          >
            {DAY_LETTERS[d]}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 999, step = 1, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="tabular min-w-[2.5ch] text-right text-body text-secondary" aria-live="polite">
        {value}
      </span>
      <div className="flex h-8 overflow-hidden rounded-[8px] bg-[rgb(var(--fill)/0.12)]">
        <button aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="flex w-11 items-center justify-center disabled:opacity-30">
          <Minus size={16} aria-hidden />
        </button>
        <span className="my-1.5 w-px bg-[rgb(var(--separator)/0.29)]" aria-hidden />
        <button aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="flex w-11 items-center justify-center disabled:opacity-30">
          <Plus size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Native <select> styled as an iOS menu row; iOS shows its own picker wheel. */
export function SelectRow<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 px-4">
      <span className="flex-1 text-body">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="max-w-[60%] appearance-none bg-transparent text-right text-body text-secondary outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
