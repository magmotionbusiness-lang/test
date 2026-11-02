import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { refreshThemeColor } from '@/app/theme';
import createdBy from '@/assets/created-by.png?inline';

/** Matches scripts/icon.mjs (MATTE and the logo geometry), so the iOS launch screen hands over seamlessly. */
export const MATTE = '#3F4BDB';
const FILLED = [1, 1, 0, 1, 1, 1, 0, 1, 1];
const GAP = 8;
const TILE = (100 - 2 * GAP) / 3;
const KEY = 'hh-intro-shown';
/** Opaque on the left, feathered edge, clear on the right; sliding it reveals the watermark smoothly. */
const SOFT_WIPE = 'linear-gradient(90deg, #000 40%, transparent 60%)';

/**
 * Opening intro on a fresh launch: the logo on the matte background pops,
 * its last two tiles fill in, then everything fades away. Shown once per
 * launch (sessionStorage resets when iOS starts the app fresh), not on resume.
 */
export function Intro() {
  const reduced = useReducedMotionConfig();
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem(KEY);
    } catch {
      return true;
    }
  });

  useEffect(() => {
    // The static copy in index.html covered the gap while the app loaded; this one takes over now.
    document.getElementById('intro-static')?.remove();
    if (!show) return;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* fine: it just plays again next time */
    }
    document.documentElement.classList.add('intro-on');
    refreshThemeColor();
    const t = setTimeout(
      () => {
        // Hand the status bar back to the app colour as the fade *starts*, so iOS's
        // late update finishes before the intro is gone (no blue strip left behind).
        document.documentElement.classList.remove('intro-on');
        refreshThemeColor();
        setShow(false);
      },
      reduced ? 500 : 1650,
    );
    return () => clearTimeout(t);
  }, [show, reduced]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: MATTE }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          aria-hidden
        >
          <motion.svg
            viewBox="0 0 100 100"
            style={{ width: '22vmin', height: '22vmin' }}
            initial={{ scale: 1 }}
            animate={reduced ? undefined : { scale: [1, 1.14, 1] }}
            exit={reduced ? undefined : { scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.55, times: [0, 0.45, 1], ease: 'easeOut' }}
          >
            {FILLED.map((filled, i) => (
              <motion.rect
                key={i}
                x={(i % 3) * (TILE + GAP)}
                y={Math.floor(i / 3) * (TILE + GAP)}
                width={TILE}
                height={TILE}
                rx={TILE * 0.28}
                fill="#fff"
                initial={{ fillOpacity: filled ? 1 : 0.28 }}
                // The two faded tiles fill in, completing the grid.
                animate={{ fillOpacity: 1 }}
                transition={{ delay: reduced ? 0 : filled ? 0 : i === 2 ? 0.35 : 0.5, duration: 0.25 }}
              />
            ))}
          </motion.svg>
          {/* "created by magmotion>": once the logo has popped, it rises in and is revealed left to right behind a soft edge. */}
          <motion.img
            src={createdBy}
            alt=""
            className="absolute left-1/2"
            style={{
              top: 'calc(50% + 24.2vmin)',
              width: '25.3vmin',
              x: '-50%',
              ...(reduced ? {} : { WebkitMaskImage: SOFT_WIPE, maskImage: SOFT_WIPE, WebkitMaskSize: '250% 100%', maskSize: '250% 100%' }),
            }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: 'blur(4px)', WebkitMaskPosition: '100% 0%', maskPosition: '100% 0%' }}
            animate={reduced ? { opacity: 0.9 } : { opacity: 0.9, y: 0, filter: 'blur(0px)', WebkitMaskPosition: '0% 0%', maskPosition: '0% 0%' }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ delay: reduced ? 0 : 0.45, duration: reduced ? 0.25 : 0.85, ease: [0.45, 0, 0.2, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
