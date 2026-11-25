import { describe, expect, it } from 'vitest';
import { EDGE, GAP, HOLD, MIN_W, TAIL_INSET, liveLines, overlap, place, placeAll, sayLine } from '../src/bubble.ts';

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

describe('a line stays up for its second', () => {
  it('holds for HOLD seconds of film time, and never less', () => {
    const said = sayLine([], { id: 'ada:1', who: 'ada', text: 'a line' }, 3);
    expect(said).toHaveLength(1);
    expect(said[0]!.until).toBe(3 + HOLD);
    expect(liveLines(said, 3.0)).toHaveLength(1);
    expect(liveLines(said, 3.99)).toHaveLength(1); // still up at the end of its second
    expect(liveLines(said, 3 + HOLD)).toHaveLength(0); // and down after it
  });

  it('never lets a new line cut short one that is still in its second, even from the same speaker', () => {
    let lines = sayLine([], { id: 'ada:1', who: 'ada', text: 'first' }, 3);
    lines = sayLine(lines, { id: 'ada:2', who: 'ada', text: 'second' }, 3.4);
    expect(lines).toHaveLength(2); // two bubbles, both readable
    expect(lines.map((l) => l.text)).toEqual(['first', 'second']);
    // and once the first has had its second, the next line may sweep it away
    lines = sayLine(lines, { id: 'rosa:1', who: 'rosa', text: 'r' }, 4.1);
    expect(lines.map((l) => l.text)).toEqual(['second', 'r']);
  });

  it('keeps a whole room up at once', () => {
    let lines = sayLine([], { id: 'a', who: 'ada', text: 'a' }, 3);
    lines = sayLine(lines, { id: 'r', who: 'rosa', text: 'r' }, 3.2);
    lines = sayLine(lines, { id: 'b', who: 'bruno', text: 'b' }, 3.3);
    expect(liveLines(lines, 3.5).map((l) => l.who)).toEqual(['ada', 'rosa', 'bruno']);
  });
});

describe('placeAll', () => {
  it('never puts one bubble on another', () => {
    const heads = [
      { id: 'a', anchor: { x: 480, y: 300 }, size: { w: 200, h: 50 } },
      { id: 'b', anchor: { x: 520, y: 306 }, size: { w: 200, h: 50 } },
      { id: 'c', anchor: { x: 460, y: 292 }, size: { w: 180, h: 46 } }
    ];
    const placed = placeAll(heads, bounds);
    expect(placed).toHaveLength(3);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlap(placed[i]!, placed[j]!), `${placed[i]!.id} over ${placed[j]!.id}`).toBe(false);
      }
      expect(placed[i]!.y).toBeGreaterThanOrEqual(EDGE);
      expect(placed[i]!.y + placed[i]!.h).toBeLessThanOrEqual(bounds.h - EDGE);
    }
  });

  it('leaves a bubble alone when it has the place to itself', () => {
    const alone = placeAll([{ id: 'a', anchor: { x: 480, y: 300 }, size: { w: 200, h: 50 } }], bounds);
    expect(alone[0]).toMatchObject(place({ x: 480, y: 300 }, { w: 200, h: 50 }, bounds));
  });

  it('stacks a crowded room inside the frame', () => {
    const many = ['a', 'b', 'c', 'd'].map((id, i) => ({
      id,
      anchor: { x: 300 + i * 12, y: 120 },
      size: { w: 200, h: 50 }
    }));
    const placed = placeAll(many, bounds);
    for (let i = 0; i < placed.length; i++) {
      expect(placed[i]!.y).toBeGreaterThanOrEqual(EDGE);
      for (let j = i + 1; j < placed.length; j++) expect(overlap(placed[i]!, placed[j]!)).toBe(false);
    }
  });
});
