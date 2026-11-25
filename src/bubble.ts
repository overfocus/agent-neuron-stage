// bubble.ts: where a speech bubble goes, measured against the speaker's head.
//
// The stage gives the anchor: `ShowHost.actorBox(id)` is the actor's body box in
// canvas pixels, so the head is its top centre. This module owns the rest -
// sit above the head, centre on it, stay inside the frame, and keep the tail
// pointing at the head even when the bubble had to move. It is pure, so the
// arithmetic is tested without a DOM (test/bubble.test.ts).

export interface Anchor {
  /** The head, in canvas pixels. */
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the tail meets the bubble, in bubble-local pixels. */
  tail: number;
  /** Above the head with the tail down, or below it with the tail up. */
  side: 'above' | 'below';
}

/** How far the bubble floats off the head, and the margin it keeps from the frame. */
export const GAP = 10;
export const EDGE = 8;
export const MIN_W = 70;
/** How much of the tail stays on the bubble's corner when the head is off to one side. */
export const TAIL_INSET = 14;

/** How long a line stays up at least, in seconds of the film's own clock. */
export const HOLD = 1;

export interface LiveLine {
  /** One per line said, so a speaker who talks twice quickly gets two bubbles. */
  id: string;
  who: string;
  text: string;
  /** Film time at which this bubble may come down. */
  until: number;
}

/**
 * A line takes the floor, and keeps it for its full second. Lines already past
 * their second are cleared first (so the stage does not silt up); a new line is
 * never allowed to cut short one that is still in its second, even when the same
 * speaker says it - that line gets a bubble of its own.
 */
export function sayLine(lines: LiveLine[], line: Omit<LiveLine, 'until'>, at: number): LiveLine[] {
  const live = lines.filter((l) => at < l.until);
  live.push({ ...line, until: at + HOLD });
  return live;
}

/** The lines still up at `at`. A bubble is never taken down before its second. */
export function liveLines(lines: LiveLine[], at: number): LiveLine[] {
  return lines.filter((l) => at < l.until);
}

/** One bubble waiting to be put somewhere. */
export interface Wanted {
  id: string;
  anchor: Anchor;
  size: Size;
}

/** A placed bubble. */
export interface Placed extends Placement {
  id: string;
}

/** How much air two bubbles keep between them. */
export const STACK = 5;

/**
 * Place a bubble of `size` on `anchor`, inside `bounds` — all in canvas pixels.
 * Above the head when there is room, below it otherwise (a close-up puts the
 * head near the top edge).
 */
export function place(anchor: Anchor, size: Size, bounds: Size): Placement {
  const w = Math.min(Math.max(size.w, MIN_W), Math.max(MIN_W, bounds.w - EDGE * 2));
  const h = size.h;
  const x = Math.min(Math.max(anchor.x - w / 2, EDGE), Math.max(EDGE, bounds.w - w - EDGE));
  const above = anchor.y - GAP - h;
  const side: Placement['side'] = above >= EDGE ? 'above' : 'below';
  const y = side === 'above' ? above : anchor.y + GAP;
  const tail = Math.min(Math.max(anchor.x - x, TAIL_INSET), w - TAIL_INSET);
  return { x, y, w, h, tail, side };
}

/**
 * Place several bubbles at once, and never on top of each other.
 *
 * Each one goes where `place` would put it; if that is on a bubble already
 * placed, it moves clear — above the one it hit when there is room, below it
 * otherwise, and pinned inside the frame as a last resort. The lowest head is
 * placed first, so the bubble that gives way is the one that was higher anyway.
 */
export function placeAll(wanted: Wanted[], bounds: Size): Placed[] {
  const order = [...wanted].sort((a, b) => b.anchor.y - a.anchor.y);
  const out: Placed[] = [];
  for (const want of order) {
    const base = place(want.anchor, want.size, bounds);
    // every height it could take: its own, above that, and below its head
    const rows: number[] = [base.y];
    for (let y = base.y - base.h - STACK; y >= EDGE; y -= base.h + STACK) rows.push(y);
    for (let y = want.anchor.y + GAP; y + base.h <= bounds.h - EDGE; y += base.h + STACK) rows.push(y);
    // and every column it could take: its own, then one bubble to the left, right
    const columns: number[] = [base.x];
    for (let d = base.w + STACK; d + base.w <= bounds.w; d += base.w + STACK) {
      if (base.x - d >= EDGE) columns.push(base.x - d);
      if (base.x + d + base.w <= bounds.w - EDGE) columns.push(base.x + d);
    }
    let settled: Placed | null = null;
    search: for (const y of rows) {
      for (const x of columns) {
        const tail = Math.min(Math.max(want.anchor.x - x, TAIL_INSET), base.w - TAIL_INSET);
        const cand: Placed = { ...base, x, y, tail, side: y >= want.anchor.y ? 'below' : base.side, id: want.id };
        if (!out.some((p) => overlap(p, cand))) {
          settled = cand;
          break search;
        }
      }
    }
    out.push(settled ?? { ...base, y: EDGE, id: want.id });
  }
  return out;
}

/** Do two placed bubbles want the same pixels? */
export function overlap(a: Placement, b: Placement): boolean {
  return a.x < b.x + b.w + STACK && b.x < a.x + a.w + STACK && a.y < b.y + b.h + STACK && b.y < a.y + a.h + STACK;
}
