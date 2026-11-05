import type { HabitColor, VisionSection } from '@/db/types';

/** Every vision board photo frame is this shape (width ÷ height), like a portrait instant photo. */
export const FRAME_ASPECT = 4 / 5;

export const STARTER_SECTIONS: { title: string; emoji: string; color: HabitColor }[] = [
  { title: 'Wealth', emoji: '💰', color: 'yellow' },
  { title: 'Passion', emoji: '🔥', color: 'orange' },
  { title: 'Health', emoji: '🌿', color: 'green' },
  { title: 'Love', emoji: '❤️', color: 'pink' },
  { title: 'Family', emoji: '🏡', color: 'teal' },
  { title: 'Career', emoji: '🚀', color: 'indigo' },
];

/** A small, steady tilt per tile, so the board looks pinned up by hand. */
export function tiltFor(index: number): number {
  const tilts = [-2.2, 1.6, 1.1, -1.4, -1.8, 2];
  return tilts[index % tilts.length]!;
}

/**
 * How far a photo of `aspect` overflows a frame of `frameW` × `frameH` when it
 * covers it: only one axis ever overflows.
 */
export function coverOverflow(aspect: number, frameW: number, frameH: number): { x: number; y: number } {
  if (!(aspect > 0) || frameW <= 0 || frameH <= 0) return { x: 0, y: 0 };
  if (aspect > frameW / frameH) return { x: frameH * aspect - frameW, y: 0 };
  return { x: 0, y: frameW / aspect - frameH };
}

/**
 * New focus point after dragging the photo by (dx, dy) pixels inside the
 * frame. Dragging right reveals more of the left side, like moving a print
 * under a mat. Clamped to 0–100.
 */
export function dragFocus(
  focus: { x: number; y: number },
  delta: { dx: number; dy: number },
  overflow: { x: number; y: number },
): { x: number; y: number } {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  return {
    x: overflow.x > 0 ? clamp(focus.x - (delta.dx / overflow.x) * 100) : focus.x,
    y: overflow.y > 0 ? clamp(focus.y - (delta.dy / overflow.y) * 100) : focus.y,
  };
}

/** Size to scale a photo down to before storing it: longest side at most `max`. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const k = max / Math.max(w, h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Board-wide progress, 0–1, from every tile's 0–4 dots. */
export function boardProgress(sections: Pick<VisionSection, 'progress'>[]): number {
  if (!sections.length) return 0;
  return sections.reduce((n, s) => n + Math.max(0, Math.min(4, s.progress)), 0) / (sections.length * 4);
}
