import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { createContext, Suspense, useContext, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType, useRoutes, type RouteObject } from 'react-router-dom';

/** Tab roots in tab-bar order, so tab switches slide toward the tapped tab. */
export const TAB_ORDER = ['/', '/sections', '/insights', '/goals', '/settings'];

type Dir = 'push' | 'pop' | 'tab-next' | 'tab-prev' | 'none';

/** iOS navigation curve: quick start, long soft landing. */
const IOS_EASE = [0.32, 0.72, 0, 1] as const;
const PUSH = { type: 'tween', ease: IOS_EASE, duration: 0.42 } as const;
const TAB = { type: 'tween', ease: [0.25, 0.8, 0.25, 1], duration: 0.28 } as const;

/*
 * Tweens on x/opacity. Heavy screen content renders only after the slide
 * (see Defer), so the main thread is free and the slide stays smooth.
 */
const variants = {
  enter: (dir: Dir) =>
    dir === 'push'
      ? { x: '100%', opacity: 1 }
      : dir === 'pop'
        ? { x: '-28%', opacity: 1 }
        : dir === 'tab-next'
          ? { x: 28, opacity: 0 }
          : dir === 'tab-prev'
            ? { x: -28, opacity: 0 }
            : { x: 0, opacity: 1 },
  center: (dir: Dir) => ({
    x: 0,
    opacity: 1,
    transition: dir === 'tab-next' || dir === 'tab-prev' ? TAB : PUSH,
  }),
  exit: (dir: Dir) =>
    dir === 'push'
      ? { x: '-28%', opacity: 1, transition: PUSH }
      : dir === 'pop'
        ? { x: '100%', opacity: 1, zIndex: 2, transition: PUSH }
        : dir === 'tab-next'
          ? { x: -28, opacity: 0, transition: { ...TAB, duration: 0.2 } }
          : dir === 'tab-prev'
            ? { x: 28, opacity: 0, transition: { ...TAB, duration: 0.2 } }
            : { opacity: 0, transition: { duration: 0 } },
};

const noop = () => undefined;

/** True once the screen has finished sliding in; heavy content waits for it. */
const SettledContext = createContext(true);
export const useTransitionSettled = () => useContext(SettledContext);

/**
 * Router outlet with iOS push/pop transitions. Direction comes from the
 * navigation itself (a tap that opens something is a push, Back is a pop),
 * so every level slides — section → habit as much as list → section.
 * Pushed screens can be dragged back from the left edge.
 */
export function Stack({ routes }: { routes: RouteObject[] }) {
  const location = useLocation();
  const navType = useNavigationType();
  const element = useRoutes(routes, location);
  const prev = useRef({ key: location.key, path: location.pathname, dir: 'none' as Dir });

  if (prev.current.key !== location.key) {
    const from = prev.current.path;
    const to = location.pathname;
    const i = TAB_ORDER.indexOf(from);
    const j = TAB_ORDER.indexOf(to);
    let dir: Dir;
    if (navType === 'POP') dir = 'pop';
    else if (j >= 0 && i >= 0) dir = j === i ? 'none' : j > i ? 'tab-next' : 'tab-prev';
    else if (j >= 0)
      dir = 'tab-next'; // tab bar tapped from inside a pushed screen
    else dir = 'push';
    prev.current = { key: location.key, path: to, dir };
  }
  const dir = prev.current.dir;

  return (
    <AnimatePresence initial={false} custom={dir} mode="popLayout">
      <StackPage key={location.key} dir={dir} canSwipeBack={!TAB_ORDER.includes(location.pathname)}>
        {element}
      </StackPage>
    </AnimatePresence>
  );
}

function StackPage({ dir, canSwipeBack, children }: { dir: Dir; canSwipeBack: boolean; children: ReactNode }) {
  const navigate = useNavigate();
  const drag = useDragControls();
  const [settled, setSettled] = useState(dir === 'none');

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110 || info.velocity.x > 500) navigate(-1);
  };

  return (
    <motion.div
      custom={dir}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      onAnimationComplete={(name) => name === 'center' && setSettled(true)}
      // An onUpdate handler keeps these animations in Motion's own frame loop instead of handing the fades
      // to the browser, whose hand-back at the end flashed the page for a frame.
      onUpdate={noop}
      className="absolute inset-0 bg-bg shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
    >
      {/* The back-swipe drag lives on an inner layer so it never fights the transition transform. */}
      <motion.div
        className="absolute inset-0"
        drag={canSwipeBack ? 'x' : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 1 }}
        onDragEnd={onDragEnd}
      >
        <SettledContext.Provider value={settled}>
          <Suspense fallback={null}>{children}</Suspense>
        </SettledContext.Provider>
        {canSwipeBack && <div className="absolute inset-y-0 left-0 z-30 w-5 touch-none" onPointerDown={(e) => drag.start(e)} aria-hidden />}
      </motion.div>
    </motion.div>
  );
}
