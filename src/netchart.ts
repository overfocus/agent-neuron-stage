// netchart.ts: the network as a drawing. A trace is a cast and a set of links,
// so the page can show what the run was before it became a film: each neuron a
// dot where the network file put it, each link an arrow, and - when the page
// knows what the minds are - the thing all of them are talking to.
//
// The geometry is a pure function of the trace: the same x and z the stage
// stands the cast at (cast.ts), normalised into a 0..1 box, near at the bottom.
// The renderer decides pixels; this decides where everything is.
import { castOf } from './cast.ts';
import type { Trace } from './trace.ts';

export interface NetNode {
  /** The neuron's id. */
  id: string;
  kind: string;
  /** The chart box: x 0..1 across the floor, y 0..aspect up it (`netOf`'s aspect; near is low). */
  x: number;
  y: number;
  /** The maxcot actor that plays it, when the show casts one. */
  who: string;
  /** True when the trace's own `at` placed it (decision 0025), rather than the link layout. */
  placed: boolean;
}

export interface NetEdge {
  from: string;
  to: string;
}

/** The mind the neurons talk to: one badge, with an edge from every mind that asks it. */
export interface NetMind {
  label: string;
  x: number;
  y: number;
  /** The neurons this badge belongs to. */
  to: string[];
}

export interface NetChart {
  nodes: NetNode[];
  edges: NetEdge[];
  mind?: NetMind;
}

const PAD_X = 0.09;
const PAD_Y_TOP = 0.1;
const PAD_Y_BOTTOM = 0.78;

/**
 * The network behind a show.
 *
 * `via` is what the page knows about the neurons' minds - for a bundled show,
 * what its programs actually ask (the lab asks a cloud model). It is NOT in the
 * trace: a trace records what happened, not which model a program called, so a
 * loaded file gets no badge rather than a guess.
 */
export function netOf(trace: Trace, options: { via?: string; aspect?: number } = {}): NetChart {
  // the box is one unit wide and `aspect` tall, so a tall pane gets a deep room
  const tall = options.aspect && options.aspect > 0 ? options.aspect : 1;
  const actors = castOf(trace);
  const xs = actors.map((a) => a.x);
  const zs = actors.map((a) => a.z);
  const [minX, maxX] = span(xs);
  const [minZ, maxZ] = span(zs);
  const nodes: NetNode[] = trace.neurons.map((n, i) => {
    const actor = actors[i]!;
    const tx = maxX - minX === 0 ? 0.5 : (actor.x - minX) / (maxX - minX);
    const tz = maxZ - minZ === 0 ? 0.5 : (actor.z - minZ) / (maxZ - minZ);
    return {
      id: n.id,
      kind: actor.kind,
      x: round(PAD_X + tx * (1 - PAD_X * 2)),
      // depth is height on the page: the far end of the room is at the top
      y: round((PAD_Y_BOTTOM - tz * (PAD_Y_BOTTOM - PAD_Y_TOP)) * tall),
      who: actor.who,
      placed: n.at != null
    };
  });
  const edges: NetEdge[] = trace.links.map((l) => ({ from: l.from, to: l.to }));
  const minds = nodes.filter((n) => n.kind !== 'source').map((n) => n.id);
  const mind = options.via && minds.length ? { label: options.via, x: 0.5, y: 0.93 * tall, to: minds } : undefined;
  return mind ? { nodes, edges, mind } : { nodes, edges };
}

function span(values: number[]): [number, number] {
  if (!values.length) return [0, 0];
  return [Math.min(...values), Math.max(...values)];
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
