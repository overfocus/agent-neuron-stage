// bubbles.ts: the speech bubbles over the speakers' heads.
//
// The page draws them, not the canvas: real text wraps, is selectable and can be
// announced. The geometry (src/bubble.ts) is pure and tested; this class owns
// the DOM and the clock. Two rules come from the stage itself:
//
//   a line stays up for at least one second of film time (bubble.ts, HOLD), and
//   two bubbles never sit on top of each other (bubble.ts, placeAll).
//
// So a crowded room has several bubbles up at once, each on its own head, and a
// bubble that would cover another moves clear of it instead of drawing over it.
import { liveLines, placeAll, sayLine, type Anchor, type LiveLine } from './bubble.ts';

interface Slot {
  el: HTMLDivElement;
  who: HTMLSpanElement;
  line: HTMLSpanElement;
  tail: HTMLDivElement;
}

export class Bubbles {
  private layer: HTMLElement;
  private canvas: HTMLCanvasElement;
  private lines: LiveLine[] = [];
  /** One element per line (a speaker who says two things quickly has two). */
  private slots = new Map<string, Slot>();
  private next = 0;

  constructor(layer: HTMLElement, canvas: HTMLCanvasElement) {
    this.layer = layer;
    this.canvas = canvas;
  }

  /** Is any line up? */
  get showing(): boolean {
    return this.lines.length > 0;
  }

  /** The last person to speak, or '' before anyone has. */
  get speaker(): string {
    return this.lines[this.lines.length - 1]?.who ?? '';
  }

  /** Show a line from `who` at film time `at`; it stays up for at least HOLD seconds. */
  say(who: string, text: string, at: number): void {
    const line = { id: `${who}:${this.next++}`, who, text };
    this.lines = sayLine(this.lines, line, at);
    const slot = this.slots.get(line.id) ?? this.make(line.id);
    slot.who.textContent = who;
    slot.line.textContent = text;
    slot.el.setAttribute('aria-label', `${who}: ${text}`);
    // it shows on the next place(), with a position: never one frame at the corner
    slot.el.hidden = true;
    this.layer.append(slot.el); // re-appending puts the newest on top
    this.prune();
  }

  /** Take down every bubble whose second is up. Film time, so a pause holds them. */
  tick(at: number): void {
    const live = liveLines(this.lines, at);
    if (live.length !== this.lines.length) this.lines = live;
    this.prune();
  }

  clear(): void {
    this.lines = [];
    for (const slot of this.slots.values()) slot.el.remove();
    this.slots.clear();
  }

  /** Put every live bubble on its speaker's head, and none on top of another. */
  place(anchorOf: (id: string) => Anchor | null): void {
    if (!this.lines.length) return;
    const canvasRect = this.canvas.getBoundingClientRect();
    const layerRect = this.layer.getBoundingClientRect();
    const scale = canvasRect.width / this.canvas.width || 1;
    const wanted = [];
    for (const line of this.lines) {
      const slot = this.slots.get(line.id);
      if (!slot) continue;
      const anchor = anchorOf(line.who);
      if (!anchor) {
        slot.el.hidden = true;
        continue;
      }
      slot.el.hidden = false;
      wanted.push({
        id: line.id,
        anchor,
        size: { w: slot.el.offsetWidth / scale, h: slot.el.offsetHeight / scale }
      });
    }
    const placed = placeAll(wanted, { w: this.canvas.width, h: this.canvas.height });
    const originX = canvasRect.left - layerRect.left;
    const originY = canvasRect.top - layerRect.top;
    for (const p of placed) {
      const slot = this.slots.get(p.id);
      if (!slot) continue;
      slot.el.style.left = `${originX + p.x * scale}px`;
      slot.el.style.top = `${originY + p.y * scale}px`;
      slot.el.classList.toggle('below', p.side === 'below');
      slot.tail.style.left = `${p.tail * scale - 9}px`; // the tail is 18px wide
    }
    // The layout above works in the model's pixels; this settles on the pixels
    // the page actually drew (fonts, borders, a scale the model did not know).
    // Nobody's bubble covers anybody else's - that is the rule.
    const boxes = placed.map((p) => {
      const slot = this.slots.get(p.id);
      const w = slot ? slot.el.offsetWidth : p.w * scale;
      const h = slot ? slot.el.offsetHeight : p.h * scale;
      return { id: p.id, x: originX + p.x * scale, y: originY + p.y * scale, w, h };
    });
    for (let round = 0; round < boxes.length; round++) {
      let moved = false;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          if (a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h) continue;
          const slot = this.slots.get(b.id);
          if (!slot) continue;
          const lift = Math.max(originY, Math.min(b.y, a.y - b.h - 5 * scale)); // up, or as high as the frame goes
          const shift = b.y - lift;
          b.y = lift;
          slot.el.style.top = `${b.y}px`;
          moved = moved || shift > 0.5;
        }
      }
      if (!moved) break;
    }
  }

  private make(id: string): Slot {
    const el = document.createElement('div');
    el.className = 'bubble';
    const name = document.createElement('span');
    name.className = 'bubble-who';
    const line = document.createElement('span');
    line.className = 'bubble-line';
    const tail = document.createElement('div');
    tail.className = 'bubble-tail';
    el.append(name, line, tail);
    const slot = { el, who: name, line, tail };
    this.slots.set(id, slot);
    return slot;
  }

  /** Drop the elements of bubbles that are no longer live. */
  private prune(): void {
    const live = new Set(this.lines.map((l) => l.id));
    for (const [id, slot] of [...this.slots]) {
      if (live.has(id)) continue;
      slot.el.remove();
      this.slots.delete(id);
    }
  }
}
