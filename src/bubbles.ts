// bubbles.ts: a speech bubble over the speaker's head.
//
// The page draws it, not the canvas: real text wraps, is selectable and can be
// announced, and the geometry (src/bubble.ts) is the only part that needs a
// test. The anchor is `ShowHost.actorBox(id)` - the actor's body box from the
// last frame - so the bubble follows the camera by itself.
import { place, type Anchor, type Placement } from './bubble.ts';

export class Bubbles {
  /** Whose line is showing, or '' when nobody is speaking. */
  speaker = '';
  private el: HTMLDivElement;
  private who: HTMLSpanElement;
  private line: HTMLSpanElement;
  private tail: HTMLDivElement;
  private layer: HTMLElement;
  private canvas: HTMLCanvasElement;
  private last: Placement | null = null;

  constructor(layer: HTMLElement, canvas: HTMLCanvasElement) {
    this.layer = layer;
    this.canvas = canvas;
    this.el = document.createElement('div');
    this.el.className = 'bubble';
    this.el.hidden = true;
    this.who = document.createElement('span');
    this.who.className = 'bubble-who';
    this.line = document.createElement('span');
    this.line.className = 'bubble-line';
    this.tail = document.createElement('div');
    this.tail.className = 'bubble-tail';
    this.el.append(this.who, this.line, this.tail);
    layer.append(this.el);
  }

  get showing(): boolean {
    return !this.el.hidden;
  }

  /** Show a line, anchored to whoever `who` names. The placement comes next frame. */
  say(who: string, text: string): void {
    this.speaker = who;
    this.who.textContent = who;
    this.line.textContent = text;
    this.el.hidden = false;
    this.el.setAttribute('aria-label', `${who}: ${text}`);
  }

  clear(): void {
    this.speaker = '';
    this.el.hidden = true;
    this.last = null;
  }

  /** Put the bubble on the head this frame; hide it if the head left the stage. */
  place(anchor: Anchor | null): Placement | null {
    if (!this.speaker) return null;
    if (!anchor) {
      this.el.hidden = true;
      return null;
    }
    this.el.hidden = false;
    const canvasRect = this.canvas.getBoundingClientRect();
    const layerRect = this.layer.getBoundingClientRect();
    const scale = canvasRect.width / this.canvas.width || 1;
    const size = {
      w: this.el.offsetWidth / scale,
      h: this.el.offsetHeight / scale
    };
    const p = place(anchor, size, { w: this.canvas.width, h: this.canvas.height });
    const left = canvasRect.left - layerRect.left + p.x * scale;
    const top = canvasRect.top - layerRect.top + p.y * scale;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.classList.toggle('below', p.side === 'below');
    this.tail.style.left = `${p.tail * scale - 9}px`; // the tail is 18px wide
    this.last = p;
    return p;
  }

  /** Where the bubble was last put, for a readout or a test. */
  get placement(): Placement | null {
    return this.last;
  }
}
