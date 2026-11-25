// fromscore.ts: the other way in. A score is a show already - maxcot's syntax
// (comments, unquoted keys, single quotes, trailing commas; never evaluated) or
// the same document as JSON, which is what a network can answer with.
//
// The cast comes from the score itself: `enter` and `create` are the only two
// commands that put an actor on the stage, so a score declares its characters
// the way a network file declares its neurons.
import { parseScore } from 'maxcot/score';
import type { ScoreEvent } from 'maxcot/score';
import { FACING } from './cast.ts';
import type { Show, ShowActor } from './show.ts';

export interface ScoreOptions {
  title?: string;
  note?: string;
  skin?: string;
  bpm?: number;
}

interface ScoreDocument {
  title?: string;
  bpm?: number;
  beatsPerBar?: number;
  tail?: number;
  events: ScoreEvent[];
}

/** Read a score from text: JSON first (what a program answers), then maxcot's own syntax. */
export function parseShow(text: string, o: ScoreOptions = {}): Show {
  const doc = readDocument(text);
  const actors: ShowActor[] = [];
  const index = new Map<string, ShowActor>();
  const place = (id: string, who?: string, x?: number, z?: number): ShowActor => {
    const seen = index.get(id);
    if (seen) {
      if (who) seen.who = who;
      if (x != null) seen.x = x;
      if (z != null) seen.z = z;
      return seen;
    }
    const actor: ShowActor = {
      id,
      who: who || id,
      x: x ?? Number.NaN,
      z: z ?? 0,
      weight: 0.5,
      idle: 'still',
      kind: 'run',
      note: ''
    };
    actors.push(actor);
    index.set(id, actor);
    return actor;
  };

  for (const e of doc.events) {
    const enter = e.enter;
    if (typeof enter === 'string') place(enter);
    else if (enter && typeof enter === 'object') {
      const v = enter as Record<string, unknown>;
      const id = typeof v.id === 'string' ? v.id : typeof v.who === 'string' ? v.who : undefined;
      if (id) place(id, str(v.who), num(v.x), num(v.z));
    }
    if (typeof e.create === 'string') place(e.create);
    if (typeof e.exit === 'string') {
      const gone = index.get(e.exit);
      if (gone) {
        index.delete(e.exit);
        actors.splice(actors.indexOf(gone), 1);
      }
    }
    if (e.manner && typeof e.manner === 'object' && typeof e.on === 'string') {
      const actor = index.get(e.on);
      const m = e.manner as Record<string, unknown>;
      if (actor) {
        if (typeof m.weight === 'number') actor.weight = m.weight;
        if (typeof m.idle === 'string') actor.idle = m.idle;
      }
    }
    if (e.who && typeof e.who === 'string' && typeof e.on === 'string') {
      const actor = index.get(e.on);
      if (actor) actor.who = e.who;
    }
    // `style` with `on` draws one character in its own skin; without `on` it is
    // the whole cast's look (the last one is the show's skin).
    if (typeof e.style === 'string' && typeof e.on === 'string') {
      const actor = index.get(e.on);
      if (actor) actor.style = e.style;
    }
  }

  // A score that never says where an actor stands gets an even line.
  const loose = actors.filter((a) => Number.isNaN(a.x));
  loose.forEach((a, i) => {
    a.x = (i - (loose.length - 1) / 2) * 1.9;
  });

  // ── staging: which way the bodies turn ──────────────────────────────────
  // A score says who looks at whom, not which way a body turns (maxcot's look()
  // only flicks the eyes, and twists the body away: spikes/001-facing). The
  // reader applies the stage's two rules - face the middle of the cast on the
  // way on, and turn to whoever you look at - exactly as the trace compiler
  // does, so a score a person writes and a score a network answers look alike.
  const events: ScoreEvent[] = [];
  const turnedTo = new Map<string, number>();
  const turn = (id: string, targetX: number | undefined, at: ScoreEvent['at']): void => {
    const actor = index.get(id);
    if (!actor || targetX == null || !Number.isFinite(targetX)) return;
    const dir = Math.sign(targetX - actor.x);
    if (!dir) return;
    const yaw = Math.round(dir * FACING * 1000) / 1000;
    if (turnedTo.get(id) === yaw) return;
    turnedTo.set(id, yaw);
    events.push({ at, set: 'view.yaw', to: yaw, on: id });
  };
  for (const event of doc.events) {
    const entered = idOfEnter(event.enter);
    if (entered && index.has(entered) && !turnedTo.has(entered)) {
      const others = actors.filter((a) => a.id !== entered).map((a) => a.x);
      turn(entered, others.length ? others.reduce((sum, x) => sum + x, 0) / others.length : undefined, event.at);
    }
    const looker = typeof event.on === 'string' ? event.on : undefined;
    const target = typeof event.look === 'string' ? event.look : undefined;
    // a look at a person turns the body to them, and the turn goes BEFORE the
    // look so a host that faces the looked-at actor at runtime has the last word
    if (looker && target && target !== 'us' && target !== 'none' && index.has(target)) {
      turn(looker, index.get(target)!.x, event.at);
    }
    events.push(event);
  }

  const styles = doc.events.filter((e) => typeof e.style === 'string' && typeof e.on !== 'string');
  const lastStyle = styles[styles.length - 1];
  return {
    title: doc.title ?? o.title ?? 'a score',
    note: o.note ?? `a score of ${doc.events.length} events`,
    bpm: doc.bpm ?? o.bpm ?? 100,
    beatsPerBar: doc.beatsPerBar ?? 4,
    skin: (lastStyle?.style as string) ?? o.skin ?? 'pencil',
    tail: doc.tail ?? 3,
    actors,
    events
  };
}

/** The id an `enter` command puts on the stage: a name, or an object's id/who. */
function idOfEnter(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' ? v.id : typeof v.who === 'string' ? v.who : undefined;
}

function readDocument(text: string): ScoreDocument {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as ScoreDocument;
      if (json && Array.isArray(json.events)) return json;
    } catch {
      // not JSON: fall through to the score syntax, which is the point of it
    }
  }
  const result = parseScore(text);
  if (!result.ok) throw new Error(`line ${result.error.line}, column ${result.error.col}: ${result.error.message}`);
  return result.score;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
