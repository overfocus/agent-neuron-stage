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
