import { describe, expect, it } from 'vitest';
import { POSES } from 'maxcot';
import { compileTrace, cueOf, clip } from '../src/fromtrace.ts';
import { COMMANDS } from '../src/show.ts';
import { parseTrace } from '../src/trace.ts';
import duetJson from '../src/traces/duet.json';
import alertsJson from '../src/traces/alerts.json';

const duet = parseTrace(duetJson);
const alerts = parseTrace(alertsJson);

/** A trace of one source into one composed character, made up for a case. */
function small(events: unknown[], neurons?: unknown[], links?: unknown[]) {
  return parseTrace({
    format: 'agent-neuron-trace',
    version: 1,
    demo: 'made up',
    neurons: neurons ?? [
      { id: 'cue', kind: 'source' },
      { id: 'max', kind: 'composed' }
    ],
    links: links ?? [{ from: 'cue', to: 'max' }],
    events
  });
}

const commands = (show: ReturnType<typeof compileTrace>, cmd: string) =>
  show.events.filter((e) => e[cmd] !== undefined).map((e) => ({ at: e.at, value: e[cmd], on: e.on }));

describe('compileTrace', () => {
  it('makes a show of the cast and the run', () => {
    const show = compileTrace(duet);
    expect(show.title).toBe('duet');
    expect(show.actors.map((a) => a.id)).toEqual(['cue', 'max', 'kid']);
    expect(show.events.length).toBeGreaterThan(20);
    expect(show.skin).toBe('pencil');
  });

  it('compiles the same trace to the same show', () => {
    expect(JSON.stringify(compileTrace(duet))).toBe(JSON.stringify(compileTrace(duet)));
  });

  it('is linear in time: the run starts one bar in, and later is later', () => {
    const show = compileTrace(duet, { bpm: 100, leadInBeats: 4 });
    const first = show.events.find((e) => e.look !== undefined)!;
    expect(first.at).toEqual([2, 1]); // t=0 at 100 bpm, after one bar of entrances
    const beats = show.events.map((e) => (e.at[0] - 1) * 4 + (e.at[1] - 1));
    expect(beats).toEqual([...beats].sort((a, b) => a - b));
  });

  it('walks the cast on before the run, with the manner its kind earns', () => {
    const show = compileTrace(duet);
    const enter = commands(show, 'enter');
    const manner = commands(show, 'manner');
    expect(enter.map((e) => (e.value as { id: string }).id)).toEqual(['cue', 'max', 'kid']);
    expect(enter.every((e) => e.at[0] === 1)).toBe(true);
    expect(manner).toHaveLength(3);
    expect((manner[1]!.value as { idle: string }).idle).toBe('sway');
  });

  it('turns an answer into a face and a line', () => {
    const show = compileTrace(duet);
    const said = commands(show, 'say').map((s) => s.value);
    expect(said).toContain('The tide kept me.');
    expect(said).toContain("You're late."); // the cue's own line, spoken by the source
    const poses = commands(show, 'pose').map((p) => p.value as string);
    expect(poses).toContain('deal'); // max's cue
    expect(poses).toContain('feel-sulking');
  });

  it('makes a dropped line a refusal, not a silence', () => {
    const show = compileTrace(duet);
    const drops = duet.events.filter((e) => e.type === 'drop');
    expect(drops.length).toBeGreaterThan(0);
    for (const drop of drops) {
      const refused = show.events.filter((e) => e.pose === 'dunno' && e.on === drop.neuron);
      expect(refused, `a refusal from ${drop.neuron}`).not.toHaveLength(0);
    }
    // and a drop on its own is exactly one refusal, on the neuron that refused
    const one = compileTrace(
      small([
        { t: 0, type: 'signal', id: '1', from: 'max', to: ['cue'], hops: 4 },
        { t: 5, type: 'drop', id: '1', from: 'max', to: ['cue'], neuron: 'cue', reason: 'hops' }
      ])
    );
    const refusals = one.events.filter((e) => e.pose === 'dunno');
    expect(refusals).toHaveLength(1);
    expect(refusals[0]!.on).toBe('cue');
  });

  it('only ever emits a pose the rig has, a command the stage knows, and an actor it has', () => {
    for (const trace of [duet, alerts]) {
      const show = compileTrace(trace);
      const ids = new Set(show.actors.map((a) => a.id));
      for (const e of show.events) {
        for (const [cmd, value] of Object.entries(e)) {
          if (cmd === 'at' || cmd === 'on') continue; // modifiers qualify a command
          expect(COMMANDS as readonly string[]).toContain(cmd);
          if (cmd === 'pose') expect(POSES).toHaveProperty(value as string);
          if (cmd === 'look' || cmd === 'shot' || cmd === 'manner') {
            if (cmd === 'look') expect(ids.has(value as string)).toBe(true);
          }
          if (e.on && typeof e.on === 'string') expect(ids.has(e.on)).toBe(true);
          if (cmd === 'enter') expect(ids.has((value as { id: string }).id)).toBe(true);
        }
      }
    }
  });

  it('ends on the last moment of the run with a card', () => {
    const show = compileTrace(duet);
    const end = show.events[show.events.length - 1]!;
    expect(end.end).toEqual({ card: 'logo', text: 'DUET' });
    expect(show.tail).toBeGreaterThan(0);
  });

  it('moves the camera for the characters in a line, but not every beat', () => {
    const show = compileTrace(duet);
    const shots = commands(show, 'shot');
    expect(shots.length).toBeGreaterThan(1);
    const framed = shots.filter((s) => s.value !== 'wide' || s.on);
    for (let i = 1; i < framed.length; i++) {
      const a = framed[i - 1]!.at;
      const b = framed[i]!.at;
      const gap = (b[0] - a[0]) * 4 + (b[1] - a[1]);
      expect(gap).toBeGreaterThanOrEqual(2 - 1e-9);
    }
    // two characters talking share one frame
    expect(shots.some((s) => Array.isArray(s.on) && s.on.length === 2)).toBe(true);
    // and the show ends wide, before the card
    expect(shots[shots.length - 1]!.value).toBe('wide');
  });

  it('compiles a recording it did not make (the alert storm)', () => {
    const show = compileTrace(alerts);
    expect(show.actors).toHaveLength(6);
    expect(show.events.length).toBeGreaterThan(100);
    expect(show.title).toBe('alerts');
  });
});

describe('cueOf: a payload may direct its own performance', () => {
  const ids = new Map(compileTrace(duet).actors.map((a) => [a.id, a]));

  it('reads say, pose, look, shot, skin and palette', () => {
    const cue = cueOf({ stage: { say: 'a line', pose: 'wave', look: 'kid', shot: 'close', skin: 'riso', palette: 'red' } }, ids);
    expect(cue).toEqual({ say: 'a line', pose: 'wave', look: 'kid', shot: 'close', skin: 'riso', palette: 'red' });
  });

  it('reads the same fields flat, so a program need not nest them', () => {
    expect(cueOf({ say: 'a line', pose: 'deal' }, ids)).toEqual({ say: 'a line', pose: 'deal' });
  });

  it('ignores anything else: a payload is data, not a script', () => {
    expect(cueOf({ pose: 'no-such-pose', look: 'nobody', shot: 'crane', skin: 'no-such-skin' }, ids)).toEqual({});
    expect(cueOf('just a line', ids)).toEqual({});
    expect(cueOf([1, 2, 3], ids)).toEqual({});
  });

  it('lets the stage read a line off any payload, cut to one caption', () => {
    expect(clip('a\n long\tline ')).toBe('a long line');
    expect(clip('x'.repeat(400)).length).toBe(160);
  });
});

describe('a character is a network', () => {
  it('draws a composed neuron as one body, with the answer the inside gave', () => {
    const trace = small([
      { t: 0, type: 'signal', id: '1', from: 'cue', to: ['max'], payload: { type: 'text', text: 'a line' } },
      {
        t: 100,
        type: 'answer',
        id: '2',
        from: 'max',
        to: ['cue'],
        replyTo: '1',
        hops: 1,
        payload: { type: 'json', data: { say: 'an answer', pose: 'pleased' } }
      }
    ]);
    const show = compileTrace(trace);
    expect(show.actors).toHaveLength(2);
    expect(commands(show, 'say').map((s) => s.value)).toEqual(['a line', 'an answer']);
    expect(commands(show, 'pose')[0]!.value).toBe('pleased');
    // the source's line makes the character turn to it
    expect(commands(show, 'look')[0]).toMatchObject({ value: 'cue', on: 'max' });
  });

  it('shows a quiet answer as a shrug and a failure as a face', () => {
    const show = compileTrace(
      small([
        { t: 0, type: 'quiet', id: '1', from: 'max', to: ['cue'] },
        { t: 50, type: 'error', id: '2', from: 'max', to: ['cue'], neuron: 'max', message: 'boom', code: 'exit' },
        { t: 60, type: 'unknown', id: '3', from: 'max', to: ['cue'], neuron: 'max', message: 'gone' }
      ])
    );
    const poses = show.events.filter((e) => e.pose).map((e) => e.pose);
    expect(poses).toEqual(['mouth-shut', 'shrug', 'eyes-furious', 'eyes-terrified']);
  });
});
