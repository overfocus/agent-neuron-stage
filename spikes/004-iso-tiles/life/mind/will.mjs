// The will of one character: it hears every drive's level and says what the
// character means to do. A `serve` neuron with no outgoing links, so its answers
// are the network's result. It answers only when the intention changes.
//
//   node will.mjs [friend=<id>] [trait=value ...]
//
// The answer is a cue in the stage's own vocabulary (`say`, `pose`) plus what
// the body is to do and why:
//   { intent, who?, to?, why: { drive, level }, say, pose }
//
// An intention holds until its drive falls well below where it started
// (hysteresis), or a more urgent one starts: a frightened character flees
// before it eats, and one with a grudge and a temper confronts before it seeks company.
import { serve, traits } from './serve.mjs';

const T = { friend: '', ...traits(process.argv.slice(2)) };
const lv = {};
const about = {};
let now = { intent: 'idle' };
let said = 0;

/** In order of urgency: the drive, the level that starts it, the level that ends it. */
const RULES = [
  { intent: 'flee', drive: 'fear', on: 0.6, off: 0.35 },
  { intent: 'confront', drive: 'anger', on: 0.6, off: 0.3, need: () => (lv.resentment ?? 0) >= 0.3 && about.resentment },
  { intent: 'eat', drive: 'hunger', on: 0.65, off: 0.25 },
  { intent: 'seek', drive: 'loneliness', on: 0.6, off: 0.3 },
  { intent: 'sulk', drive: 'anger', on: 0.7, off: 0.4 },
  { intent: 'go', drive: 'desire', on: 0.65, off: 0.2 },
  { intent: 'celebrate', drive: 'happiness', on: 0.8, off: 0.65 },
  { intent: 'mope', drive: 'happiness', on: 0.2, off: 0.3, below: true }
];

const LINES = {
  flee: [['Not here. Not now.', 'feel-terrified'], ['I have to get away.', 'recoil'], ['No, no, no.', 'feel-terrified']],
  confront: [['We need to talk. Now.', 'point-you'], ['You did this.', 'fists'], ['I have not forgotten.', 'point-you']],
  eat: [['I could eat a table.', 'rest'], ['Food first. Then everything else.', 'rest']],
  seek: [['Where is everyone?', 'rest'], ['I could use some company.', 'rest']],
  sulk: [['Leave me alone.', 'feel-angry'], ['Everything is wrong today.', 'fedup']],
  go: [['I need to be somewhere.', 'rest'], ['There is a place I keep thinking about.', 'rest']],
  celebrate: [['What a day!', 'cheer'], ['I feel wonderful.', 'feel-happy']],
  mope: [['What is the point.', 'feel-sad'], ['Nothing tastes of anything.', 'feel-sad']],
  idle: [['', 'rest']]
};

function fits(r) {
  if (lv[r.drive] === undefined) return false; // a drive not heard from yet is not at zero, it is unknown
  const v = lv[r.drive];
  const held = now.intent === r.intent;
  const edge = held ? r.off : r.on;
  const ok = r.below ? v <= edge : v >= edge;
  return ok && (!r.need || r.need());
}

function choose() {
  for (const r of RULES) if (fits(r)) return r;
  return null;
}

serve((p) => {
  if (!p || typeof p !== 'object' || typeof p.drive !== 'string' || typeof p.level !== 'number') return undefined;
  lv[p.drive] = p.level;
  about[p.drive] = typeof p.about === 'string' ? p.about : null;
  const r = choose();
  const next = { intent: r ? r.intent : 'idle' };
  if (next.intent === 'confront') next.who = about.resentment;
  if (next.intent === 'flee' && about.fear) next.from = about.fear;
  if (next.intent === 'seek' && T.friend) next.who = String(T.friend);
  if (next.intent === 'go' && about.desire) next.to = about.desire;
  if (next.intent === now.intent && next.who === now.who && next.to === now.to && next.from === now.from) return undefined;
  now = next;
  const lines = LINES[next.intent];
  const [say, pose] = lines[said++ % lines.length];
  const out = { ...next, why: { drive: r ? r.drive : 'none', level: r ? lv[r.drive] : 0 }, pose };
  if (say) out.say = say;
  return out;
});
