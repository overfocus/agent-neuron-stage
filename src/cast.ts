// cast.ts: a trace's header is a cast list. Every neuron is an actor, and the
// links say where it stands.
//
// A trace carries no `at` (TRACE.md: id, kind, description, options, cost), so
// the blocking is read from the graph instead: the cast is laid out in layers,
// one layer per step away from the neurons nothing reaches. A network that
// flows left to right reads that way on the stage, and a broadcast (one source
// into two characters) puts the two side by side, facing the one who spoke.
import { CAST } from 'maxcot';
import type { Trace, TraceNeuron } from './trace.ts';

export interface StageActor {
  /** The neuron's id: what the score and the panes call it. */
  id: string;
  /** The maxcot actor that plays it: max, child, boss, ... */
  who: string;
  x: number;
  z: number;
  /** How it moves: 0 light and springy, 1 heavy and slow (maxcot's manner). */
  weight: number;
  idle: string;
  kind: string;
  note: string;
  /** The skin that draws this character, when a scene gives it its own (host.ts composites a mixed cast). */
  style?: string;
}

export interface CastOptions {
  /** Pin a neuron to a maxcot actor. */
  who?: Record<string, string>;
  /** Pin a neuron's place on the floor, in body units. */
  x?: Record<string, number>;
}

const SPACING = 1.9;
/**
 * The yaw a character turns to face another: maxcot's own three-quarter turn.
 * A figure is oriented by view.yaw plus twist, and yaw > 0 points screen-right
 * (see spikes/001-facing for the measurements).
 */
export const FACING = 0.38;
const ALIAS: Record<string, string> = {
  kid: 'child',
  boy: 'child',
  girl: 'girl',
  woman: 'girl',
  man: 'oldman',
  teacher: 'professor',
  lead: 'boss',
  reviewer: 'clerk'
};

/** How a kind of neuron carries itself, on maxcot's 0..1 weight dial. */
const WEIGHT: Record<string, number> = {
  source: 0.25,
  run: 0.45,
  serve: 0.5,
  http: 0.55,
  human: 0.65,
  composed: 0.6
};

/** What an actor with nothing to do does while it waits. */
const IDLE: Record<string, string> = {
  source: 'sway',
  run: 'still',
  serve: 'still',
  http: 'still',
  human: 'fidget',
  composed: 'sway'
};

export function castOf(trace: Trace, o: CastOptions = {}): StageActor[] {
  const depth = depths(trace);
  const layers = new Map<number, string[]>();
  for (const n of trace.neurons) {
    const d = depth[n.id]!;
    const layer = layers.get(d) ?? [];
    layer.push(n.id);
    layers.set(d, layer);
  }
  const placed = new Map<string, number>();
  for (const [d, ids] of layers) {
    ids.forEach((id, k) => placed.set(id, d * SPACING + (k - (ids.length - 1) / 2) * SPACING * 0.92));
  }
  const xs = [...placed.values()];
  const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  return trace.neurons.map((n) => {
    const kind = kindOf(n);
    const threshold = n.options?.threshold ?? 1;
    return {
      id: n.id,
      who: o.who?.[n.id] ?? whoOf(n.id),
      x: o.x?.[n.id] ?? (placed.get(n.id) ?? 0) - mid,
      z: (hash(n.id) % 3) * 0.12,
      weight: Math.min(0.95, (WEIGHT[kind] ?? 0.5) + (threshold > 1 ? 0.15 : 0)),
      idle: IDLE[kind] ?? 'still',
      kind,
      note: n.description
    };
  });
}

/** Hops from the nearest neuron nothing reaches: well defined on a cycle, unlike a longest path. */
function depths(trace: Trace): Record<string, number> {
  const out: Record<string, number> = {};
  const next = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of trace.neurons) {
    next.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const l of trace.links) {
    next.get(l.from)?.push(l.to);
    indeg.set(l.to, (indeg.get(l.to) ?? 0) + 1);
  }
  // The roots are the neurons nothing reaches; in a ring nothing is, so start anywhere.
  let queue = trace.neurons.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (!queue.length && trace.neurons.length) queue = [trace.neurons[0]!.id];
  for (const id of queue) out[id] = 0;
  while (queue.length) {
    const id = queue.shift()!;
    for (const to of next.get(id) ?? []) {
      if (out[to] != null) continue; // already nearer: a cycle or a shortcut adds nothing
      out[to] = out[id]! + 1;
      queue.push(to);
    }
  }
  for (const n of trace.neurons) if (out[n.id] == null) out[n.id] = 0;
  return out;
}

export function kindOf(n: TraceNeuron): string {
  return (n.kind || 'run').toLowerCase();
}

/** The actor that plays a neuron id: a name it already has, a plain alias, or a
 *  stable pick from maxcot's cast (the same id always gets the same face). */
export function whoOf(id: string): string {
  const key = id.toLowerCase();
  const castKeys = Object.keys(CAST).sort();
  if (castKeys.includes(key)) return key;
  const alias = ALIAS[key];
  if (alias && castKeys.includes(alias)) return alias;
  return castKeys[hash(id) % castKeys.length] ?? 'max';
}

/** FNV-1a, 32 bits: a stable number for a name, so a show casts the same way twice. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
