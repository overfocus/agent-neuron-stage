// The stage is a host, not a second opinion: these tests play a real show
// through maxcot's own conductor and stage in Node. maxcot draws only with a
// canvas, so the host is tested with a canvas factory that records nothing.
import { beforeAll, describe, expect, it } from 'vitest';
import { setCanvasFactory, type Ctx2D } from 'maxcot';
import { compileTrace } from '../src/fromtrace.ts';
import { ShowHost } from '../src/host.ts';
import { parseTrace } from '../src/trace.ts';
import duetJson from '../src/traces/duet.json';

const duet = parseTrace(duetJson);
const show = compileTrace(duet);

/** Just enough of a 2D context for the skins to paint into: every call is a no-op. */
function fakeContext(canvas: { width: number; height: number }): Ctx2D {
  const noop = () => {};
  const ctx = new Proxy(
    {},
    {
      get(_target, key) {
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
  return ctx as unknown as Ctx2D;
}

function fakeCanvas(width = 480, height = 300) {
  const canvas: Record<string, unknown> = { width, height, style: {} };
  canvas.getContext = () => fakeContext(canvas as { width: number; height: number });
  return canvas as unknown as HTMLCanvasElement;
}

beforeAll(() => {
  setCanvasFactory((w: number, h: number) => fakeCanvas(w, h) as unknown as OffscreenCanvas);
});

describe('ShowHost', () => {
  it('puts the cast on the stage and plays the score', () => {
    const lines: string[] = [];
    const canvas = fakeCanvas();
    const host = new ShowHost(canvas, show, { onLine: (who, text) => { if (text) lines.push(`${who}: ${text}`); } });
    expect(host.stage.members.map((m) => m.id)).toEqual(['cue', 'max', 'kid']);
    expect(host.total).toBeGreaterThan(0);
    host.play();
    // play the whole film in a few big steps, as a fast machine would
    for (let i = 0; i < 400 && host.playing; i++) host.tick(0.05);
    expect(host.playing).toBe(false);
    expect(lines).toContain('max: The tide kept me.');
    expect(lines).toContain('kid: You always say that.');
  });

  it('lands in the same state whichever way the playhead is scrubbed', () => {
    const canvas = fakeCanvas();
    const first = new ShowHost(canvas, show);
    first.seek(first.total * 0.75);
    const poseStraight = first.stage.get('kid').poseName;

    const canvas2 = fakeCanvas();
    const second = new ShowHost(canvas2, show);
    second.play();
    for (let i = 0; i < 40; i++) second.tick(0.05);
    second.pause();
    second.seek(0);
    second.seek(second.total * 0.75);
    expect(second.stage.get('kid').poseName).toBe(poseStraight);
    expect(second.stage.members).toHaveLength(3);
  });

  it('shows the card at the end and takes it away on a seek', () => {
    const cards: Array<string | null> = [];
    const host = new ShowHost(fakeCanvas(), show, { onCard: (text) => cards.push(text) });
    host.seek(host.total);
    expect(cards[cards.length - 1]).toBe('DUET');
    host.seek(0);
    expect(cards[cards.length - 1]).toBeNull();
  });

  it('ignores a command it does not know, once, without stopping the show', () => {
    const unknown: string[] = [];
    const host = new ShowHost(fakeCanvas(), { ...show, events: [...show.events, { at: [1, 1], sheet: 'styles' }] }, {
      onUnknown: (cmd) => unknown.push(cmd)
    });
    expect(unknown).toEqual(['sheet']);
  });

  it('rejects a pose the rig does not have instead of throwing', () => {
    const host = new ShowHost(fakeCanvas(), {
      ...show,
      events: [{ at: [1, 1], enter: { id: 'a', who: 'max' } }, { at: [2, 1], pose: 'no-such-pose', on: 'a' }]
    });
    host.seek(host.total);
    expect(host.stage.get('a').poseName).toBe('rest');
  });
});
