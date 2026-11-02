import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Cross-fades content when `swapKey` changes (a new day, period, month or
 * view), with a small slide in `direction`, so content never cuts abruptly.
 */
export function FadeSwap({
  swapKey,
  children,
  direction = 0,
  className,
}: {
  swapKey: string;
  children: ReactNode;
  direction?: -1 | 0 | 1;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={swapKey}
        className={className}
        custom={direction}
        initial={{ opacity: 0, x: direction * 24, y: direction === 0 ? 6 : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: direction * -24, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38, opacity: { duration: 0.16 } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Fades and lifts content in when it first appears, and out when removed. */
export function Appear({ children, show = true, className }: { children: ReactNode; show?: boolean; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36, opacity: { duration: 0.2 } }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
