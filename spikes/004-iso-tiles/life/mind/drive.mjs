// One drive of one character: hunger, loneliness, anger, resentment, fear,
// happiness or desire. A `serve` neuron, so it remembers: its level lives in
// this process between signals (DESIGN §9.5: a mind that keeps a grudge).
//
//   node drive.mjs <drive> [trait=value ...]
//
// It hears two kinds of signal:
//   a sense, injected by the stage   { sense: 'tick' | 'ate' | 'kind' | 'hurt' | 'scare' | 'vented' | 'apology', ... }
//   another drive's level            { drive, level, about? }   (along a link of the network)
//
// A sense may move the level; it answers `{ drive, level, about? }` when the
// level has moved enough to tell (or what it is about has changed), and is quiet
// otherwise. Another drive's level is only remembered, never answered, and
// weighs on the next tick: so a ring of drives that feed each other
// (anger ↔ resentment) settles instead of looping.
//
// The traits are the character: how fast it gets hungry, how hot its temper is,
// how long it holds a grudge, where it longs to be.
import { serve, traits } from './serve.mjs';

const drive = process.argv[2];
const T = {
  appetite: 1, // hunger per second
  need: 1, // how fast it gets lonely
  temper: 1, // how far a hurt or an empty stomach moves anger
  calm: 1, // how fast anger cools
  grudge: 1, // how much a hurt becomes a grudge
  forgive: 1, // how fast a grudge fades
  nerve: 1, // how far a fright moves fear (higher is more fearful)
  cheer: 0.6, // the happiness it drifts to when nothing is wrong
  longing: 1, // how fast desire grows
  place: '', // what it desires: one of the room's marks
  start: 0, // where the level starts
  ...traits(process.argv.slice(3))
};

const clamp = (v) => Math.max(0, Math.min(1, v));
let level = clamp(T.start || (drive === 'happiness' ? T.cheer : 0));
let about = drive === 'desire' && T.place ? String(T.place) : null;
/** resentment only: a grudge per person. The audience is a person too ('you'). */
const grudges = {};
/** the last level each other drive told us */
const felt = {};
let told = { level: -1, about: null };

function hurtBy(who, k) {
  if (typeof who !== 'string' || !who) return;
  grudges[who] = clamp((grudges[who] ?? 0) + k);
}

function tick(s) {
  const dt = Math.min(5, Math.max(0, Number(s.dt) || 0));
  const company = Array.isArray(s.company) ? s.company.filter((x) => typeof x === 'string') : [];
  switch (drive) {
    case 'hunger':
      level += dt * 0.004 * T.appetite;
      break;
    case 'loneliness':
      level += company.length ? -dt * 0.03 * Math.min(3, company.length) : dt * 0.009 * T.need;
      break;
    case 'anger': {
      const hungry = Math.max(0, (felt.hunger ?? 0) - 0.55); // hungry makes angry
      level += dt * (0.02 * hungry * T.temper + 0.006 * (felt.resentment ?? 0) * T.temper - 0.012 * T.calm);
      break;
    }
    case 'resentment': {
      // a grudge fades, slowly; it grows while angry and in the company of whoever it is against
      for (const who of Object.keys(grudges)) {
        grudges[who] *= Math.exp(-dt * 0.004 * T.forgive);
        if (company.includes(who)) grudges[who] = clamp(grudges[who] + dt * 0.01 * (felt.anger ?? 0) * T.grudge);
        if (grudges[who] < 0.01) delete grudges[who];
      }
      break;
    }
    case 'fear':
      level += dt * ((s.dark ? 0.006 * T.nerve : 0) - 0.015 - (company.length ? 0.01 : 0));
      break;
    case 'happiness': {
      const want =
        0.3 + 0.7 * T.cheer -
        0.6 * Math.max(0, (felt.hunger ?? 0) - 0.5) -
        0.45 * (felt.loneliness ?? 0) -
        0.5 * (felt.fear ?? 0) -
        0.4 * (felt.anger ?? 0) -
        0.25 * (felt.resentment ?? 0) -
        0.15 * (felt.desire ?? 0);
      level += (clamp(want) - level) * Math.min(1, dt * 0.06);
      break;
    }
    case 'desire':
      // it longs for its place, and being there satisfies it
      if (about && s.at === about) level -= dt * 0.06;
      else level += dt * 0.007 * T.longing;
      break;
  }
}

function sense(s) {
  switch (s.sense) {
    case 'tick':
      return tick(s);
    case 'ate':
      if (drive === 'hunger') level -= 0.75;
      if (drive === 'anger') level -= 0.1;
      if (drive === 'happiness') level += 0.1;
      return;
    case 'kind':
      if (drive === 'loneliness') level -= 0.25;
      if (drive === 'anger') level -= 0.1;
      if (drive === 'fear') level -= 0.1;
      if (drive === 'happiness') level += 0.15;
      if (drive === 'resentment' && typeof s.from === 'string' && grudges[s.from]) grudges[s.from] = clamp(grudges[s.from] - 0.08);
      return;
    case 'hurt':
      if (drive === 'anger') level += 0.35 * T.temper;
      if (drive === 'fear') level += 0.15 * T.nerve;
      if (drive === 'happiness') level -= 0.15;
      if (drive === 'loneliness') level += 0.05;
      if (drive === 'resentment') hurtBy(s.from, 0.3 * T.grudge);
      return;
    case 'scare':
      if (drive === 'fear') {
        level += 0.5 * T.nerve;
        if (typeof s.from === 'string') about = s.from;
      }
      if (drive === 'happiness') level -= 0.1;
      return;
    case 'vented':
      // it said it to their face: the anger goes, some of the grudge with it
      if (drive === 'anger') level -= 0.45;
      if (drive === 'resentment' && typeof s.at === 'string' && grudges[s.at]) grudges[s.at] = clamp(grudges[s.at] - 0.2);
      return;
    case 'apology':
      if (drive === 'resentment' && typeof s.from === 'string' && grudges[s.from]) grudges[s.from] *= 0.4;
      if (drive === 'anger') level -= 0.15;
      return;
  }
}

serve((p) => {
  if (!p || typeof p !== 'object') return undefined;
  if (typeof p.drive === 'string') {
    // another drive's level: remembered, weighs on the next tick, never answered
    if (typeof p.level === 'number') felt[p.drive] = p.level;
    return undefined;
  }
  if (typeof p.sense !== 'string') return undefined;
  sense(p);
  if (drive === 'resentment') {
    let top = null;
    for (const [who, v] of Object.entries(grudges)) if (!top || v > grudges[top]) top = who;
    level = top ? grudges[top] : 0;
    about = top;
  }
  if (drive === 'fear' && level < 0.05) about = null;
  level = clamp(level);
  if (Math.abs(level - told.level) < 0.02 && about === told.about) return undefined;
  told = { level, about };
  const out = { drive, level: Math.round(level * 1000) / 1000 };
  if (about) out.about = about;
  if (drive === 'resentment') out.grudges = Object.fromEntries(Object.entries(grudges).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
  return out;
});
