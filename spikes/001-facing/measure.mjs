// Measure how two characters are oriented, variant by variant.
//
//   node spikes/001-facing/measure.mjs
//
// It plays a two-actor stage through maxcot's real Stage in Node (with a canvas
// stub: no pixels are needed for geometry) and prints, per actor, the yaw the
// figure is actually drawn at, which way its face normal points, and where its
// pupils and body land on screen. Yaw = view.yaw (a design dial) + twist (a
// channel); sin(yaw) is the x of the face normal after the rotation, so a
// positive number means the face points screen-right.
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

function fakeContext(canvas) {
  const noop = () => {};
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (key === 'canvas') return canvas;
        if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') {
          return () => ({ addColorStop: noop });
        }
        if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        if (key === 'measureText') return () => ({ width: 10 });
        return noop;
      },
      set() {
        return true;
      }
    }
  );
}

function fakeCanvas(width = 960, height = 600) {
  const canvas = { width, height, style: {} };
  canvas.getContext = () => fakeContext(canvas);
  return canvas;
}

try {
  const maxcot = await server.ssrLoadModule('/vendor/maxcot/src/index.ts');
  const skins = await server.ssrLoadModule('/vendor/maxcot/src/skins/index.ts');
  const { Stage, setCanvasFactory } = maxcot;
  setCanvasFactory((w, h) => fakeCanvas(w, h));
  const skin = skins.pencil;

  const stageWith = () => {
    const stage = new Stage(fakeCanvas(), { skin, autoplay: false });
    stage.add({ id: 'left', who: 'max', x: -1.9, z: 0 });
    stage.add({ id: 'right', who: 'kid', x: 1.9, z: 0 });
    return stage;
  };

  const settle = (stage) => {
    for (let i = 0; i < 80; i++) stage.step(0.05);
    return stage;
  };

  const look = (stage) => stage.look('left', 'right').look('right', 'left');

  /** The variant the host should apply: turn the body toward the one addressed. */
  const face = (stage) => {
    for (const m of stage.members) {
      const other = stage.members.find((o) => o !== m);
      const dir = Math.sign(other.x - m.x) || 1;
      // yaw > 0 faces screen-right, so the sign follows the direction to the partner
      stage.get(m.id).set('view.yaw', dir * 0.38);
    }
  };

  const read = (stage) => {
    stage.step(0.02);
    const scenes = stage.S.actors ?? [stage.S];
    return stage.members.map((m, i) => {
      const S = scenes[i];
      const P = S.F.P;
      const yaw = P['view.yaw'] + S.F.C.twist;
      const pupils = S.parts.filter((p) => p.fill === 'pupil');
      const pts = pupils.flatMap((p) => p.pts);
      const px = pts.reduce((a, q) => a + q[0], 0) / (pts.length || 1);
      const py = pts.reduce((a, q) => a + q[1], 0) / (pts.length || 1);
      const body = S.body;
      return {
        id: m.id,
        x: m.x,
        yaw: +yaw.toFixed(3),
        twist: +S.F.C.twist.toFixed(3),
        designYaw: +P['view.yaw'].toFixed(3),
        faceX: +Math.sin(yaw).toFixed(3),
        lookX: +S.F.C['eyes.lookX'].toFixed(3),
        cheat: +P['eyes.cheat'].toFixed(2),
        pupilX: Math.round(px),
        body: { x: Math.round(body.x), y: Math.round(body.y), w: Math.round(body.w), h: Math.round(body.h) }
      };
    });
  };

  const variants = [
    ['as is (no look)', () => {}],
    ['look, as the stage does it', (s) => look(s)],
    ['face the partner (view.yaw by side)', (s) => face(s)],
    ['face + look', (s) => (face(s), look(s))],
    ['look, then a stronger twist', (s) => (look(s), s.get('left').pose('turn-to').snap(), s.get('right').pose('turn-to').snap())]
  ];

  for (const [name, apply] of variants) {
    const stage = stageWith();
    apply(stage);
    const rows = read(settle(stage));
    console.log(`\n${name}`);
    for (const r of rows) {
      console.log(
        `  ${r.id.padEnd(5)} x=${String(r.x).padStart(5)} yaw=${String(r.yaw).padStart(6)} ` +
          `(design ${r.designYaw}, twist ${r.twist}) face→${r.faceX > 0 ? 'right' : 'left'} ${String(r.faceX).padStart(6)} ` +
          `eyes.lookX=${String(r.lookX).padStart(6)} pupils at x=${r.pupilX} body x=${r.body.x}..${r.body.x + r.body.w}`
      );
    }
    const [l, r] = rows;
    const towards = Math.sign(r.x - l.x);
    console.log(
      `  → ${l.id} faces ${l.faceX > 0 ? 'right' : 'left'}, ${r.id} faces ${r.faceX > 0 ? 'right' : 'left'}; ` +
        `they ${Math.sign(l.faceX) === towards && Math.sign(r.faceX) === -towards ? 'FACE EACH OTHER' : 'do NOT face each other'}`
    );
  }
} finally {
  await server.close();
}
