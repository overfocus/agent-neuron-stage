// The riemann table is the network door with a model behind it: seven
// mathematicians, each one neuron, each answering the line before with its own
// voice, and each standing where the network file puts it. What the compiler
// makes of the trace is a room in seven skins, with depth: a nearer figure is
// larger, a farther one smaller and higher, because `z` is the stage's depth.
import { describe, expect, it } from 'vitest';
import riemannJson from '../src/traces/riemann.json';
import { parseTrace } from '../src/trace.ts';
import { compileTrace } from '../src/fromtrace.ts';
import { formatScore } from '../src/show.ts';
import { parseShow } from '../src/fromscore.ts';

const trace = parseTrace(riemannJson);
const show = compileTrace(trace);

/** The chain's order in the network: cue -> ada -> rosa -> ... -> jules -> ada. */
const ORDER = ['ada', 'rosa', 'bruno', 'iris', 'otto', 'lea', 'jules'];

describe('the riemann table', () => {
  it('casts the question and seven mathematicians, each in its own hand', () => {
    expect(show.actors.map((a) => a.id).sort()).toEqual(['cue', ...ORDER].sort());
    // seven distinct looks: a table of seven hands, not one cast in one skin
    expect(show.actors.filter((a) => a.style).map((a) => a.style).sort()).toEqual([
      'felttip',
      'inkpunch',
      'manga',
      'pixel',
      'riso',
      'sketch',
      'stencil'
    ]);
  });

  it('stands the cast where the trace says: a room with depth, not a line', () => {
    for (const n of trace.neurons) expect(n.at, `${n.id} carries a place`).toHaveLength(3);
    const zs = show.actors.map((a) => a.z);
    const xs = show.actors.map((a) => a.x);
    // at least a body and a half of depth, and a table wider than two bodies
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(8);
    // maxcot scales a member by 1/(1 + z*0.25): the deepest is much smaller
    const near = 1 / (1 + Math.min(...zs) * 0.25);
    const far = 1 / (1 + Math.max(...zs) * 0.25);
    expect(far / near).toBeLessThan(0.75);
  });

  it('runs the conversation in order, each turn answering the one before', () => {
    const answers = trace.events.filter((e) => e.type === 'answer');
    expect(answers.map((e) => e.from)).toEqual(ORDER);
    for (let i = 1; i < answers.length; i++) expect(answers[i]!.t).toBeGreaterThan(answers[i - 1]!.t);
    for (const e of answers) {
      const data = e.payload?.data as { say?: string } | undefined;
      expect(typeof data?.say, `${e.from} says a line`).toBe('string');
    }
    // and the last line is turned away at the hops limit: the table ends
    expect(trace.events.some((e) => e.type === 'drop' && e.reason === 'hops' && e.neuron === 'ada')).toBe(true);
  });

  it('draws every one of the seven with a line and a face', () => {
    const said = new Set(show.events.filter((e) => typeof e.say === 'string').map((e) => e.on));
    for (const id of ['cue', ...ORDER]) expect(said.has(id), `a line for ${id}`).toBe(true);
    const posed = new Set(
      show.events.filter((e) => typeof e.pose === 'string' && typeof e.on === 'string').map((e) => e.on as string)
    );
    for (const id of ORDER) expect(posed.has(id), `a pose for ${id}`).toBe(true);
  });

  it('survives the score round trip with its places and looks intact', () => {
    const again = parseShow(formatScore(show), { title: show.title });
    expect(again.actors.map((a) => [a.x, a.z, a.style])).toEqual(show.actors.map((a) => [a.x, a.z, a.style]));
  });
});
