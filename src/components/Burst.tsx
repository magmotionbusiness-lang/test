import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const COLORS = ['var(--c-yellow)', 'var(--c-green)', 'var(--c-pink)', 'var(--c-cyan)', 'var(--c-orange)'];
const N = 12;

/**
 * A little celebration around a control: an expanding ring and a burst of
 * confetti dots. Bump `fire` to play it. Drawn on a top layer at the
 * control's position, so rows and cards that clip overflow don't cut it off.
 */
export function Burst({ fire, color }: { fire: number; color: string }) {
  const reduced = useReducedMotionConfig();
  const anchor = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (fire > 0 && anchor.current) setRect(anchor.current.getBoundingClientRect());
  }, [fire]);

  return (
    <>
      <span ref={anchor} className="pointer-events-none absolute inset-0" aria-hidden />
      {createPortal(
        <AnimatePresence>
          {fire > 0 && rect && (
            <motion.span
              key={fire}
              className="pointer-events-none fixed z-[70]"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
              aria-hidden
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onAnimationComplete={() => setTimeout(() => setRect(null), 650)}
            >
              {/* A glow ring that spreads outward; works for round and wide pill buttons alike. */}
              <motion.span
                className="absolute inset-0 rounded-full"
                initial={{ boxShadow: `0 0 0 0px ${color}`, opacity: 0.9 }}
                animate={{ boxShadow: `0 0 0 16px ${color}`, opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
              {!reduced &&
                Array.from({ length: N }, (_, i) => {
                  const angle = (i / N) * Math.PI * 2 + (fire % 7) * 0.3;
                  const dist = Math.min(rect.width, 120) / 2 + 14 + ((i * 37 + fire * 13) % 16);
                  const size = 4 + (i % 3) * 1.5;
                  return (
                    <motion.span
                      key={i}
                      className="absolute left-1/2 top-1/2 block rounded-full"
                      style={{
                        width: size,
                        height: size,
                        marginLeft: -size / 2,
                        marginTop: -size / 2,
                        background: i % 3 === 0 ? color : COLORS[i % COLORS.length],
                      }}
                      initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                      animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: [0.4, 1.2, 0.6], opacity: [1, 1, 0] }}
                      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.3, 1] }}
                    />
                  );
                })}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
