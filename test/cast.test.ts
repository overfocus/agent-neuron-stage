import { describe, expect, it } from 'vitest';
import { CAST } from 'maxcot';
import { castOf, hash, whoOf } from '../src/cast.ts';
import { parseTrace } from '../src/trace.ts';
import duetJson from '../src/traces/duet.json';

const trace = parseTrace(duetJson);

describe('castOf', () => {
  it('gives every neuron an actor, and the same one twice', () => {
    const a = castOf(trace);
    const b = castOf(trace);
    expect(a.map((x) => x.id)).toEqual(['cue', 'max', 'kid']);
    expect(a).toEqual(b);
  });

  it('lays the cast out by how far a neuron is from the beginning', () => {
    const actors = castOf(trace);
    const x = Object.fromEntries(actors.map((a) => [a.id, a.x]));
    // cue -> max and cue -> kid, so the two characters stand together, one step on.
    expect(x.cue!).toBeLessThan(x.max!);
    expect(x.max!).toBeLessThan(x.kid!);
    expect(x.kid! - x.cue!).toBeGreaterThan(2);
  });

  it('carries a kind as a manner: a source is light, a character is not', () => {
    const actors = castOf(trace);
    const cue = actors.find((a) => a.id === 'cue')!;
    const kid = actors.find((a) => a.id === 'kid')!;
    expect(cue.kind).toBe('source');
    expect(kid.kind).toBe('composed');
    expect(kid.weight).toBeGreaterThan(cue.weight);
    expect(cue.idle).toBe('sway');
  });

  it('puts a threshold neuron lower and heavier: it waits for a group', () => {
    const t = parseTrace({
      format: 'agent-neuron-trace',
      version: 1,
      demo: 'join',
      neurons: [
        { id: 'a', kind: 'run' },
        { id: 'b', kind: 'run' },
        { id: 'join', kind: 'run', options: { threshold: 2 } }
      ],
      links: [
        { from: 'a', to: 'join' },
        { from: 'b', to: 'join' }
      ],
      events: []
    });
    const actors = castOf(t);
    const join = actors.find((a) => a.id === 'join')!;
    const run = actors.find((a) => a.id === 'a')!;
    expect(join.weight).toBeGreaterThan(run.weight);
    expect(join.x).toBeGreaterThan(run.x);
  });

  it('survives a cycle in the links', () => {
    const t = parseTrace({
      format: 'agent-neuron-trace',
      version: 1,
      demo: 'loop',
      neurons: [
        { id: 'a', kind: 'run' },
        { id: 'b', kind: 'run' }
      ],
      links: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' }
      ],
      events: []
    });
    expect(castOf(t)).toHaveLength(2);
  });

  it('takes a pinned actor and a pinned place', () => {
    const actors = castOf(trace, { who: { max: 'boss' }, x: { max: 0.5 } });
    expect(actors.find((a) => a.id === 'max')?.who).toBe('boss');
    expect(actors.find((a) => a.id === 'max')?.x).toBe(0.5);
  });
});

describe('whoOf', () => {
  it('uses a name maxcot already has, or a plain alias', () => {
    expect(whoOf('max')).toBe('max');
    expect(whoOf('kid')).toBe('kid'); // maxcot keeps kid as a name for child
    expect(whoOf('boy')).toBe('child');
    expect(whoOf('boss')).toBe('boss');
  });

  it('gives any other id a stable face from maxcot cast', () => {
    const who = whoOf('hypothesis');
    expect(Object.keys(CAST)).toContain(who);
    expect(whoOf('hypothesis')).toBe(who);
    expect(hash('hypothesis')).toBe(hash('hypothesis'));
  });
});
