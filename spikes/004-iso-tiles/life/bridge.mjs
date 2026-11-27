// spike 004, round three: the bridge between the page and the engine.
//
//   node spikes/004-iso-tiles/life/bridge.mjs        (then open the page, show "life")
//
// For every character in cast/ it runs `neuron-engine check`, then a live run
// (`neuron-engine run <file> --inputs - --stream /dev/fd/3`, agent-neuron
// decision 0020): the bridge is the live producer, writing the page's senses
// on the engine's stdin, and it relays the engine's live stream to the page.
//
// The bridge decides nothing about a mind. The engine runs each network;
// the bridge only carries lines, and it is the gate on what the page may
// inject: a sense from a closed list, with its fields rebuilt from scratch, so
// a payload stays data (AGENTS.md).
//
//   GET  /events   server-sent events: { who, ev } per engine event, and a
//                  first `hello` with the cast and the last answer of every neuron
//   POST /inject   { who, payload: { sense, ... } }
//
// It listens on 127.0.0.1 only. The engine is $NEURON_ENGINE, or
// `neuron-engine` on PATH.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const castDir = join(here, 'cast');
const engine = process.env.NEURON_ENGINE || 'neuron-engine';
const port = Number(process.env.LIFE_PORT || 5292);

/** who → { proc, up } */
const minds = new Map();
/** who → neuron → its last answer, so a page that connects late sees where every drive is */
const last = new Map();
const clients = new Set();

function broadcast(msg) {
  const line = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(line);
}

function start(who, file) {
  const checked = spawnSync(engine, ['check', file], { encoding: 'utf8' });
  if (checked.status !== 0) {
    console.error(`${who}: check failed\n${checked.stdout}${checked.stderr}`);
    return;
  }
  const proc = spawn(engine, ['run', file, '--inputs', '-', '--stream', '/dev/fd/3'], {
    cwd: castDir,
    stdio: ['pipe', 'ignore', 'pipe', 'pipe']
  });
  const mind = { proc, up: true };
  minds.set(who, mind);
  last.set(who, {});
  let buf = '';
  proc.stdio[3].setEncoding('utf8');
  proc.stdio[3].on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      // the page needs what moved along which link (signals) and what each neuron said (answers)
      if (ev.type !== 'signal' && ev.type !== 'answer' && ev.type !== 'error') continue;
      const out = { type: ev.type, t: ev.t, from: ev.from, to: ev.to, payload: ev.payload?.data, message: ev.message };
      if (ev.type === 'answer') last.get(who)[ev.from] = out;
      broadcast({ who, ev: out });
    }
  });
  proc.stderr.setEncoding('utf8');
  proc.stderr.on('data', (d) => process.stderr.write(`${who}: ${d}`));
  proc.on('exit', (code) => {
    mind.up = false;
    console.error(`${who}: engine exited ${code}`);
    broadcast({ who, down: true });
  });
  console.log(`${who}: running ${file}`);
}

// ── what the page may say to a mind ─────────────────────────────────────────

const SENSES = new Set(['tick', 'ate', 'kind', 'hurt', 'scare', 'vented', 'apology']);
const name = (v) => (typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(v) ? v : undefined);

/** A sense rebuilt field by field: nothing the page sends is passed on as it came. */
function clean(p) {
  if (!p || typeof p !== 'object' || !SENSES.has(p.sense)) return null;
  const out = { sense: p.sense };
  if (p.sense === 'tick') {
    out.dt = Math.min(5, Math.max(0, Number(p.dt) || 0));
    out.company = Array.isArray(p.company) ? p.company.map(name).filter(Boolean).slice(0, 16) : [];
    out.at = name(p.at) ?? null;
    out.dark = p.dark === true;
  }
  if (name(p.from)) out.from = name(p.from);
  if (name(p.at) && p.sense === 'vented') out.at = name(p.at);
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (d) => {
      body += d;
      if (body.length > 4096) reject(new Error('too long'));
    });
    req.on('end', () => resolve(body));
  });
}

const server = createServer(async (req, res) => {
  // the page is served by vite on another local port
  const origin = req.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const cast = [...minds].map(([who, m]) => ({ who, up: m.up }));
    res.write(`data: ${JSON.stringify({ hello: { cast, last: Object.fromEntries(last) } })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.method === 'POST' && req.url === '/inject') {
    let msg;
    try {
      msg = JSON.parse(await readBody(req));
    } catch {
      return res.writeHead(400).end('not json');
    }
    const mind = minds.get(msg?.who);
    const payload = clean(msg?.payload);
    if (!mind || !mind.up) return res.writeHead(404).end('no such mind');
    if (!payload) return res.writeHead(400).end('not a sense');
    mind.proc.stdin.write(JSON.stringify({ source: 'senses', payload }) + '\n');
    return res.writeHead(204).end();
  }
  res.writeHead(404).end();
});

for (const f of readdirSync(castDir).filter((f) => f.endsWith('.network.json')).sort()) start(f.replace('.network.json', ''), join(castDir, f));
server.listen(port, '127.0.0.1', () => console.log(`life bridge on http://127.0.0.1:${port}`));

function stop() {
  // closing a live run's stdin is the producer saying it is done: the engine shuts its neurons down
  for (const m of minds.values()) m.proc.stdin.end();
  server.close();
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
