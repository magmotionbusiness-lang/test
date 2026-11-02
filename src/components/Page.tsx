import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageProps {
  title: string;
  /** Shown left of the title in the compact bar, e.g. "Sections". */
  backLabel?: string;
  /** Trailing nav-bar buttons. */
  actions?: ReactNode;
  /** Content under the large title (e.g. a date or subtitle). */
  subtitle?: ReactNode;
  /** A short line above the large title, e.g. a greeting. */
  eyebrow?: ReactNode;
  /** Right side of the large title row (e.g. a progress ring). */
  titleAccessory?: ReactNode;
  children: ReactNode;
}

/**
 * iOS-style screen: a large title that collapses into a translucent inline
 * nav bar as you scroll. Each page owns its scroll container so tabs keep
 * their own position.
 */
export function Page({ title, backLabel, actions, subtitle, eyebrow, titleAccessory, children }: PageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e?.isIntersecting), {
      root,
      rootMargin: '-44px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={scrollRef} className="absolute inset-0 overflow-y-auto overscroll-contain no-scrollbar" data-scroll-root>
      <header
        className={`sticky top-0 z-20 pt-safe transition-[background-color,border-color] duration-200 border-b ${
          collapsed ? 'material-bar hairline' : 'border-transparent'
        }`}
      >
        <div className="relative mx-auto flex h-11 max-w-content items-center px-safe">
          <div className="flex min-w-0 flex-1 items-center">
            {backLabel && (
              <button
                onClick={() => navigate(-1)}
                className="-ml-2 flex h-11 items-center pr-2 text-body text-accent"
                aria-label={`Back to ${backLabel}`}
              >
                <ChevronLeft size={28} strokeWidth={2} className="-mr-0.5" aria-hidden />
                <span className="truncate">{backLabel}</span>
              </button>
            )}
          </div>
          <div
            className={`pointer-events-none absolute left-1/2 max-w-[55%] -translate-x-1/2 truncate text-headline transition-opacity duration-200 ${
              collapsed ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={!collapsed}
          >
            {title}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1">{actions}</div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-safe">
        <div className="flex items-end justify-between gap-3 pb-2 pt-1">
          <div className="min-w-0">
            {eyebrow && <div className="mb-0.5 truncate text-title3">{eyebrow}</div>}
            <h1 className="truncate text-large-title">{title}</h1>
            {subtitle && <div className="text-subhead text-secondary">{subtitle}</div>}
          </div>
          {titleAccessory}
        </div>
        <div ref={sentinelRef} className="h-px" aria-hidden />
        <div className="pb-[calc(env(safe-area-inset-bottom)+96px)] pt-2">{children}</div>
      </div>
    </div>
  );
}

export function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="flex h-11 min-w-[44px] items-center justify-center text-accent">
      {children}
    </button>
  );
}
