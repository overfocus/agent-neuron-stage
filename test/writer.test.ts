import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import scene from '../examples/writer/scene.score?raw';
import { parseShow } from '../src/fromscore.ts';
import { COMMANDS } from '../src/show.ts';
import { hasPose } from '../src/fromtrace.ts';

const brief = { who: 'the neighbour', about: 'a letter that came back', title: 'the letter' };

describe('the writer example: a network answers with a scene', () => {
  it('plays what the writer answered: two characters who were not there before', () => {
    const show = parseShow(scene);
    expect(show.title).toBe('the letter');
    expect(show.bpm).toBe(92);
    expect(show.actors.map((a) => [a.id, a.who])).toEqual([
      ['her', 'girl'],
      ['him', 'oldman']
    ]);
    expect(show.events.length).toBeGreaterThan(15);
    expect(show.skin).toBe('riso'); // the style the scene turns into
  });

  it('answered exactly this file, from exactly this brief', () => {
    const answer = execFileSync('node', ['examples/writer/write.mjs'], {
      input: JSON.stringify(brief),
      encoding: 'utf8'
    });
    const fromProgram = parseShow(answer);
    const fromFile = parseShow(scene);
    expect(fromProgram.events).toEqual(fromFile.events);
    expect(fromProgram.actors).toEqual(fromFile.actors);
    expect(fromProgram.bpm).toBe(fromFile.bpm);
  });

  it('writes only commands and poses the stage can draw', () => {
    const show = parseShow(scene);
    for (const event of show.events) {
      for (const [cmd, value] of Object.entries(event)) {
        if (cmd === 'at' || cmd === 'on' || cmd === 'to' || cmd === 'from' || cmd === 'palette') continue;
        expect(COMMANDS as readonly string[]).toContain(cmd);
        if (cmd === 'pose') expect(hasPose(value as string)).toBe(true);
        if (cmd === 'style') expect(typeof value).toBe('string');
      }
    }
  });
});
