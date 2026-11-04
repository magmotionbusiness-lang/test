import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pageSpring } from '@/app/motion';
import { useVisualViewport } from '@/lib/useVisualViewport';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Trailing header button, e.g. "Save". */
  action?: ReactNode;
  children: ReactNode;
}

/** iOS-style bottom sheet with a grab handle and drag-to-dismiss. */
export function Sheet({ open, onClose, title, action, children }: SheetProps) {
  const drag = useDragControls();
  const viewport = useVisualViewport(open);
  const keyboardOpen = viewport !== null && viewport.height < window.innerHeight - 80;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        // Sized to the visible area, so with the keyboard up the sheet sits right above it.
        <div
          className="fixed inset-x-0 top-0 z-50"
          style={{ top: viewport?.top ?? 0, height: viewport?.height ?? '100%' }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-content flex-col rounded-t-[14px] bg-bg ${keyboardOpen ? 'max-h-[calc(100%_-_env(safe-area-inset-top))]' : 'max-h-[92%] pb-safe'}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={pageSpring}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="shrink-0 touch-none" onPointerDown={(e) => drag.start(e)}>
              <div className="mx-auto mt-[6px] h-[5px] w-9 rounded-full bg-[rgb(var(--fill)/0.5)]" aria-hidden />
              <div className="flex h-12 items-center px-4">
                <button onClick={onClose} className="min-w-[60px] text-left text-body text-accent">
                  Close
                </button>
                <h2 className="flex-1 truncate text-center text-headline">{title}</h2>
                <div className="flex min-w-[60px] justify-end">{action}</div>
              </div>
            </div>
            <div
              className="overflow-y-auto overscroll-contain px-4 pb-6 pt-2"
              // Once the keyboard has opened (and the sheet resized), bring the field being typed in into view.
              onFocusCapture={(e) => {
                const el = e.target as HTMLElement;
                if (el.matches('input, textarea, select')) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350);
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
