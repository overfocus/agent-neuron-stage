// spike 001: can two characters face each other by orientation?
//
// Four variants over one stage, read back from the rig: yaw = view.yaw + twist,
// sin(yaw) is the x of the face normal (positive points screen-right), and
// eyes.lookX is the gaze. The claim under test is that "facing" needs the
// design yaw per actor, because `look` only moves the eyes.
import { Stage, type Scene } from 'maxcot';
import { pencil } from 'maxcot/skins';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const readout = document.querySelector<HTMLTableElement>('#readout')!;
const verdict = document.querySelector<HTMLElement>('#verdict')!;
const yawSlider = document.querySelector<HTMLInputElement>('#yaw')!;

const stage = new Stage(canvas, { skin: pencil, autoplay: false });
stage.add({ id: 'left', who: 'max', x: -1.9, z: 0 });
stage.add({ id: 'right', who: 'kid', x: 1.9, z: 0 });

type Variant = 'asis' | 'look' | 'face' | 'both';
let variant: Variant = 'asis';

function apply(): void {
  const amount = Number(yawSlider.value);
  stage.look('left', null);
  stage.look('right', null);
  // reset the design yaw to the default, so switching variants starts clean
  for (const m of stage.members) stage.get(m.id).set('view.yaw', 0.38);
  if (variant === 'look' || variant === 'both') {
    stage.look('left', 'right');
    stage.look('right', 'left');
  }
  if (variant === 'face' || variant === 'both') {
    for (const m of stage.members) {
      const other = stage.members.find((o) => o !== m)!;
      const dir = Math.sign(other.x - m.x) || 1;
      // yaw > 0 faces screen-right: turn each one toward the other
      stage.get(m.id).set('view.yaw', dir * amount);
    }
  }
  stage.dirty = true;
}

function scenes(S: Scene | null): Scene[] {
  if (!S) return [];
  return S.actors ?? [S];
}

function read() {
  const drawn = scenes(stage.S);
  return stage.members.map((m, i) => {
    const S = drawn[i]!;
    const P = S.F.P;
    const yaw = P['view.yaw'] + S.F.C.twist;
    return {
      id: m.id,
      x: m.x,
      yaw,
      design: P['view.yaw'],
      twist: S.F.C.twist,
      face: Math.sin(yaw),
      gaze: S.F.C['eyes.lookX']
    };
  });
}

function paintReadout(): void {
  const rows = read();
  readout.innerHTML =
    '<tr><th>actor</th><th>x</th><th>yaw</th><th>design</th><th>twist</th><th>faces</th><th>gaze</th></tr>' +
    rows
      .map(
        (r) =>
          `<tr><td>${r.id}</td><td>${r.x}</td><td>${r.yaw.toFixed(2)}</td><td>${r.design.toFixed(2)}</td>` +
          `<td>${r.twist.toFixed(2)}</td><td class="${r.face > 0 ? '' : ''}">${r.face > 0.05 ? 'right' : r.face < -0.05 ? 'left' : 'camera'}</td>` +
          `<td>${r.gaze.toFixed(2)}</td></tr>`
      )
      .join('');
  const [l, r] = rows;
  if (!l || !r) return;
  const facing = Math.sign(l.face) > 0 && Math.sign(r.face) < 0;
  verdict.innerHTML = facing
    ? '<span class="yes">they face each other</span> — their bodies are turned toward one another.'
    : '<span class="no">they do not face each other</span> — both bodies are turned the same way, and only the eyes move.';
}

for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="v"]')) {
  radio.addEventListener('change', () => {
    variant = radio.value as Variant;
    apply();
  });
}
yawSlider.addEventListener('input', apply);

apply();
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stage.step(dt);
  paintReadout();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
