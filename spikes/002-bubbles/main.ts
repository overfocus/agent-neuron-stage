// spike 002: a speech bubble anchored to the speaker's head.
//
// Two renderers over one geometry (bubble.ts): a DOM div over the canvas, and
// text drawn on the canvas after the stage. Both use the same anchor, which is
// the speaker's body box from the merged scene (Stage.S.actors[i].body), so
// both follow the camera when it cuts.
import { Stage, type Scene } from 'maxcot';
import { pencil } from 'maxcot/skins';
import { place, wrap, LINE, PAD, type Placement } from './bubble.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const layer = document.querySelector<HTMLElement>('#bubbles')!;
const readout = document.querySelector<HTMLTableElement>('#readout')!;
const lineInput = document.querySelector<HTMLInputElement>('#line')!;
const shotSelect = document.querySelector<HTMLSelectElement>('#shot')!;

const ctx = canvas.getContext('2d')!;
const stage = new Stage(canvas, { skin: pencil, autoplay: false });
stage.add({ id: 'left', who: 'max', x: -1.9, z: 0 });
stage.add({ id: 'right', who: 'kid', x: 1.9, z: 0 });
// they face each other: spike 001's finding, applied here
stage.get('left').set('view.yaw', 0.38);
stage.get('right').set('view.yaw', -0.38);

type Speaker = { id: string; text: string } | null;
let speaker: Speaker = { id: 'left', text: 'You always say that.' };
let renderer: 'dom' | 'canvas' = 'dom';

const dom = document.createElement('div');
dom.style.cssText =
  'position:absolute;background:#fffdf4;color:#16161c;border:2px solid #22222a;border-radius:12px;' +
  'padding:9px 12px;font:600 16px/20px ui-sans-serif,system-ui,sans-serif;max-width:250px;' +
  'box-shadow:3px 3px 0 rgb(0 0 0 / 0.25);display:none';
const tail = document.createElement('div');
tail.style.cssText = 'position:absolute;bottom:-10px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #22222a';
dom.append(tail);
layer.append(dom);

function scenes(S: Scene | null): Scene[] {
  if (!S) return [];
  return S.actors ?? [S];
}

/** The speaker's head, in canvas pixels: the top-centre of its body box. */
function headOf(id: string): { x: number; y: number; body: Scene['body'] } | null {
  const drawn = scenes(stage.S);
  const i = stage.members.findIndex((m) => m.id === id);
  const S = drawn[i];
  if (!S) return null;
  return { x: S.body.x + S.body.w / 2, y: S.body.y, body: S.body };
}

// ── canvas renderer ───────────────────────────────────────────────────────
function drawCanvasBubble(anchor: { x: number; y: number }, text: string): Placement {
  ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif';
  const maxText = 250 - PAD * 2;
  const lines = wrap(text, maxText, (s) => ctx.measureText(s).width);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + PAD * 2;
  const p = place(anchor, { w, h: lines.length * LINE + PAD * 2 }, { w: canvas.width, h: canvas.height });
  ctx.save();
  ctx.fillStyle = '#fffdf4';
  ctx.strokeStyle = '#22222a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.stroke();
  // the tail, pointing at the head
  ctx.beginPath();
  ctx.moveTo(p.x + p.tailX - 9, p.y + p.h);
  ctx.lineTo(p.x + p.tailX + 9, p.y + p.h);
  ctx.lineTo(p.x + p.tailX, p.y + p.h + 12);
  ctx.closePath();
  ctx.fillStyle = '#fffdf4';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#16161c';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, p.x + PAD, p.y + PAD + i * LINE + 2));
  ctx.restore();
  return p;
}

// ── DOM renderer ─────────────────────────────────────────────────────────
function drawDomBubble(anchor: { x: number; y: number }, text: string): Placement {
  dom.style.display = 'block';
  dom.textContent = text;
  dom.append(tail);
  const cRect = canvas.getBoundingClientRect();
  const lRect = layer.getBoundingClientRect();
  const scale = cRect.width / canvas.width || 1;
  const w = dom.offsetWidth;
  const h = dom.offsetHeight;
  const p = place(anchor, { w: w / scale, h: h / scale }, { w: canvas.width, h: canvas.height });
  dom.style.left = `${cRect.left - lRect.left + p.x * scale}px`;
  dom.style.top = `${cRect.top - lRect.top + p.y * scale}px`;
  tail.style.left = `${p.tailX * scale - 8}px`;
  return p;
}

function hideDom(): void {
  dom.style.display = 'none';
}

// ── the loop ─────────────────────────────────────────────────────────────
let placement: Placement | null = null;
let anchor: { x: number; y: number } | null = null;
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stage.step(dt);
  const head = speaker ? headOf(speaker.id) : null;
  if (speaker && head) {
    anchor = { x: head.x, y: head.y };
    if (renderer === 'dom') {
      placement = drawDomBubble(anchor, speaker.text);
    } else {
      hideDom();
      placement = drawCanvasBubble(anchor, speaker.text);
    }
  } else {
    hideDom();
    anchor = null;
    placement = null;
  }
  paintReadout();
  requestAnimationFrame(frame);
}

function paintReadout(): void {
  const head = anchor;
  const p = placement;
  if (!head || !p) {
    readout.innerHTML = '<tr><td>no bubble</td></tr>';
    return;
  }
  const dx = Math.abs(p.x + p.tailX - head.x);
  const inside = p.x >= 8 && p.x + p.w <= canvas.width - 8;
  readout.innerHTML =
    `<tr><th>head (canvas px)</th><td>${Math.round(head.x)}, ${Math.round(head.y)}</td></tr>` +
    `<tr><th>bubble</th><td>${Math.round(p.x)}, ${Math.round(p.y)} · ${Math.round(p.w)}×${Math.round(p.h)}</td></tr>` +
    `<tr><th>tail on the head</th><td>±${dx.toFixed(1)} px</td></tr>` +
    `<tr><th>inside the frame</th><td>${inside ? 'yes' : 'no'}</td></tr>`;
}

document.querySelector('#say-left')!.addEventListener('click', () => {
  speaker = { id: 'left', text: lineInput.value };
  last = performance.now();
});
document.querySelector('#say-right')!.addEventListener('click', () => {
  speaker = { id: 'right', text: lineInput.value };
  last = performance.now();
});
document.querySelector('#clear')!.addEventListener('click', () => {
  speaker = null;
  hideDom();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stage.dirty = true;
});
shotSelect.addEventListener('change', () => {
  const v = shotSelect.value;
  if (v === 'wide') stage.shot('wide');
  else if (v === 'full-left') stage.shot('full', 'left');
  else if (v === 'close-left') stage.shot('close', 'left');
  else stage.shot('full', 'right');
});
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="r"]')) {
  radio.addEventListener('change', () => {
    renderer = radio.value as 'dom' | 'canvas';
    if (renderer === 'canvas') hideDom();
  });
}

requestAnimationFrame(frame);
