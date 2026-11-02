import { useEffect, useState } from 'react';

/**
 * The part of the screen not covered by the on-screen keyboard. When the
 * keyboard opens, iOS shrinks the visual viewport and pans the page; tracking
 * it lets sheets sit right above the keyboard instead of being pushed away.
 */
export function useVisualViewport(active: boolean): { top: number; height: number } | null {
  const [vv, setVv] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!active || !v) return;
    const update = () => {
      setVv({ top: v.offsetTop, height: v.height });
      // iOS may scroll the page under a fixed sheet when focusing an input; keep it pinned.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    return () => {
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
    };
  }, [active]);
  return active ? vv : null;
}
