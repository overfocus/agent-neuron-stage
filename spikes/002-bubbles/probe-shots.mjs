// Where does the camera put each actor, shot by shot?
//
//   node spikes/002-bubbles/probe-shots.mjs
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

const noop = () => {};
function fakeCanvas(width = 960, height = 600) {
  const canvas = { width, height, style: {} };
  const ctx = new Proxy(
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
  canvas.getContext = () => ctx;
  return canvas;
}

try {
  const maxcot = await server.ssrLoadModule('/vendor/maxcot/src/index.ts');
  const skins = await server.ssrLoadModule('/vendor/maxcot/src/skins/index.ts');
  maxcot.setCanvasFactory((w, h) => fakeCanvas(w, h));
  const stage = new maxcot.Stage(fakeCanvas(), { skin: skins.pencil, autoplay: false });
  stage.add({ id: 'left', who: 'max', x: -1.9, z: 0 });
  stage.add({ id: 'right', who: 'kid', x: 1.9, z: 0 });

  const report = (label) => {
    for (let i = 0; i < 80; i++) stage.step(0.05);
    const drawn = stage.S.actors ?? [stage.S];
    console.log(`\n${label}`);
    stage.members.forEach((m, i) => {
      const S = drawn[i];
      console.log(
        `  ${m.id.padEnd(5)} x=${String(m.x).padStart(5)} cam.cx=${Math.round(S.cam.cx)} unit=${Math.round(S.cam.unit)} ` +
          `body=${Math.round(S.body.x)}..${Math.round(S.body.x + S.body.w)} top=${Math.round(S.body.y)}`
      );
    });
  };

  report('wide (default)');
  stage.shot('full', 'right');
  report('full on right');
  stage.shot('close', 'left');
  report('close on left');
} finally {
  await server.close();
}
