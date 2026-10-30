import { AnimatePresence, motion } from 'framer-motion';
import { useSyncExternalStore } from 'react';
import { spring } from '@/app/motion';

interface ToastState {
  id: number;
  message: string;
  undo?: () => void | Promise<void>;
}

let current: ToastState | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Show a short message at the bottom, optionally with an Undo action. */
export function toast(message: string, undo?: ToastState['undo']): void {
  clearTimeout(timer);
  current = { id: Date.now(), message, undo };
  emit();
  timer = setTimeout(dismiss, undo ? 4500 : 2500);
}

function dismiss() {
  current = null;
  emit();
}

export function ToastHost() {
  const t = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+66px)] z-[45] flex justify-center px-4"
      aria-live="polite"
    >
      <AnimatePresence>
        {t && (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={spring}
            className="pointer-events-auto flex min-h-[44px] max-w-sm items-center gap-4 rounded-[14px] bg-[#1C1C1E]/95 py-2 pl-4 pr-2 text-subhead text-white shadow-lg backdrop-blur dark:bg-[#3A3A3C]/95"
          >
            <span className="flex-1">{t.message}</span>
            {t.undo && (
              <button
                className="h-9 rounded-[10px] px-3 font-semibold text-[#64D2FF]"
                onClick={async () => {
                  dismiss();
                  await t.undo?.();
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
