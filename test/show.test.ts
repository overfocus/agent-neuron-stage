import { describe, expect, it } from 'vitest';
import { parseScore } from 'maxcot/score';
import { compileTrace } from '../src/fromtrace.ts';
import { parseShow } from '../src/fromscore.ts';
import { beat, eventLine, formatScore, trim } from '../src/show.ts';
import { parseTrace } from '../src/trace.ts';
import duetJson from '../src/traces/duet.json';

const duet = parseTrace(duetJson);
const show = compileTrace(duet);

describe('formatScore', () => {
  it('writes a score maxcot reads back, event for event', () => {
    const text = formatScore(show, ['a test']);
    const back = parseScore(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.score.title).toBe(show.title);
    expect(back.score.bpm).toBe(show.bpm);
    expect(back.score.events).toHaveLength(show.events.length);
    for (let i = 0; i < show.events.length; i++) {
      expect(back.score.events[i]!.at).toEqual(show.events[i]!.at);
      expect(Object.keys(back.score.events[i]!)).toEqual(Object.keys(show.events[i]!));
    }
  });

  it('writes one event on one line, `at` first', () => {
    expect(eventLine({ at: [2, 1.5], pose: 'wave', on: 'max' })).toBe(`{ at: [2, 1.5], pose: "wave", on: "max" }`);
  });

  it('writes numbers the way a score wants them', () => {
    expect(trim(1)).toBe('1');
    expect(trim(1.5)).toBe('1.5');
    expect(trim(1 / 3)).toBe('0.3333');
    expect(trim(-0)).toBe('0');
    expect(beat([2, 3.25])).toBe('[2, 3.25]');
  });
});

describe('parseShow', () => {
  it('plays the score a trace compiled to, with the same cast', () => {
    const again = parseShow(formatScore(show));
    expect(again.actors.map((a) => a.id)).toEqual(['cue', 'max', 'kid']);
    expect(again.actors.map((a) => a.who)).toEqual(show.actors.map((a) => a.who));
    expect(again.actors[0]!.x).toBeCloseTo(show.actors[0]!.x, 3);
    expect(again.bpm).toBe(show.bpm);
  });

  it('reads maxcot score syntax: comments, unquoted keys, single quotes, trailing commas', () => {
    const again = parseShow(`{
      // a made-up score
      title: 'Two of them',
      bpm: 90,
      events: [
        { at: [1, 1], enter: { id: 'ann', who: 'girl', x: -1 } },
        { at: [1, 2], enter: 'bob', pose: 'wave' },
        { at: [2, 1], style: 'riso' },
        { at: [2, 2], say: 'hello', on: 'ann' },
      ],
    }`);
    expect(again.title).toBe('Two of them');
    expect(again.bpm).toBe(90);
    expect(again.skin).toBe('riso');
    expect(again.actors.map((a) => [a.id, a.who])).toEqual([
      ['ann', 'girl'],
      ['bob', 'bob']
    ]);
    expect(again.actors[0]!.x).toBe(-1);
    expect(again.actors[1]!.x).toBe(0); // the only one left to place, centred
  });

  it('reads a JSON score, which is what a network can answer with', () => {
    const again = parseShow(
      JSON.stringify({
        title: 'from a neuron',
        bpm: 120,
        events: [
          { at: [1, 1], enter: { id: 'one', who: 'boss' } },
          { at: [1, 2], pose: 'thinking', on: 'one' }
        ]
      })
    );
    expect(again.title).toBe('from a neuron');
    expect(again.actors).toHaveLength(1);
  });

  it('takes an actor off the stage when it exits', () => {
    const again = parseShow(`{ events: [ { at: [1, 1], enter: 'ann' }, { at: [2, 1], exit: 'ann' } ] }`);
    expect(again.actors).toHaveLength(0);
  });

  it('points at the line and column of a score it cannot read', () => {
    expect(() => parseShow('{\n  events: [\n    { at: [1, 1], pose: }\n  ]\n}')).toThrow(/line 3/);
  });
});
