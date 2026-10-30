import { useRef } from 'react';

const LONG_PRESS_MS = 450;

/** Pointer handlers for an element that distinguishes tap from long-press. */
export function useLongPress(onLong: () => void, onTap: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    clearTimeout(timer.current);
    origin.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        onLong();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (!fired.current) onTap();
    },
  };
}
