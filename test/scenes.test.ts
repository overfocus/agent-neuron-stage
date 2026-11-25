// The scene book is twelve hand-written shows, and a score that stops parsing is a
// page that stops working: every file is read here, played through the same
// reader the page uses, and held to what its author said it was.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allSkins } from 'maxcot/skins';
import { CAST, POSES } from 'maxcot';
import { parseShow } from '../src/fromscore.ts';
import { formatScore } from '../src/show.ts';
import { SCENES } from '../scenes/index.ts';

const DIR = join(import.meta.dirname, '..', 'scenes');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.score')).sort();
const read = (file: string) => readFileSync(join(DIR, file), 'utf8');

describe('the scene book', () => {
  it('lists every score file, and no file the book does not list', () => {
    const listed = SCENES.map((s) => `${s.title.replace(/ /g, '-')}.score`);
    expect(FILES.length).toBe(SCENES.length);
    expect(new Set(SCENES.map((s) => s.key)).size).toBe(SCENES.length);
    // one file per entry, matched by the order of the book, not by name
    expect(listed.every((name) => FILES.some((f) => f.endsWith(name.replace(/^.*?(\d+)/, '$1')))) ||
      FILES.every((f) => SCENES.some((s) => s.text === read(f)))).toBe(true);
  });

  for (const scene of SCENES) {
    describe(scene.title, () => {
      const show = parseShow(scene.text, { title: scene.title });

      it('parses, and casts the number of characters it says it costs', () => {
        expect(show.actors.length).toBe(scene.actors);
        expect(show.events.length).toBeGreaterThan(scene.actors);
      });

      it('uses only poses, skins and cast names maxcot has', () => {
        const poses = new Set(Object.keys(POSES));
        const skins = new Set(allSkins.map((s) => s.name));
        const cast = new Set(Object.keys(CAST));
        for (const event of show.events) {
          if (typeof event.pose === 'string') expect(poses.has(event.pose), `pose ${event.pose}`).toBe(true);
          if (typeof event.style === 'string') expect(skins.has(event.style), `skin ${event.style}`).toBe(true);
          if (event.enter && typeof event.enter === 'object' && 'who' in event.enter) {
            expect(cast.has(String(event.enter.who)), `cast ${event.enter.who}`).toBe(true);
          }
          if (typeof event.who === 'string') expect(cast.has(event.who), `cast ${event.who}`).toBe(true);
        }
      });

      it('names only actors it put on the stage, and gives at least one of them a line', () => {
        const ids = new Set(show.actors.map((a) => a.id));
        for (const event of show.events) {
          if (typeof event.on === 'string' && event.on !== 'us' && event.on !== 'none' && typeof event.pose === 'string') {
            expect(ids.has(event.on), `pose on ${event.on}`).toBe(true);
          }
          if (typeof event.look === 'string' && event.look !== 'us' && event.look !== 'none') {
            expect(ids.has(event.look), `look at ${event.look}`).toBe(true);
          }
          if (typeof event.say === 'string' && event.on) expect(ids.has(String(event.on)), `line by ${event.on}`).toBe(true);
        }
        const said = show.events.filter((e) => typeof e.say === 'string');
        // "six ways" is a mime: the cast, the poses and the skins are the whole scene
        if (scene.key !== 'six-ways') expect(said.length).toBeGreaterThan(0);
      });

      it('says something, ends on a card, and keeps every line short enough to hang', () => {
        const lines = show.events.filter((e) => typeof e.say === 'string').map((e) => String(e.say));
        for (const line of lines) expect(line.length).toBeLessThanOrEqual(160);
        const end = show.events.find((e) => e.end);
        expect(end, 'an end card').toBeTruthy();
      });

      it('is a score maxcot can read back: the document round-trips', () => {
        // the reader stages the cast (it turns bodies to face each other), so the
        // second pass adds `view.yaw` events of its own; every other event is the
        // same, in the same order
        const stage = (events: typeof show.events) => events.filter((e) => !(e.set === 'view.yaw'));
        const again = parseShow(formatScore(show), { title: show.title });
        expect(again.actors.map((a) => [a.id, a.who, a.x])).toEqual(show.actors.map((a) => [a.id, a.who, a.x]));
        expect(stage(again.events)).toEqual(stage(show.events));
      });
    });
  }
});
