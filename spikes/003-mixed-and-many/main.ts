// spike 003: can a stage draw each character in its own skin, and how many
// characters fit before the picture stops working?
//
// maxcot's Stage paints the merged cast in ONE skin (`Stage.draw` ->
// paint(merged, this.skin)), so a mixed cast needs another pass: after the
// stage has built each actor's scene, paint that scene with the actor's own
// skin into a scratch canvas and composite it back, clipped to the actor's box
// (some skins paint the whole frame, and an unclipped composite erases the cast
// that came before).
import { Stage, paint, kit } from 'maxcot';
import { skinsByName } from 'maxcot/skins';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const readout = document.getElementById('readout') as HTMLElement;
const scratch = document.createElement('canvas');
scratch.width = canvas.width;
scratch.height = canvas.height;

const CASTS = ['max', 'child', 'boss', 'oldman', 'girl', 'clerk', 'teen', 'professor'];
/** Skins that draw a cut-out cleanly: no full-frame ground, no smeared history. */
const MIX = ['pencil', 'riso', 'manga', 'inkpunch', 'gigposter', 'neon', 'cubist', 'sketch'];
const stage = new Stage(canvas, { skin: skinsByName()['pencil']!, autoplay: false });
const ctx = canvas.getContext('2d')! as unknown as CanvasRenderingContext2D;

let count = 8;
let mixed = true;
let poses: string[] = [];
let frames = 0;
let clock = performance.now();
let msAvg = 0;

function build(n: number): void {
  count = n;
  for (const m of [...stage.members]) stage.remove(m.id);
  poses = [];
  const gap = n <= 8 ? 1.9 : n <= 12 ? 1.6 : n <= 20 ? 1.25 : 1.0;
  for (let i = 0; i < n; i++) {
    const pose = ['thinking', 'feel-happy', 'fedup', 'feel-surprised', 'pleased', 'rest', 'at-ease', 'feel-sad'][i % 8]!;
    poses.push(pose);
    stage.add({
      id: `a${i}`,
      who: CASTS[i % CASTS.length]!,
      x: (i - (n - 1) / 2) * gap,
      z: (i % 3) * 0.18,
      pose
    });
  }
  stage.shot('wide');
  stage.cut();
  stage.step(0.016);
  paintIt(0.016);
  hud();
}

/** The order the merged scene is in: far to near, which is what `stage.S.actors` follows. */
function orderedIds(): string[] {
  return stage.members.slice().sort((a, b) => b.z - a.z).map((m) => m.id);
}

/** Paint each actor's scene with its own skin, clipped to that actor, over a neutral ground. */
function paintIt(dt: number): void {
  const S = stage.S;
  if (!S) return;
  const scenes = (S as { actors?: typeof S[] }).actors ?? [S];
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  kit.paper(ctx, w, h, '#f2f0e9', 1.1);
  ctx.restore();
  const ids = orderedIds();
  scenes.forEach((sc, i) => {
    const id = ids[i] ?? `a${i}`;
    const skin = mixed ? skinsByName()[MIX[i % MIX.length]!]! : stage.skin;
    const pad = sc.unit * 0.55;
    const box = {
      x: Math.max(0, Math.floor(sc.body.x - pad)),
      y: Math.max(0, Math.floor(sc.body.y - pad * 0.8))
    };
    const bw = Math.min(w - box.x, Math.ceil(sc.body.w + pad * 2));
    const bh = Math.min(h - box.y, Math.ceil(sc.body.h + pad * 1.6));
    if (bw <= 0 || bh <= 0) return;
    // a box-sized scratch, translated: painting the whole frame per actor cost
    // 8x a full-canvas paint and ran the spike at 30 ms a frame
    if (scratch.width !== bw || scratch.height !== bh) {
      scratch.width = bw;
      scratch.height = bh;
    }
    const sctx = scratch.getContext('2d')! as unknown as CanvasRenderingContext2D;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, bw, bh);
    sctx.setTransform(1, 0, 0, 1, -box.x, -box.y);
    const t = performance.now() / 1000;
    paint(sctx as never, sc, skin, { t, key: `a${i}`, ground: false });
    ctx.drawImage(scratch, box.x, box.y);
    void id;
  });
}

function hud(): void {
  const skins = mixed ? MIX.slice(0, Math.min(count, MIX.length)).join(' ') : stage.skin.name;
  readout.innerHTML =
    `<b>${count}</b> characters · ${mixed ? 'mixed skins' : 'one skin'} · ` +
    `${frames ? (1000 / (msAvg || 1)).toFixed(0) : '–'} fps · ${msAvg.toFixed(1)} ms/frame` +
    `<br />poses: ${poses.join(' ')}` +
    `<br />${mixed ? 'skins in order: ' + skins : 'skin: ' + skins}`;
}

function loop(now: number): void {
  const dt = Math.min(0.1, (now - clock) / 1000);
  clock = now;
  const t0 = performance.now();
  stage.step(dt);
  paintIt(dt);
  msAvg = msAvg * 0.85 + (performance.now() - t0) * 0.15;
  frames++;
  if (frames % 20 === 0) hud();
  requestAnimationFrame(loop);
}

const counts = document.getElementById('counts')!;
for (const n of [1, 4, 8, 12, 16, 24, 32]) {
  const b = document.createElement('button');
  b.textContent = String(n);
  b.addEventListener('click', () => {
    build(n);
    for (const other of counts.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b));
  });
  counts.append(b);
}

const mixedBtn = document.getElementById('mixed') as HTMLButtonElement;
const singleBtn = document.getElementById('single') as HTMLButtonElement;
mixedBtn.addEventListener('click', () => {
  mixed = true;
  mixedBtn.setAttribute('aria-pressed', 'true');
  singleBtn.setAttribute('aria-pressed', 'false');
  hud();
});
singleBtn.addEventListener('click', () => {
  mixed = false;
  mixedBtn.setAttribute('aria-pressed', 'false');
  singleBtn.setAttribute('aria-pressed', 'true');
  hud();
});

build(8);
(counts.querySelectorAll('button')[2] as HTMLButtonElement).setAttribute('aria-pressed', 'true');
requestAnimationFrame(loop);
