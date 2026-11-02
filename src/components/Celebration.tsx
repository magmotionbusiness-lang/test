import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { playCompletionSound } from '@/lib/sound';

const COLORS = ['var(--c-green)', 'var(--c-blue)', 'var(--c-orange)', 'var(--c-pink)', 'var(--c-purple)', 'var(--c-yellow)', 'var(--c-teal)'];

/**
 * Celebration when the last habit due today gets done — from any screen:
 * a soft glow, a burst of confetti and the completion sound. Bump `fire` to
 * play it (the app shell does this on the transition to all-done).
 */
export function Celebration({ fire, sound = true }: { fire: number; sound?: boolean }) {
  const [show, setShow] = useState(false);
  const reduced = useReducedMotionConfig();

  useEffect(() => {
    if (fire === 0) return;
    setShow(true);
    if (sound) void playCompletionSound();
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, [fire, sound]);

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[44] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
        >
          <motion.div
            className="absolute left-1/2 top-[30%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgb(var(--success) / 0.35), transparent 65%)' }}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1.6 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-x-0 top-[24%] text-center"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <span className="inline-block rounded-full bg-bg-2/90 px-4 py-2 text-headline shadow-card backdrop-blur">All done for today ✨</span>
          </motion.div>
          {!reduced &&
            Array.from({ length: 36 }, (_, i) => {
              const x = (i * 37) % 100;
              const drift = ((i * 53) % 40) - 20;
              const size = 6 + ((i * 7) % 6);
              return (
                <motion.span
                  key={i}
                  className="absolute top-0 block rounded-[2px]"
                  style={{ left: `${x}%`, width: size, height: size * 0.5, background: COLORS[i % COLORS.length] }}
                  initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
                  animate={{ y: '70vh', x: drift * 3, rotate: (i % 2 ? 1 : -1) * 360, opacity: 0 }}
                  transition={{ duration: 1.8 + (i % 5) * 0.15, ease: 'easeOut', delay: (i % 6) * 0.05 }}
                />
              );
            })}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
