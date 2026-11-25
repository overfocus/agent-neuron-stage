// fromtrace.ts: a trace is a script. This turns one into a show.
//
// The mapping, in four lines:
//   1. a neuron is an actor (cast.ts), and its kind is how it carries itself;
//   2. a signal is who looks at whom;
//   3. an answer is a line and a face, and a payload may direct its own
//      performance with a cue ({ say, pose, look, shot, skin });
//   4. quiet, drop, error and unknown are posture: the character who had
//      nothing to say, refused a line, or failed, does something with its body.
//
// Time is linear (t ms -> bars and beats at the show's tempo) and nothing is
// invented: the film is a recording, and a run that wants air waits for it.
import { POSES } from 'maxcot';
import { skinsByName } from 'maxcot/skins';
import type { ScoreEvent } from 'maxcot/score';
import { castOf, FACING, type CastOptions, type StageActor } from './cast.ts';
import { eventType, payloadLine, payloadValue, type Trace } from './trace.ts';
import type { Show } from './show.ts';

export interface CompileOptions extends CastOptions {
  title?: string;
  /** Beats per minute of the film. Default 100. */
  bpm?: number;
  beatsPerBar?: number;
  skin?: string;
  palette?: string;
  /** Beats of empty stage before the run starts. Default one bar. */
  leadInBeats?: number;
  /** Beats the end card holds after the last moment. Default 6. */
  tailBeats?: number;
  /** How far a character turns toward the one it addresses, in radians. Default 0.38 (the rig's own three-quarter turn). */
  facing?: number;
}

export type Framing = 'wide' | 'full' | 'medium' | 'close';
const FRAMINGS: Framing[] = ['wide', 'full', 'medium', 'close'];
const SKINS = skinsByName();

/** What an answer's payload may say about its own performance. */
export interface Cue {
  say?: string;
  pose?: string;
  look?: string;
  shot?: Framing;
  skin?: string;
  palette?: string;
}

/** What a character does about a dropped line, by reason (SPEC 7.2). */
const DROPPED: Record<string, string> = {
  replaced: 'fedup',
  expired: 'eyes-sleepy',
  hops: 'dunno'
};

export function compileTrace(trace: Trace, o: CompileOptions = {}): Show {
  const bpm = o.bpm ?? 100;
  const beatsPerBar = o.beatsPerBar ?? 4;
  const spb = 60 / bpm;
  const leadIn = o.leadInBeats ?? beatsPerBar;
  const tailBeats = o.tailBeats ?? 6;
  const title = o.title ?? trace.demo ?? 'a run';
  const skin = o.skin ?? 'pencil';
  const actors = castOf(trace, o);
  const byId = new Map<string, StageActor>(actors.map((a) => [a.id, a]));
  const events: ScoreEvent[] = [];

  const push = (at: [number, number], cmd: string, value: unknown, on?: string | string[]): void => {
    const e: ScoreEvent = { at };
    e[cmd] = value;
    if (on) e.on = on;
    events.push(e);
  };

  /** A run's millisecond is a beat of the film: t -> [bar, beat]. */
  const at = (ms: number): [number, number] => {
    const beats = leadIn + ms / 1000 / spb;
    let bar = Math.floor(beats / beatsPerBar) + 1;
    let beat = Math.round((beats - (bar - 1) * beatsPerBar + 1) * 1000) / 1000;
    if (beat >= beatsPerBar + 1) {
      bar += 1;
      beat = Math.round((beat - beatsPerBar) * 1000) / 1000;
    }
    return [bar, beat];
  };
  const absBeat = ([bar, beat]: [number, number]): number => (bar - 1) * beatsPerBar + (beat - 1);
  const kindOf = (id: string): string => byId.get(id)?.kind ?? 'run';

  // ── facing ──────────────────────────────────────────────────────────────
  // A figure's orientation is view.yaw (a design dial) plus twist: yaw > 0
  // faces screen-right (docs of spike 001). Every actor is born turned the same
  // way, so a cast only faces itself if the compiler turns each one toward the
  // people it can address.
  const facing = Math.max(-0.9, Math.min(0.9, o.facing ?? FACING));
  const faced = new Map<string, number>();
  const meanX = (xs: number[]): number | undefined => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
  /** Turn `id` toward `targetX`, once, and only when that is a different way round. */
  const faceAt = (id: string, targetX: number | undefined, when: [number, number]): void => {
    const actor = byId.get(id);
    if (!actor || targetX == null) return;
    const dir = Math.sign(targetX - actor.x);
    if (!dir) return;
    const yaw = Math.round(dir * facing * 1000) / 1000;
    if (faced.get(id) === yaw) return;
    faced.set(id, yaw);
    const event: ScoreEvent = { at: when, set: 'view.yaw', to: yaw, on: id };
    events.push(event);
  };
  /** Where an actor should face by default: the middle of the people it can reach. */
  const homeOf = (id: string): number | undefined => {
    const reach = trace.links.filter((l) => l.from === id && byId.has(l.to)).map((l) => byId.get(l.to)!.x);
    if (reach.length) return meanX(reach);
    const others = actors.filter((a) => a.id !== id).map((a) => a.x);
    return meanX(others);
  };

  // The cast walks on during the bar before the run, a quarter beat apart.
  actors.forEach((a, i) => {
    const beat = Math.min(beatsPerBar, 1 + i * 0.25);
    push([1, beat], 'enter', { id: a.id, who: a.who, x: round(a.x), z: round(a.z) });
    push([1, beat], 'manner', { weight: round(a.weight), idle: a.idle }, a.id);
    faceAt(a.id, homeOf(a.id), [1, beat]);
  });

  const speakerOf = new Map<string, string>();
  // An answer and the signal that forwards it land on one beat; the signal carries
  // the look (and is who the character is really addressing), so read it there.
  const forwarded = new Set<string>();
  const forwardTo = new Map<string, string>();
  for (const e of trace.events) {
    if (eventType(e) !== 'signal' || !e.from) continue;
    const key = `${e.t}|${e.from}`;
    forwarded.add(key);
    if (!forwardTo.has(key) && e.to[0]) forwardTo.set(key, e.to[0]);
  }
  const lastShot = { at: -99 };
  const isCharacter = (id: string): boolean => {
    const kind = kindOf(id);
    return kind === 'composed' || kind === 'human';
  };
  /** Move the camera: a pair of characters in one frame, or one, or the room.
   *  Not twice inside two beats, so the camera follows the scene, not every line. */
  const frame = (on: string | string[] | undefined, when: [number, number], framing: Framing): void => {
    const now = absBeat(when);
    if (now - lastShot.at < 2) return;
    if (on == null) {
      // the room: the camera takes everyone in again
      lastShot.at = now;
      push(when, 'shot', 'wide');
      return;
    }
    const characters = (Array.isArray(on) ? on : [on]).filter(isCharacter);
    if (!characters.length) return;
    lastShot.at = now;
    push(when, 'shot', framing, characters.length > 1 ? characters : characters[0]);
  };

  for (const e of trace.events) {
    const type = eventType(e);
    const when = at(e.t);
    const from = e.from;
    if (e.id && (from ?? e.neuron)) speakerOf.set(e.id, (from ?? e.neuron) as string);
    const spokeTo = e.replyTo ? speakerOf.get(e.replyTo) : undefined;

    switch (type) {
      case 'signal': {
        // The one who sent it turns to the one who hears it; a source instead
        // speaks to the room, and the room turns to listen.
        if (from && kindOf(from) === 'source') {
          for (const to of e.to) if (byId.has(to)) push(when, 'look', from, to);
          const line = payloadLine(e.payload);
          if (line) push(when, 'say', clip(line), from);
          frame(undefined, when, 'wide'); // ... and the camera takes the room in
        } else if (from && byId.has(from)) {
          const to = e.to.find((id) => byId.has(id));
          if (to) push(when, 'look', to, from);
          // two characters talking share one frame; one character, one body
          frame(to && isCharacter(to) ? [from, to] : from, when, to && isCharacter(to) ? 'wide' : 'full');
        }
        break;
      }
      case 'answer': {
        if (!from || !byId.has(from)) break;
        const cue = cueOf(payloadValue(e.payload), byId);
        push(when, 'pose', pose(cue.pose, 'mouth-happy'), from);
        if (!forwarded.has(`${e.t}|${from}`)) {
          if (spokeTo) push(when, 'look', spokeTo, from);
          else {
            const to = e.to.find((id) => byId.has(id));
            if (to) push(when, 'look', to, from);
          }
        }
        const line = cue.say ?? payloadLine(e.payload);
        if (line) push(when, 'say', clip(line), from);
        // turn to the one this line is for: the forward's target reads better than
        // the router's reply, which a composed neuron's caller can be
        const addressee =
          forwardTo.get(`${e.t}|${from}`) ?? spokeTo ?? e.to.find((id) => byId.has(id) && id !== from);
        if (addressee && addressee !== from) faceAt(from, byId.get(addressee)?.x, when);
        // A cue's skin is the look of the character that answered, not of the
        // whole cast: a network of characters can be drawn in as many hands as
        // it has voices (host.ts composites a mixed cast).
        if (cue.skin) events.push({ at: when, style: cue.skin, on: from });
        if (cue.palette) events.push({ at: when, style: cue.skin ?? skin, palette: cue.palette });
        break;
      }
      case 'quiet': {
        if (e.from) {
          push(when, 'pose', 'mouth-shut', e.from);
          push(when, 'pose', 'shrug', e.from);
        }
        break;
      }
      case 'drop': {
        const who = e.neuron ?? e.from;
        if (who && byId.has(who)) push(when, 'pose', pose(DROPPED[e.reason ?? ''], 'dunno'), who);
        break;
      }
      case 'error':
      case 'unknown': {
        const who = e.neuron ?? e.from;
        if (who && byId.has(who)) push(when, 'pose', type === 'error' ? 'eyes-furious' : 'eyes-terrified', who);
        break;
      }
      case 'note': {
        if (e.what === 'retry' && e.neuron && byId.has(e.neuron)) push(when, 'pose', 'eyes-suspicious', e.neuron);
        break;
      }
      case 'ground':
      case 'finished':
      case 'fail':
      case 'other':
        break;
    }
  }

  // The last moment of the run, then two beats later the card.
  const end = trace.events.reduce((m, e) => Math.max(m, e.t), 0);
  const cardBeat = Math.round((absBeat(at(end)) + 2) * 1000) / 1000;
  const cardAt: [number, number] = [Math.floor(cardBeat / beatsPerBar) + 1, Math.round((cardBeat % beatsPerBar) * 1000) / 1000 + 1];
  push(cardAt, 'shot', 'wide');
  push(cardAt, 'end', { card: 'logo', text: (o.title ?? title).toUpperCase() });

  // A cue's skin is that character's hand for the rest of the show: keep it on
  // the actor too, so the cast pane and the host read the cast the way the
  // events will draw it (a show can be cast, not only played).
  for (const e of events) {
    if (typeof e.style !== 'string' || typeof e.on !== 'string') continue;
    const actor = byId.get(e.on);
    if (actor) actor.style = e.style;
  }

  return {
    title,
    note:
      `compiled from the trace of ${trace.demo}` +
      (trace.engine ? ` (${trace.engine})` : '') +
      `: ${actors.length} neurons, ${trace.events.length} events`,
    bpm,
    beatsPerBar,
    skin,
    palette: o.palette,
    tail: Math.max(tailBeats, 2) * spb,
    actors,
    events
  };
}

/**
 * A payload may direct its own performance, and this is the whole vocabulary:
 * `say`, `pose`, `look`, `shot`, `skin`, `palette`, flat or under `stage`.
 * Anything else is ignored, so a payload is data, never a script for the stage.
 */
export function cueOf(value: unknown, ids: Map<string, StageActor>): Cue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const o = value as Record<string, unknown>;
  const stage = o.stage && typeof o.stage === 'object' ? (o.stage as Record<string, unknown>) : {};
  const read = (key: string): unknown => (stage[key] !== undefined ? stage[key] : o[key]);
  const cue: Cue = {};
  const say = read('say');
  if (typeof say === 'string' && say.trim()) cue.say = clip(say);
  const named = read('pose');
  if (typeof named === 'string' && hasPose(named)) cue.pose = named;
  const look = read('look');
  if (typeof look === 'string' && ids.has(look)) cue.look = look;
  const shot = read('shot');
  if (typeof shot === 'string' && (FRAMINGS as string[]).includes(shot)) cue.shot = shot as Framing;
  const skin = read('skin');
  if (typeof skin === 'string' && SKINS[skin]) cue.skin = skin;
  const palette = read('palette');
  if (typeof palette === 'string') cue.palette = palette;
  return cue;
}

export function hasPose(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(POSES, name);
}

/** A pose the rig has, or the fallback: a cue may not hand the stage a name that draws nothing. */
export function pose(name: string | undefined, fallback: string): string {
  return name && hasPose(name) ? name : fallback;
}

/** One line, at most `max` characters: a caption, not a log. */
export function clip(text: string, max = 160): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max - 1).trimEnd() + '…' : one;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
