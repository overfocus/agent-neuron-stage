// The troupe is the network door: six characters, six neurons, one run. What
// the compiler makes of its trace is a scene in six hands - a cast that could
// not have come out of one skin, which is the point of examples/troupe.
import { describe, expect, it } from 'vitest';
import troupeJson from '../src/traces/troupe.json';
import { parseTrace } from '../src/trace.ts';
import { compileTrace } from '../src/fromtrace.ts';
import { formatScore } from '../src/show.ts';
import { parseShow } from '../src/fromscore.ts';

const trace = parseTrace(troupeJson);
const show = compileTrace(trace);

describe('the troupe', () => {
  it('casts one actor per neuron, each with its own skin', () => {
    // the cue is a character too - it speaks first, and in the show's own skin
    expect(show.actors.map((a) => a.id).sort()).toEqual(['ann', 'bo', 'cue', 'cy', 'di', 'ed', 'fay']);
    expect(show.actors.filter((a) => a.style).map((a) => a.style).sort()).toEqual([
      'gigposter', 'inkpunch', 'manga', 'neon', 'riso', 'sketch'
    ]);
  });

  it('gives a look to the character that answered, never to the whole cast', () => {
    const styles = show.events.filter((e) => typeof e.style === 'string');
    expect(styles.length).toBeGreaterThanOrEqual(6);
    for (const event of styles) expect(typeof event.on, 'every style in a network scene names its actor').toBe('string');
  });

  it('gives every character its line and a face to say it with', () => {
    const said = show.events.filter((e) => typeof e.say === 'string');
    expect(new Set(said.map((e) => e.on)).size).toBe(7); // the cue speaks first, in the show's own skin
    // a line and its pose are separate events on the same beat, as a trace compiles
    const posed = new Set(
      show.events.filter((e) => typeof e.pose === 'string' && typeof e.on === 'string').map((e) => e.on as string)
    );
    for (const id of ['ann', 'bo', 'cy', 'di', 'ed', 'fay']) expect(posed.has(id), `a pose for ${id}`).toBe(true);
  });

  it('survives the score round trip with its looks intact', () => {
    const again = parseShow(formatScore(show), { title: show.title });
    expect(again.actors.map((a) => a.style).sort()).toEqual(show.actors.map((a) => a.style).sort());
  });
});
