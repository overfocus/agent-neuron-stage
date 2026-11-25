// The stage is a host, not a second opinion: these tests play a real show
// through maxcot's own conductor and stage in Node. maxcot draws only with a
// canvas, so the host is tested with a canvas factory that records nothing.
import { beforeAll, describe, expect, it } from 'vitest';
import { setCanvasFactory, type Ctx2D } from 'maxcot';
import { compileTrace } from '../src/fromtrace.ts';
import { ShowHost } from '../src/host.ts';
import { parseTrace } from '../src/trace.ts';
import { parseShow } from '../src/fromscore.ts';
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

  it('paints one character in its own skin when a scene says so, and the cast in one otherwise', () => {
    const solo = new ShowHost(fakeCanvas(), show);
    expect(solo.mixed).toBe(false); // a trace's show: one skin for the cast
    solo.tick(0.016);

    const cast = parseShow(`{
      title: 'mosaic',
      bpm: 100,
      events: [
        { at: [1, 1], enter: { id: 'a', who: 'max', x: -0.9 } },
        { at: [1, 1], enter: { id: 'b', who: 'girl', x: 0.9 } },
        { at: [1, 2], style: 'riso', on: 'a' },
        { at: [2, 1], say: 'One of us is a print.', on: 'a' },
      ],
    }`);
    const host = new ShowHost(fakeCanvas(), cast);
    expect(host.mixed).toBe(true); // the cast names a look, so the host composites
    host.seek(1.9);
    host.tick(0.016);
    expect(host.mixed).toBe(true);
    expect(host.stage.members.map((m) => m.id)).toEqual(['a', 'b']);

    // a `style` with no `on` is still the whole cast's look, the old way
    const whole = parseShow(`{
      title: 'party', bpm: 100,
      events: [
        { at: [1, 1], enter: { id: 'a', who: 'max' } },
        { at: [1, 2], style: 'gigposter' },
      ],
    }`);
    const other = new ShowHost(fakeCanvas(), whole);
    expect(other.mixed).toBe(false);
    expect(other.show.skin).toBe('gigposter');
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

  it('finds each actor on screen, in the order the stage drew them', () => {
    const host = new ShowHost(fakeCanvas(), show);
    host.seek(host.total);
    host.tick(1 / 60); // the scene exists once a frame has been drawn
    const drawn = host.stage.S?.actors ?? [];
    expect(drawn.length).toBe(3);
    // the cast of the duet: cue is played by professor, and each box must be that actor's
    for (const [id, who] of [
      ['cue', 'professor'],
      ['max', 'max'],
      ['kid', 'kid']
    ] as const) {
      const scene = drawn.find((s) => s.F.who === who)!;
      expect(host.actorBox(id)).toMatchObject({
        x: scene.body.x,
        y: scene.body.y,
        w: scene.body.w,
        h: scene.body.h
      });
    }
    const head = host.headOf('kid')!;
    const box = host.actorBox('kid')!;
    expect(head).toEqual({ x: box.x + box.w / 2, y: box.y });
  });

  it('lands on the design a seek describes, not mid-morph: the cast faces itself', () => {
    const host = new ShowHost(fakeCanvas(), show);
    host.seek(host.total);
    expect(host.stage.get('max').design['view.yaw']).toBeCloseTo(0.38, 5);
    expect(host.stage.get('kid').design['view.yaw']).toBeCloseTo(-0.38, 5);
  });
});
