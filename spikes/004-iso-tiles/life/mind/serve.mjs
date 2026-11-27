// The level 1 contract (agent-neuron SPEC 3.2), once, for every mind program
// here: hello and ready, then one JSON line per signal, a reply for every `re`
// (a cancelled one too), and a pong for a ping. A handler returns a payload
// (an answer) or undefined (quiet). Logs go to stderr; stdout is protocol only.
import { createInterface } from 'node:readline';

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');

/** `name=value` arguments, as numbers where they are numbers. */
export function traits(args) {
  const out = {};
  for (const a of args) {
    const i = a.indexOf('=');
    if (i < 1) continue;
    const v = a.slice(i + 1);
    out[a.slice(0, i)] = v !== '' && Number.isFinite(Number(v)) ? Number(v) : v;
  }
  return out;
}

export function serve(handle) {
  let hello = true;
  createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;
    let m;
    try {
      m = JSON.parse(line);
    } catch {
      return;
    }
    if (hello) {
      hello = false;
      send({ v: 1, type: 'ready', maxInflight: 1 });
      return;
    }
    if (m.type === 'ping') return send({ type: 'pong', n: m.n });
    if (m.type === 'cancel') return send({ type: 'quiet', re: m.re });
    if (m.type !== 'signal') return;
    let out;
    try {
      out = handle(m.payload);
    } catch (e) {
      return send({ type: 'error', re: m.re, message: String(e?.message ?? e).slice(0, 200) });
    }
    send(out === undefined ? { type: 'quiet', re: m.re } : { type: 'answer', re: m.re, payload: out });
  });
}
