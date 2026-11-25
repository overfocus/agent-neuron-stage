import { describe, expect, it } from 'vitest';
import { EDGE, GAP, MIN_W, TAIL_INSET, place } from '../src/bubble.ts';

const bounds = { w: 960, h: 600 };

describe('place', () => {
  it('sits centred above the head, with the tail on it', () => {
    const p = place({ x: 480, y: 300 }, { w: 200, h: 50 }, bounds);
    expect(p).toEqual({ x: 380, y: 300 - GAP - 50, w: 200, h: 50, tail: 100, side: 'above' });
  });

  it('keeps the bubble inside the frame and leans the tail back to the head', () => {
    const p = place({ x: 20, y: 300 }, { w: 200, h: 50 }, bounds);
    expect(p.x).toBe(EDGE);
    expect(p.tail).toBe(TAIL_INSET); // the head is 12 px in, but the tail keeps its corner
    const q = place({ x: 950, y: 300 }, { w: 200, h: 50 }, bounds);
    expect(q.x + q.w).toBe(bounds.w - EDGE);
    expect(q.tail).toBe(q.w - TAIL_INSET);
    // in the middle, the tail is exactly on the head
    const mid = place({ x: 500, y: 300 }, { w: 200, h: 50 }, bounds);
    expect(mid.x + mid.tail).toBe(500);
  });

  it('never puts the tail off the bubble, even when the head is outside the frame', () => {
    for (const x of [-500, -20, 0, 12, 480, 950, 1200]) {
      const p = place({ x, y: 300 }, { w: 180, h: 44 }, bounds);
      expect(p.tail).toBeGreaterThanOrEqual(TAIL_INSET);
      expect(p.tail).toBeLessThanOrEqual(p.w - TAIL_INSET);
    }
  });

  it('goes below the head when there is no room above it, and points the tail up', () => {
    const p = place({ x: 480, y: 30 }, { w: 200, h: 50 }, bounds);
    expect(p.side).toBe('below');
    expect(p.y).toBe(30 + GAP);
  });

  it('is never wider than the frame, and never narrower than the minimum', () => {
    const wide = place({ x: 480, y: 300 }, { w: 4000, h: 40 }, bounds);
    expect(wide.w).toBe(bounds.w - EDGE * 2);
    const thin = place({ x: 480, y: 300 }, { w: 10, h: 40 }, bounds);
    expect(thin.w).toBe(MIN_W);
    expect(thin.tail).toBe(MIN_W / 2); // centred on the head, clamped inside
  });

  it('does not overflow a small canvas (a phone-sized stage)', () => {
    const small = { w: 320, h: 180 };
    const p = place({ x: 160, y: 60 }, { w: 400, h: 80 }, small);
    expect(p.x).toBeGreaterThanOrEqual(EDGE);
    expect(p.x + p.w).toBeLessThanOrEqual(small.w - EDGE);
    expect(p.y).toBeGreaterThanOrEqual(EDGE);
  });
});
