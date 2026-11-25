// trace.ts: read an agent-neuron trace (docs/TRACE.md in agent-neuron, format
// version 1). A trace is the script of a show: the cast is declared up front,
// then events in the order the network reported them, with times.
//
// Readers ignore fields and event types they do not know (TRACE.md,
// Compatibility), and so does this one: nothing here fails because a newer
// engine wrote something new. Ids are opaque strings.

export type KnownType =
  | 'signal'
  | 'answer'
  | 'quiet'
  | 'drop'
  | 'error'
  | 'unknown'
  | 'note'
  | 'ground'
  | 'finished'
  | 'fail';

export interface TracePayload {
  type?: string;
  data?: unknown;
  text?: string;
  preview?: unknown;
  truncated?: boolean;
}

export interface TraceNeuron {
  id: string;
  kind: string;
  description: string;
  options?: { threshold?: number; within?: number; maxHops?: number };
}

export interface TraceLink {
  from: string;
  to: string;
}

export interface TraceEvent {
  t: number;
  type: string;
  id?: string;
  from?: string;
  to: string[];
  trace?: string;
  replyTo?: string;
  cause?: string;
  hops?: number;
  payload?: TracePayload;
  /** The neuron a drop, an error or a note is about. */
  neuron?: string;
  reason?: string;
  message?: string;
  code?: string;
  what?: string;
  text?: string;
  status?: string;
  via?: string;
}

export interface Trace {
  format: string;
  version: number;
  demo: string;
  description: string;
  engine?: string;
  neurons: TraceNeuron[];
  links: TraceLink[];
  events: TraceEvent[];
  summary: Record<string, unknown>;
}

/** Read a trace from already-parsed JSON. Throws a plain sentence on a bad file. */
export function parseTrace(value: unknown): Trace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('a trace is one JSON object');
  const root = value as Record<string, unknown>;
  if (root.format !== 'agent-neuron-trace') {
    throw new Error(`this is not an agent-neuron trace (format is ${JSON.stringify(root.format)})`);
  }
  const version = num(root.version);
  if (version == null) throw new Error('the trace has no version');
  if (version > 1) throw new Error(`this stage reads trace version 1; the file says version ${version}`);
  const neurons = array(root.neurons).map(readNeuron);
  const links = array(root.links).map(readLink).filter((l): l is TraceLink => l != null);
  const events = array(root.events).map(readEvent).filter((e): e is TraceEvent => e != null);
  if (!neurons.length) throw new Error('the trace declares no neurons');
  const ids = new Set(neurons.map((n) => n.id));
  return {
    format: 'agent-neuron-trace',
    version,
    demo: str(root.demo) ?? 'a run',
    description: str(root.description) ?? '',
    engine: str(root.engine),
    neurons,
    // A link to a neuron the header does not name cannot be drawn; drop it
    // rather than lay the cast out around a ghost.
    links: links.filter((l) => ids.has(l.from) && ids.has(l.to)),
    events,
    summary: (root.summary as Record<string, unknown>) ?? {}
  };
}

/** What kind of thing an event is. An event with no type is a signal. */
export function eventType(e: TraceEvent): KnownType | 'other' {
  const t = e.type === '' ? 'signal' : e.type;
  switch (t) {
    case 'signal':
    case 'answer':
    case 'quiet':
    case 'drop':
    case 'error':
    case 'unknown':
    case 'note':
    case 'ground':
    case 'finished':
    case 'fail':
      return t;
    default:
      return 'other';
  }
}

/** The payload as a plain value: JSON data or a text string. A truncated JSON
 *  payload keeps only a preview, which is not a value and cannot be read. */
export function payloadValue(p?: TracePayload): unknown {
  if (!p) return undefined;
  if (p.data !== undefined) return p.data;
  if (typeof p.text === 'string') return p.text;
  return undefined;
}

/**
 * The line a payload carries, if it carries one a caption can show: a text
 * payload, a JSON string, or the first of `say`/`line`/`text`/`message`/`title`
 * on an object. Anything else has nothing to say, which is not an error.
 */
export function payloadLine(p?: TracePayload): string | undefined {
  const value = payloadValue(p);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    for (const key of ['say', 'line', 'text', 'message', 'title']) {
      if (typeof o[key] === 'string') return o[key] as string;
    }
  }
  return undefined;
}

function readNeuron(value: unknown): TraceNeuron {
  const o = obj(value) ?? {};
  const id = str(o.id);
  if (!id) throw new Error('a neuron in the header has no id');
  const options = obj(o.options);
  return {
    id,
    kind: str(o.kind) ?? 'run',
    description: str(o.description) ?? '',
    options: options
      ? { threshold: num(options.threshold), within: num(options.within), maxHops: num(options.maxHops) }
      : undefined
  };
}

function readLink(value: unknown): TraceLink | null {
  const o = obj(value);
  const from = o ? str(o.from) : undefined;
  const to = o ? str(o.to) : undefined;
  return from && to ? { from, to } : null;
}

function readEvent(value: unknown): TraceEvent | null {
  const o = obj(value);
  if (!o) return null;
  const t = num(o.t);
  if (t == null || !Number.isFinite(t)) return null;
  const to = Array.isArray(o.to) ? o.to.filter((v): v is string => typeof v === 'string') : str(o.to) ? [str(o.to) as string] : [];
  return {
    t,
    // an absent type is a signal: the deleted library wrote signals without one
    type: typeof o.type === 'string' ? o.type : 'signal',
    id: str(o.id),
    from: str(o.from),
    to,
    trace: str(o.trace),
    replyTo: str(o.replyTo),
    cause: str(o.cause),
    hops: num(o.hops),
    payload: obj(o.payload) as TracePayload | undefined,
    neuron: str(o.neuron),
    reason: str(o.reason),
    message: str(o.message),
    code: str(o.code),
    what: str(o.what),
    text: str(o.text),
    status: str(o.status),
    via: str(o.via)
  };
}

function obj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
function array(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}
function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
