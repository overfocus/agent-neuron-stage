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
import labJson from '../src/traces/lab.json';

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

  it('walks a member where the score says, and lands mid-step on a seek', () => {
    const unknown: string[] = [];
    const walking = parseShow(`{
      title: 'walk', bpm: 60,
      events: [
        { at: [1, 1], enter: { id: 'a', who: 'max', x: -2, z: 0 } },
        { at: [1, 2], move: { x: 2, z: 1 }, over: 2, on: 'a' },
      ],
    }`);
    const host = new ShowHost(fakeCanvas(), walking, { onUnknown: (cmd) => unknown.push(cmd) });
    // one beat a second: the walk runs from 1s to 3s, eased
    host.seek(0.5);
    expect(host.stage.member('a').x).toBe(-2);
    host.seek(2);
    expect(host.stage.member('a').x).toBeCloseTo(0, 6); // half way, half eased
    expect(host.stage.member('a').z).toBeCloseTo(0.5, 6);
    host.seek(4);
    expect(host.stage.member('a').x).toBe(2);
    expect(host.stage.member('a').z).toBe(1);
    // a step is from where the body stands, and a walk is a command the stage knows
    const stepping = parseShow(`{
      title: 'step', bpm: 60,
      events: [
        { at: [1, 1], enter: { id: 'a', who: 'max', x: -2 } },
        { at: [1, 2], move: { dx: 1.5 }, over: 1, on: 'a' },
      ],
    }`);
    const other = new ShowHost(fakeCanvas(), stepping, { onUnknown: (cmd) => unknown.push(cmd) });
    other.seek(3);
    expect(other.stage.member('a').x).toBeCloseTo(-0.5, 6);
    expect(unknown).toEqual([]);
  });

  it('turns the body to whoever it looks at, and follows them as they walk', () => {
    const show = parseShow(`{
      title: 'look', bpm: 60,
      events: [
        { at: [1, 1], enter: { id: 'a', who: 'max', x: -2 } },
        { at: [1, 1], enter: { id: 'b', who: 'girl', x: 2 } },
        { at: [1, 2], look: 'b', on: 'a' },
        { at: [2, 1], move: { x: -4 }, over: 1, on: 'b' },
      ],
    }`);
    const host = new ShowHost(fakeCanvas(), show);
    host.seek(1.5);
    expect(host.stage.get('a').design['view.yaw']).toBeCloseTo(0.38, 2); // b is to its right
    // b walks past a, to the left: a's body turns to keep facing b
    host.seek(6);
    for (let i = 0; i < 60; i++) host.tick(1 / 60);
    expect(host.stage.member('b').x).toBe(-4);
    expect(host.stage.get('a').design['view.yaw']).toBeCloseTo(-0.38, 1);
  });

  it('turns a walking body the way it is going, unless it is addressing someone', () => {
    const show = parseShow(`{
      title: 'walk on', bpm: 60,
      events: [
        { at: [1, 1], enter: { id: 'a', who: 'max', x: 0 } },
        { at: [1, 1], enter: { id: 'b', who: 'girl', x: 3 } },
        { at: [1, 2], move: { dx: -2 }, over: 1, on: 'a' },
      ],
    }`);
    const host = new ShowHost(fakeCanvas(), show);
    host.seek(2);
    expect(host.stage.get('a').design['view.yaw']).toBeCloseTo(-0.38, 2);
    // and an author's own `set` wins over the automatic turn
    const turned = parseShow(`{
      title: 'set', bpm: 60,
      events: [
        { at: [1, 1], enter: { id: 'a', who: 'max', x: 0 } },
        { at: [1, 1], enter: { id: 'b', who: 'girl', x: 3 } },
        { at: [1, 2], look: 'b', on: 'a' },
        { at: [1, 3], set: 'view.yaw', to: 0.2, on: 'a' },
      ],
    }`);
    const other = new ShowHost(fakeCanvas(), turned);
    other.seek(4);
    for (let i = 0; i < 20; i++) other.tick(1 / 60);
    expect(other.stage.get('a').design['view.yaw']).toBeCloseTo(0.2, 1);
  });

  it('draws the trace’s depth: a near figure bigger and higher than a far one', () => {
    const lab = compileTrace(parseTrace(labJson));
    const host = new ShowHost(fakeCanvas(960, 600), lab);
    host.seek(1.2); // after every enter, before the first camera move
    host.tick(1 / 60);
    expect(host.stage.member('ada').z).toBe(-1.2);
    expect(host.stage.member('otto').z).toBe(3.7);
    const near = host.actorBox('ada')!;
    const far = host.actorBox('otto')!;
    // Designs differ in build, so compare the unit they are drawn at: box
    // height over the design's own height. maxcot's scale is 1/(1 + z*0.25),
    // so the near one is drawn at 1.33 against 0.71 - about 1.9x.
    const unitOf = (id: string, h: number) => h / (2 * (host.stage.get(id).design['body.h'] ?? 1));
    expect(unitOf('ada', near.h)).toBeGreaterThan(unitOf('otto', far.h) * 1.5);
    // and the stage lifts a far member by z*unit*0.12: its feet are higher
    expect(far.y + far.h).toBeLessThan(near.y + near.h);
  });
});
