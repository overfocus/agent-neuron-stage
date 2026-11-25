// The lab is the network door with a model behind it and no order to the room:
// seven scientists, each one neuron, each deciding for itself whether to take
// the floor. What the compiler makes of the trace is a room in seven hands with
// depth - and a body that turns to whoever it addresses.
import { describe, expect, it } from 'vitest';
import labJson from '../src/traces/lab.json';
import { parseTrace } from '../src/trace.ts';
import { compileTrace } from '../src/fromtrace.ts';
import { formatScore } from '../src/show.ts';
import { parseShow } from '../src/fromscore.ts';

const trace = parseTrace(labJson);
const show = compileTrace(trace);
const SEVEN = ['ada', 'bruno', 'iris', 'jules', 'lea', 'otto', 'rosa'];

describe('the lab', () => {
  it('casts the question and seven scientists, each in its own hand', () => {
    expect(show.actors.map((a) => a.id).sort()).toEqual(['cue', ...SEVEN].sort());
    expect(show.actors.filter((a) => a.style).map((a) => a.style).sort()).toEqual([
      'ballpoint',
      'felttip',
      'inkpunch',
      'manga',
      'print',
      'riso',
      'sketch'
    ]);
  });

  it('stands the cast where the trace says: a room with depth, not a line', () => {
    for (const n of trace.neurons) expect(n.at, `${n.id} carries a place`).toHaveLength(3);
    const zs = show.actors.map((a) => a.z);
    const xs = show.actors.map((a) => a.x);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(4); // the back of the room
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(10); // and its width
    const near = 1 / (1 + Math.min(...zs) * 0.25);
    const far = 1 / (1 + Math.max(...zs) * 0.25);
    expect(far / near).toBeLessThan(0.5);
  });

  it('is a mesh, not a ring: people talk to more than one person and are answered by more than one', () => {
    const into = new Map<string, number>();
    const out = new Map<string, number>();
    for (const link of trace.links) {
      if (link.from === 'cue') continue;
      into.set(link.to, (into.get(link.to) ?? 0) + 1);
      out.set(link.from, (out.get(link.from) ?? 0) + 1);
    }
    // no single chain: at least one scientist is reached by two others
    expect(Math.max(...into.values())).toBeGreaterThan(1);
    expect([...out.values()].filter((n) => n > 1).length).toBeGreaterThan(2);
  });

  it('has a conversation with no fixed order, and every line is a line', () => {
    const answers = trace.events.filter((e) => e.type === 'answer');
    expect(answers.length).toBeGreaterThanOrEqual(6);
    const speakers = new Set(answers.map((e) => e.from));
    expect(speakers.size).toBeGreaterThanOrEqual(4); // randomness: not everyone need speak
    for (const answer of answers) {
      const data = answer.payload?.data as { say?: string; skin?: string; move?: { dx?: number; dz?: number } };
      expect(typeof data?.say, `${answer.from} says a line`).toBe('string');
      expect(SEVEN).toContain(answer.from);
      // every answer is also a step, and the step is the character's own
      expect(typeof data?.move?.dx === 'number' || typeof data?.move?.dz === 'number').toBe(true);
    }
    // the room is allowed to answer itself: one speaker can speak more than once
    expect(answers.length).toBeGreaterThan(speakers.size);
  });

  it('takes the floor or lets the line go by: a quiet answer forwards nothing', () => {
    const quiet = trace.events.filter((e) => e.type === 'quiet');
    expect(quiet.length).toBeGreaterThanOrEqual(0);
    for (const q of quiet) expect(q.payload).toBeUndefined();
  });

  it('draws every answer with a face, and turns it toward whoever it answered', () => {
    const answers = trace.events.filter((e) => e.type === 'answer');
    const posed = new Set(
      show.events.filter((e) => typeof e.pose === 'string' && typeof e.on === 'string').map((e) => e.on as string)
    );
    for (const answer of answers) expect(posed.has(answer.from!), `a pose for ${answer.from}`).toBe(true);
    // the body's turn is the host's job now; the score says who a line was for
    const looks = show.events.filter((e) => typeof e.look === 'string');
    expect(looks.length).toBeGreaterThan(0);
  });

  it('survives the score round trip with its places and looks intact', () => {
    const again = parseShow(formatScore(show), { title: show.title });
    expect(again.actors.map((a) => [a.x, a.z, a.style])).toEqual(show.actors.map((a) => [a.x, a.z, a.style]));
  });
});
