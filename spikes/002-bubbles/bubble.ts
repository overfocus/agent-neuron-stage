// spike 002: bubble geometry, shared by both renderers.
//
// The only thing a bubble needs from the stage is the speaker's head, and the
// merged scene has it: `Stage.S.actors[i].body` is that actor's box in canvas
// pixels, whose top edge is the top of the head. Everything else is layout:
// sit above the head, centre on it, stay inside the frame, and put the tail
// back on the head when the box had to move.

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
  /** Where the tail meets the bottom edge, in bubble-local pixels. */
  tailX: number;
}

/** How far the bubble floats above the head, and the smallest it may get. */
export const GAP = 10;
export const MIN_W = 70;

/** Put a bubble of `size` above `anchor`, inside `bounds` (both in canvas px). */
export function place(anchor: Anchor, size: Size, bounds: Size): Placement {
  const w = Math.min(Math.max(size.w, MIN_W), Math.max(MIN_W, bounds.w - 16));
  const h = size.h;
  let x = anchor.x - w / 2;
  x = Math.min(Math.max(x, 8), Math.max(8, bounds.w - w - 8));
  let y = anchor.y - GAP - h;
  if (y < 8) y = anchor.y + GAP + 22; // no room above: go below the head
  const tailX = Math.min(Math.max(anchor.x - x, 14), w - 14);
  return { x, y, w, h, tailX };
}

/** Words wrapped to `maxWidth` by the measuring function the renderer has. */
export function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** The same, for a renderer (DOM) that wraps text itself: how tall is a box of that width? */
export const LINE = 20;
export const PAD = 9;
export function boxOf(lines: number, lineHeight = LINE, pad = PAD): Size {
  return { w: 0, h: lines * lineHeight + pad * 2 };
}
