import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { Suspense, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate, useRoutes, type RouteObject } from 'react-router-dom';
import { pageSpring } from './motion';

/** Tab roots in tab-bar order, so tab switches slide toward the tapped tab. */
export const TAB_ORDER = ['/', '/sections', '/insights', '/goals', '/settings'];
const TAB_ROOTS = new Set(TAB_ORDER);

/** Tab roots are depth 0; every pushed screen is one level deeper per path segment past its tab. */
function depthOf(path: string): number {
  if (TAB_ROOTS.has(path)) return 0;
  return path.split('/').filter(Boolean).length - 1 || 1;
}

type Dir = 'push' | 'pop' | 'tab-next' | 'tab-prev' | 'none';

const TAB_SHIFT = 48;
const tabFade = { type: 'spring', stiffness: 420, damping: 40, opacity: { duration: 0.18 } } as const;

const variants = {
  enter: (dir: Dir) =>
    dir === 'push'
      ? { x: '100%', opacity: 1 }
      : dir === 'pop'
        ? { x: '-30%', opacity: 1 }
        : dir === 'tab-next'
          ? { x: TAB_SHIFT, opacity: 0 }
          : dir === 'tab-prev'
            ? { x: -TAB_SHIFT, opacity: 0 }
            : { x: 0, opacity: 1 },
  center: (dir: Dir) => ({ x: 0, opacity: 1, transition: dir === 'tab-next' || dir === 'tab-prev' ? tabFade : pageSpring }),
  exit: (dir: Dir) =>
    dir === 'push'
      ? { x: '-30%', opacity: 1 }
      : dir === 'pop'
        ? { x: '100%', opacity: 1, zIndex: 2 }
        : dir === 'tab-next'
          ? { x: -TAB_SHIFT, opacity: 0, transition: tabFade }
          : dir === 'tab-prev'
            ? { x: TAB_SHIFT, opacity: 0, transition: tabFade }
            : { x: 0, opacity: 0, transition: { duration: 0 } },
};

/**
 * Router outlet with iOS push/pop transitions. Detail screens slide in from
 * the right and can be dismissed by dragging from the left edge (the iOS
 * back swipe, which standalone web apps don't get for free).
 */
export function Stack({ routes }: { routes: RouteObject[] }) {
  const location = useLocation();
  const element = useRoutes(routes, location);
  const prev = useRef({ path: location.pathname, dir: 'none' as Dir });

  if (prev.current.path !== location.pathname) {
    const a = depthOf(prev.current.path);
    const b = depthOf(location.pathname);
    const i = TAB_ORDER.indexOf(prev.current.path);
    const j = TAB_ORDER.indexOf(location.pathname);
    const dir: Dir = b > a ? 'push' : b < a ? 'pop' : i >= 0 && j >= 0 ? (j > i ? 'tab-next' : 'tab-prev') : 'none';
    prev.current = { path: location.pathname, dir };
  }
  const dir = prev.current.dir;
  const depth = depthOf(location.pathname);

  return (
    <AnimatePresence initial={false} custom={dir} mode="popLayout">
      <StackPage key={location.pathname} dir={dir} canSwipeBack={depth > 0}>
        {element}
      </StackPage>
    </AnimatePresence>
  );
}

function StackPage({ dir, canSwipeBack, children }: { dir: Dir; canSwipeBack: boolean; children: ReactNode }) {
  const navigate = useNavigate();
  const drag = useDragControls();

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
      transition={pageSpring}
      className="absolute inset-0 bg-bg shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
      drag={canSwipeBack ? 'x' : false}
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 1 }}
      onDragEnd={onDragEnd}
    >
      <Suspense fallback={null}>{children}</Suspense>
      {canSwipeBack && <div className="absolute inset-y-0 left-0 z-30 w-5 touch-none" onPointerDown={(e) => drag.start(e)} aria-hidden />}
    </motion.div>
  );
}
