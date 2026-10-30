import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { pageSpring } from '@/app/motion';

export interface Action {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

/** iOS action sheet: a stack of choices plus a separate Cancel button. */
export function ActionSheet({ open, title, actions, onClose }: { open: boolean; title?: string; actions: Action[]; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true" aria-label={title ?? 'Actions'}>
          <motion.div className="absolute inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-sm px-2 pb-[calc(env(safe-area-inset-bottom)+8px)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={pageSpring}
          >
            <div className="overflow-hidden rounded-[14px] bg-bg-2/95 backdrop-blur-xl">
              {title && <div className="px-4 py-3 text-center text-footnote text-secondary">{title}</div>}
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => {
                    onClose();
                    a.onSelect();
                  }}
                  className={`hairline h-[57px] w-full border-t text-[20px] active:bg-[rgb(var(--fill)/0.16)] ${a.destructive ? 'text-danger' : 'text-accent'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="mt-2 h-[57px] w-full rounded-[14px] bg-bg-2 text-[20px] font-semibold text-accent">
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
