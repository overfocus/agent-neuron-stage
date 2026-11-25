// show.ts: what the stage plays. One shape, two ways to get one - a trace
// (fromtrace.ts) or a score someone wrote or a network answered (fromscore.ts).
//
// The events are maxcot score events (bars and beats, `at` first, then one or
// more commands), so a show formats back to a .score that maxcot's own studio
// reads. `say` and `end` are the stage's own two commands; everything else is
// maxcot's.
import type { ScoreEvent } from 'maxcot/score';

export interface ShowActor {
  id: string;
  who: string;
  /**
   * The skin that draws THIS actor, when a scene mixes looks: maxcot's Stage
   * paints the merged cast in one skin, so a mixed cast is composited (host.ts).
   * A show with no actor skins is painted in `Show.skin`, the old way.
   */
  style?: string;
  x: number;
  z: number;
  weight: number;
  idle: string;
  kind: string;
  note: string;
}

export interface Show {
  title: string;
  /** Where this show came from, in a line. */
  note: string;
  bpm: number;
  beatsPerBar: number;
  skin: string;
  palette?: string;
  /** Seconds to keep the stage after the last event. */
  tail: number;
  actors: ShowActor[];
  events: ScoreEvent[];
}

/** The commands the stage knows. Anything else in a score is ignored, not an error. */
export const COMMANDS = [
  'enter',
  'create',
  'exit',
  'pose',
  'look',
  'shot',
  'style',
  'who',
  'manner',
  'set',
  'move',
  'say',
  'end'
] as const;

/** A score the stage can play, as text (maxcot's own score syntax). */
export function formatScore(show: Show, header: string[] = []): string {
  const lines: string[] = [];
  for (const line of header) lines.push('// ' + line);
  if (header.length) lines.push('');
  lines.push('{');
  lines.push(`  title: ${literal(show.title)},`);
  lines.push(`  bpm: ${literal(show.bpm)},`);
  if (show.beatsPerBar !== 4) lines.push(`  beatsPerBar: ${literal(show.beatsPerBar)},`);
  if (show.tail) lines.push(`  tail: ${literal(show.tail)},`);
  lines.push('  events: [');
  for (const e of show.events) lines.push('    ' + eventLine(e) + ',');
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** One event on one line: `{ at: [2, 1], pose: 'wave', on: 'max' }`. */
export function eventLine(e: ScoreEvent): string {
  const parts: string[] = [`at: ${beat(e.at)}`];
  for (const [k, v] of Object.entries(e)) {
    if (k === 'at' || v === undefined) continue;
    parts.push(`${key(k)}: ${literal(v)}`);
  }
  return '{ ' + parts.join(', ') + ' }';
}

export function beat(at: [number, number]): string {
  return `[${trim(at[0])}, ${trim(at[1])}]`;
}

/** A number as a score writes it: no trailing zeros, no -0. */
export function trim(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const s = String(Math.round(n * 10000) / 10000);
  return s === '-0' ? '0' : s;
}

function key(k: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
}

function literal(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return trim(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v == null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(literal).join(', ') + ']';
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, value]) => value !== undefined);
    return '{ ' + entries.map(([k, value]) => `${key(k)}: ${literal(value)}`).join(', ') + ' }';
  }
  return 'null';
}
