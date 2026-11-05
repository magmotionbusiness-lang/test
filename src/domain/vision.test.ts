import { describe, expect, it } from 'vitest';
import { boardProgress, coverOverflow, dragFocus, fitWithin, STARTER_SECTIONS, tiltFor } from './vision';

describe('vision board', () => {
  it('starts with the six classic areas', () => {
    expect(STARTER_SECTIONS.map((s) => s.title)).toEqual(['Wealth', 'Passion', 'Health', 'Love', 'Family', 'Career']);
  });

  it('tilts tiles gently and repeatably', () => {
    expect(tiltFor(0)).toBe(tiltFor(6));
    for (let i = 0; i < 12; i++) expect(Math.abs(tiltFor(i))).toBeLessThanOrEqual(2.5);
  });

  it('finds which axis of a covering photo overflows the frame', () => {
    // A landscape 3:2 photo in a 200×250 frame is 375 wide: 175 spare sideways.
    expect(coverOverflow(1.5, 200, 250)).toEqual({ x: 175, y: 0 });
    // A tall 1:2 photo in the same frame is 400 high: 150 spare vertically.
    expect(coverOverflow(0.5, 200, 250)).toEqual({ x: 0, y: 150 });
    // Exactly the frame's shape: nothing to move.
    expect(coverOverflow(0.8, 200, 250)).toEqual({ x: 0, y: 0 });
    expect(coverOverflow(0, 200, 250)).toEqual({ x: 0, y: 0 });
  });

  it('moves the focus opposite to the drag and keeps it in range', () => {
    const overflow = { x: 100, y: 0 };
    expect(dragFocus({ x: 50, y: 50 }, { dx: 25, dy: 40 }, overflow)).toEqual({ x: 25, y: 50 });
    expect(dragFocus({ x: 50, y: 50 }, { dx: -500, dy: 0 }, overflow)).toEqual({ x: 100, y: 50 });
    expect(dragFocus({ x: 10, y: 50 }, { dx: 500, dy: 0 }, overflow)).toEqual({ x: 0, y: 50 });
  });

  it('scales big photos down but leaves small ones alone', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });

  it('sums the progression dots into one board score', () => {
    expect(boardProgress([])).toBe(0);
    expect(boardProgress([{ progress: 4 }, { progress: 0 }])).toBe(0.5);
    expect(boardProgress([{ progress: 2 }, { progress: 9 }])).toBe(0.75);
  });
});
