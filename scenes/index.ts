// The scene book: hand-written scores, one file each, in the order the page
// offers them. A scene is a whole show - its cast, its blocking, its lines, its
// look and its card - so the only way in is `enter` and `create` in the score
// itself, exactly as a network file declares its neurons.
//
// `actors` is what the author meant the scene to cost: the page reads it for the
// list, and test/scenes.test.ts holds every file to it, so a scene cannot grow or
// lose a character without the number being changed on purpose.
import one from './01-one.score?raw';
import duel from './02-duel.score?raw';
import eight from './03-eight.score?raw';
import noir from './04-noir.score?raw';
import party from './05-party.score?raw';
import sixWays from './06-six-ways.score?raw';
import argument from './07-argument.score?raw';
import goodnight from './08-goodnight.score?raw';
import unit from './09-unit.score?raw';
import theWall from './10-the-wall.score?raw';

export interface SceneEntry {
  /** The value in the page's list. */
  key: string;
  title: string;
  /** One line, for the list and the page's meta. */
  note: string;
  actors: number;
  text: string;
}

export const SCENES: SceneEntry[] = [
  { key: 'one', title: 'one', note: 'a solo in graphite, one camera, one sentence', actors: 1, text: one },
  { key: 'duel', title: 'duel', note: 'two of them in manga, a close-up per shout', actors: 2, text: duel },
  { key: 'eight', title: 'eight', note: 'the whole cast in teletext, a beat each', actors: 8, text: eight },
  { key: 'noir', title: 'noir', note: 'two and a letter, in ink, at a murmur', actors: 2, text: noir },
  { key: 'party', title: 'party', note: 'four of them screen-printed, all talking at once', actors: 4, text: party },
  { key: 'six-ways', title: 'six ways', note: 'six of them, the same six drawn six ways, no line at all', actors: 6, text: sixWays },
  { key: 'argument', title: 'argument', note: 'three in a red beam, cutting on the beat', actors: 3, text: argument },
  { key: 'goodnight', title: 'goodnight', note: 'two at the speed of someone falling asleep', actors: 2, text: goodnight },
  { key: 'unit', title: 'unit', note: 'five machines on an oscilloscope, heavy and still', actors: 5, text: unit },
  { key: 'the-wall', title: 'the wall', note: 'seven in stencil, one word, then quiet', actors: 7, text: theWall }
];
