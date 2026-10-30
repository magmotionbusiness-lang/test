import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { spring } from '@/app/motion';

/** Rounded white card on the grouped background. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-bg-2 p-4 shadow-card ${className}`}>{children}</div>;
}

/** Inset grouped list section, like Settings.app. */
export function ListGroup({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      {header && <h2 className="mb-1.5 px-4 text-footnote uppercase text-secondary">{header}</h2>}
      <div className="overflow-hidden rounded-row bg-bg-2 shadow-card [&>*+*]:border-t [&>*+*]:border-[rgb(var(--separator)/0.29)]">
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-secondary">{footer}</p>}
    </section>
  );
}

interface ListRowProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}

export function ListRow({ icon, title, subtitle, detail, onClick, chevron, destructive, children }: ListRowProps) {
  const content = (
    <>
      {icon && <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-body ${destructive ? 'text-danger' : ''}`}>{title}</span>
        {subtitle && <span className="block truncate text-footnote text-secondary">{subtitle}</span>}
      </span>
      {detail !== undefined && <span className="shrink-0 text-body text-secondary">{detail}</span>}
      {children}
      {chevron && <ChevronRight size={18} className="shrink-0 text-tertiary" aria-hidden />}
    </>
  );
  const cls = 'flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5';
  return onClick ? (
    <button onClick={onClick} className={`${cls} active:bg-[rgb(var(--fill)/0.16)]`}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-success' : 'bg-[rgb(var(--fill)/0.32)]'
      }`}
    >
      <motion.span
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
        animate={{ left: checked ? 22 : 2 }}
        transition={spring}
      />
    </button>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="relative flex rounded-[9px] bg-[rgb(var(--fill)/0.12)] p-[2px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="relative z-10 h-[30px] flex-1 px-2 text-footnote font-medium"
          >
            {active && (
              <motion.span
                layoutId={`seg-${label}`}
                className="absolute inset-0 -z-10 rounded-[7px] bg-bg-2 shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] dark:bg-[#636366]"
                transition={spring}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressRing({
  value,
  total,
  size = 44,
  stroke = 5,
  color = 'rgb(var(--accent))',
  label,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${value} of ${total} done`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--fill) / 0.2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={spring}
        />
      </svg>
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <h2 className="text-title3">{title}</h2>
      <p className="mt-2 max-w-xs text-subhead text-secondary">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={spring}
      onClick={onClick}
      disabled={disabled}
      className="h-[50px] rounded-[14px] bg-accent px-6 text-headline text-white disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}

/** Colored rounded-square icon, like Settings.app rows. */
export function IconTile({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex h-[29px] w-[29px] items-center justify-center rounded-[7px] text-white" style={{ background: color }}>
      {children}
    </span>
  );
}
