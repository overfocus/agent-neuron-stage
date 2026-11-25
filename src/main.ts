// main.ts: the page. Load a show (a trace, compiled; or a score, played as it
// is), watch it, scrub it, read what the compiler made of it.
import duetTrace from './traces/duet.json';
import alertsTrace from './traces/alerts.json';
import troupeTrace from './traces/troupe.json';
import labTrace from './traces/lab.json';
import writerScene from '../examples/writer/scene.score?raw';
import { SCENES } from '../scenes/index.ts';
import { compileTrace } from './fromtrace.ts';
import { parseShow } from './fromscore.ts';
import { formatScore, type Show } from './show.ts';
import { ShowHost } from './host.ts';
import { Bubbles } from './bubbles.ts';
import { allSkins } from 'maxcot/skins';
import { netOf } from './netchart.ts';
import { eventType, parseTrace, payloadLine, type Trace } from './trace.ts';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`the page is missing #${id}`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>('stage');
const caption = $('caption');
const card = $('card');
const playButton = $<HTMLButtonElement>('play');
const scrub = $<HTMLInputElement>('scrub');
const clock = $('clock');
const meta = $('meta');
const picker = $<HTMLSelectElement>('show');
const file = $<HTMLInputElement>('file');
const source = $('source');
const speed = $<HTMLSelectElement>('speed');
const lineSelect = $<HTMLSelectElement>('lines');
const bubblesLayer = $('bubbles');

interface Loaded {
  show: Show;
  /** Present when the show came from a run: the events pane reads the trace. */
  trace?: Trace;
  /** What the neurons' minds are, when the page knows (a network's file does not say). */
  via?: string;
  label: string;
}

// How a line is shown: over the speaker's head (the default), or as one line
// under the picture - calmer for a dense run, and what a still without the
// page's chrome would show. The choice sticks.
type LineMode = 'bubbles' | 'caption';
let lineMode: LineMode = localStorage.getItem('stage.lines') === 'caption' ? 'caption' : 'bubbles';
lineSelect.value = lineMode;
const bubbles = new Bubbles(bubblesLayer, canvas);
/** The network pane's drawing and the run's transmissions, for the live pulse. */
interface NetView {
  nodes: Map<string, SVGGElement>;
  edges: Array<{ el: SVGLineElement; from: string; to: string }>;
  events: Array<{ film: number; what: string; from: string; to: string[] }>;
  now: HTMLElement;
  log: HTMLOListElement;
}
let netView: NetView | null = null;
let logKey = '';
const last = { who: '', text: '' };

let host: ShowHost;
let loaded: Loaded;
let selected = '';

/** Show a line the way the reader asked for it; an empty text clears both surfaces. */
function showLine(who: string, text: string, instant = false): void {
  last.who = who;
  last.text = text;
  caption.classList.remove('said');
  caption.textContent = '';
  if (!text) {
    bubbles.clear();
    return;
  }
  if (who) select(who);
  // a seek replays every line at once: only the one at the playhead stays up.
  // Otherwise earlier bubbles stay up for their second (bubbles.ts), so a busy
  // room has several lines on screen and none of them covers another.
  if (instant) bubbles.clear();
  if (lineMode === 'bubbles' && who) {
    bubbles.say(who, text, host ? host.time : 0);
    return;
  }
  bubbles.clear();
  caption.innerHTML = `<b>${escapeHtml(who)}</b>${escapeHtml(text)}`;
  caption.classList.add('said');
}

function showOf(trace: Trace, label: string, skin?: string, via?: string): Loaded {
  const show = compileTrace(trace, { title: trace.demo, skin });
  return { show, trace, label, via };
}

function load(next: Loaded): void {
  loaded = next;
  if (host) host.load(next.show);
  paint();
  source.textContent = next.label;
  setStatus('');
}

function paint(): void {
  const show = loaded.show;
  const cast = `${show.actors.length} ${show.actors.length === 1 ? 'actor' : 'actors'}`;
  meta.textContent = `${show.title} · ${cast} · ${show.events.length} score events · ${show.bpm} bpm`;
  scrub.max = String(host.total || 1);
  scrub.value = '0';
  paintCast(show);
  paintNet();
  $('pane-score').textContent = formatScore(show, [
    `${show.title} — ${show.note}`,
    'this is a maxcot score: the same file plays in maxcot\'s own studio'
  ]);
  paintEvents();
  bubbles.clear();
  last.who = '';
  last.text = '';
  caption.classList.remove('said');
  caption.textContent = '';
  card.hidden = true;
}

function paintCast(show: Show): void {
  const pane = $('pane-cast');
  pane.textContent = '';
  for (const actor of show.actors) {
    const row = document.createElement('div');
    row.className = 'cast-row' + (actor.id === selected ? ' on' : '');
    row.dataset.actor = actor.id;
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'cast-pick';
    const name = document.createElement('span');
    name.className = 'cast-id';
    name.textContent = actor.id;
    const kind = document.createElement('span');
    kind.className = 'cast-kind';
    kind.textContent = actor.kind;
    const play = document.createElement('span');
    play.className = 'cast-who';
    play.textContent = `${actor.who} · ${actor.weight.toFixed(2)}`;
    pick.append(name, kind, play);
    if (actor.note) {
      const note = document.createElement('span');
      note.className = 'cast-note';
      note.textContent = actor.note;
      pick.append(note);
    }
    pick.addEventListener('click', () => select(actor.id));
    // the look this character is drawn in; changing it changes the stage at once
    const look = document.createElement('select');
    look.className = 'cast-skin';
    look.setAttribute('aria-label', `skin for ${actor.id}`);
    const own = document.createElement('option');
    own.value = '';
    own.textContent = `show skin (${show.skin})`;
    look.append(own);
    for (const skin of allSkins) {
      const option = document.createElement('option');
      option.value = skin.name;
      option.textContent = skin.name;
      look.append(option);
    }
    look.value = actor.style ?? '';
    look.addEventListener('change', () => {
      const name = look.value || null;
      actor.style = name ?? undefined;
      host.setLook(actor.id, name);
    });
    row.append(pick, look);
    pane.append(row);
  }
}

/**
 * The network pane: what the run was before it became a film. Each neuron is a
 * dot where the network file put it, each link an arrow, and the mind every
 * neuron but the source talks to is a badge underneath - the model, when the
 * page knows which one (a trace records what happened, not which model a
 * program called).
 */
function paintNet(): void {
  const pane = $('pane-net');
  pane.textContent = '';
  const note = document.createElement('p');
  note.className = 'net-note';
  if (!loaded.trace) {
    note.textContent = "a score has no network: its cast is the file's own";
    pane.append(note);
    return;
  }
  const ASPECT = 1.35; // the room is taller than it is wide, to fill the pane
  const chart = netOf(loaded.trace, { via: loaded.via, aspect: ASPECT });
  const NS = 'http://www.w3.org/2000/svg';
  netView = null;
  logKey = '';
  const W = 340;
  const H = Math.round(W * ASPECT);
  const pad = 10;
  const at = (x: number, y: number) => ({
    x: pad + x * (W - pad * 2),
    y: pad + (y / ASPECT) * (H - pad * 2)
  });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'net-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `the network of ${loaded.show.title}: ${chart.nodes.length} neurons, ${chart.edges.length} links`);
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML =
    '<marker id="net-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">' +
    '<path d="M0,0 L8,4 L0,8 z" fill="#5f6878"/></marker>';
  svg.append(defs);

  const colour = (kind: string): string =>
    kind === 'source' ? '#7fd1c1' : kind === 'composed' ? '#b48cff' : kind === 'human' ? '#6fd08c' : '#79a7ff';
  const radius = (kind: string): number => (kind === 'source' ? 5.5 : 7);
  const place = new Map(chart.nodes.map((n) => [n.id, at(n.x, n.y)]));

  /** A line between two dots, stopping at each edge so the arrow shows. */
  const line = (from: { x: number; y: number }, to: { x: number; y: number }, fromR: number, toR: number, cls: string, arrow: boolean): SVGLineElement => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const el = document.createElementNS(NS, 'line');
    el.setAttribute('x1', String(from.x + (dx / len) * (fromR + 2)));
    el.setAttribute('y1', String(from.y + (dy / len) * (fromR + 2)));
    el.setAttribute('x2', String(to.x - (dx / len) * (toR + 3)));
    el.setAttribute('y2', String(to.y - (dy / len) * (toR + 3)));
    el.setAttribute('class', cls);
    if (arrow) el.setAttribute('marker-end', 'url(#net-arrow)');
    return el;
  };

  // the mind first, so the links are drawn over it
  if (chart.mind) {
    const m = at(chart.mind.x, chart.mind.y);
    const width = Math.max(130, chart.mind.label.length * 5.3 + 22);
    for (const id of chart.mind.to) {
      const node = chart.nodes.find((n) => n.id === id)!;
      const p = place.get(id)!;
      svg.append(line(p, { x: m.x, y: m.y - 10 }, radius(node.kind), 0, 'net-edge net-ask', false));
    }
    const box = document.createElementNS(NS, 'g');
    box.setAttribute('class', 'net-mind');
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(m.x - width / 2));
    rect.setAttribute('y', String(m.y - 10));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', '20');
    rect.setAttribute('rx', '10');
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', String(m.x));
    text.setAttribute('y', String(m.y + 3.5));
    text.textContent = chart.mind.label;
    box.append(rect, text);
    svg.append(box);
  }

  const edges: NetView['edges'] = [];
  for (const edge of chart.edges) {
    const from = place.get(edge.from);
    const to = place.get(edge.to);
    if (!from || !to) continue;
    const a = chart.nodes.find((n) => n.id === edge.from)!;
    const b = chart.nodes.find((n) => n.id === edge.to)!;
    const el = line(from, to, radius(a.kind), radius(b.kind), 'net-edge', true);
    svg.append(el);
    edges.push({ el, from: edge.from, to: edge.to });
  }

  const nodes = new Map<string, SVGGElement>();

  for (const node of chart.nodes) {
    const p = place.get(node.id)!;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `net-node ${node.kind}`);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', String(p.x));
    dot.setAttribute('cy', String(p.y));
    dot.setAttribute('r', String(radius(node.kind)));
    dot.setAttribute('fill', colour(node.kind));
    const title = document.createElementNS(NS, 'title');
    title.textContent = `${node.id} · ${node.kind} · ${node.who}${node.placed ? '' : ' · placed by the links'}`;
    const label = document.createElementNS(NS, 'text');
    // a label would sit on the mind badge at the foot of the room: put it above instead
    label.setAttribute('x', String(p.x));
    label.setAttribute('y', String(node.y > 0.68 ? p.y - 10 : p.y + 15));
    label.setAttribute('class', 'net-label');
    label.textContent = node.id;
    dot.addEventListener('click', () => select(node.id));
    g.append(title, dot, label);
    svg.append(g);
    nodes.set(node.id, g);
  }

  note.textContent = chart.mind
    ? `every neuron but the source talks to ${chart.mind.label}`
    : 'the trace does not say what a neuron’s mind runs — a model is not part of a trace';
  // When each thing the run did reaches the film: the compiler's lead-in, then
  // the run's own milliseconds on one linear clock (fromtrace.ts).
  const spb = 60 / loaded.show.bpm;
  const lead = loaded.show.beatsPerBar * spb;
  const events = loaded.trace.events.map((e) => ({
    film: lead + e.t / 1000,
    what: e.type,
    from: e.from ?? e.neuron ?? '',
    to: e.to
  }));
  const now = document.createElement('p');
  now.className = 'net-now';
  now.textContent = 'the room is quiet';
  const log = document.createElement('ol');
  log.className = 'net-log';
  pane.append(now, svg, note, log);
  netView = { nodes, edges, events, now, log };
}

/** The network, live: the line being spoken travels along its links. */
function netLive(seconds: number): void {
  if (!netView) return;
  const held = 0.6; // seconds a transmission stays lit
  const hotEdges = new Map<string, number>();
  let now: { age: number; text: string } | null = null;
  for (const event of netView.events) {
    const age = seconds - event.film;
    if (age < 0 || age > held) continue;
    const strength = 1 - age / held;
    for (const to of event.to) hotEdges.set(`${event.from}>${to}`, Math.max(hotEdges.get(`${event.from}>${to}`) ?? 0, strength));
    if (!now || age < now.age) now = { age, text: eventText(event) };
  }
  for (const edge of netView.edges) {
    const strength = hotEdges.get(`${edge.from}>${edge.to}`) ?? 0;
    edge.el.classList.toggle('hot', strength > 0);
    edge.el.style.opacity = strength > 0 ? String(0.55 + 0.45 * strength) : '';
  }
  const talking = new Set<string>();
  for (const key of hotEdges.keys()) {
    const [from, to] = key.split('>');
    if (from) talking.add(from);
    if (to) talking.add(to);
  }
  for (const [id, g] of netView.nodes) g.classList.toggle('hot', talking.has(id));
  netView.now.textContent = now ? now.text : 'the room is quiet';
  // and what the room has just been doing, newest first
  const recent = netView.events
    .map((event) => ({ event, age: seconds - event.film }))
    .filter((row) => row.age >= 0 && row.age <= 2.5)
    .sort((a, b) => a.age - b.age)
    .slice(0, 7);
  const key = recent.map((row) => row.event.film).join(',');
  if (key !== logKey) {
    logKey = key;
    netView.log.textContent = '';
    for (const { event } of recent) {
      const row = document.createElement('li');
      const at = document.createElement('span');
      at.className = 'net-log-at';
      at.textContent = `${event.film.toFixed(1)}s`;
      const text = document.createElement('span');
      text.textContent = eventText(event);
      row.append(at, text);
      netView.log.append(row);
    }
  }
}

/** One transmission, in a line a reader can follow. */
function eventText(event: { what: string; from: string; to: string[] }): string {
  const to = event.to[0];
  if (event.what === 'answer') return to ? `${event.from} answers ${to}` : `${event.from} answers`;
  if (event.what === 'signal') return to ? `${event.from} → ${to}` : `${event.from} speaks`;
  if (event.what === 'quiet') return `${event.from} lets it go by`;
  return `${event.from} ${event.what}`;
}

function paintEvents(): void {
  const pane = $('pane-events');
  pane.textContent = '';
  if (!loaded.trace) {
    for (const e of loaded.show.events) {
      const row = document.createElement('div');
      row.className = 'event';
      const at = `${e.at[0]}.${Number(e.at[1].toFixed(2))}`;
      const cmds = Object.entries(e)
        .filter(([k]) => k !== 'at')
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' · ');
      row.innerHTML = `<span class="t">${at}</span><span class="what">${escapeHtml(cmds)}</span>`;
      pane.append(row);
    }
    return;
  }
  for (const e of loaded.trace.events) {
    const type = eventType(e);
    const row = document.createElement('div');
    row.className = `event ${type}`;
    const to = e.to.length ? ' → ' + e.to.join(', ') : '';
    const who = e.from ?? e.neuron ?? 'run';
    const line = payloadLine(e.payload) ?? (e.reason ?? e.message ?? '');
    row.innerHTML =
      `<span class="t">${e.t}ms</span>` +
      `<span class="what"><b>${escapeHtml(type)}</b> ${escapeHtml(who)}${escapeHtml(to)}` +
      (line ? `<em>${escapeHtml(line)}</em>` : '') +
      '</span>';
    pane.append(row);
  }
}

function select(id: string): void {
  selected = id;
  for (const row of document.querySelectorAll<HTMLElement>('.cast-row')) {
    row.classList.toggle('on', row.dataset.actor === id);
  }
}

function setStatus(text: string): void {
  source.textContent = text || (loaded ? loaded.label : '');
  source.classList.toggle('bad', !!text);
}

// ── a click on the stage finds the character ──────────────────────────────
canvas.addEventListener('click', (event) => {
  const box = canvas.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * canvas.width;
  const y = ((event.clientY - box.top) / box.height) * canvas.height;
  const id = host.pick(x, y);
  if (id) select(id);
});

// ── transport ─────────────────────────────────────────────────────────────
playButton.addEventListener('click', () => host.toggle());
scrub.addEventListener('input', () => host.seek(Number(scrub.value)));
speed.addEventListener('change', () => {
  host.speed = Number(speed.value) || 1;
});
lineSelect.addEventListener('change', () => {
  lineMode = lineSelect.value === 'caption' ? 'caption' : 'bubbles';
  localStorage.setItem('stage.lines', lineMode);
  bubbles.clear();
  showLine(last.who, last.text); // move the line that is showing to the other surface
});
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === 'file') return;
  if (event.code === 'Space') {
    event.preventDefault();
    host.toggle();
  }
});

// ── panes ─────────────────────────────────────────────────────────────────
for (const tab of document.querySelectorAll<HTMLButtonElement>('.tabs button')) {
  tab.addEventListener('click', () => {
    const name = tab.dataset.pane;
    for (const other of document.querySelectorAll<HTMLButtonElement>('.tabs button')) {
      other.setAttribute('aria-selected', String(other === tab));
    }
    for (const pane of document.querySelectorAll<HTMLElement>('.pane')) {
      pane.classList.toggle('on', pane.id === `pane-${name}`);
    }
  });
}

// ── opening a file: a trace compiles, a score plays ───────────────────────
file.addEventListener('change', async () => {
  const picked = file.files?.[0];
  if (!picked) return;
  try {
    const text = await picked.text();
    if (/\.json$/i.test(picked.name)) {
      const trace = parseTrace(JSON.parse(text));
      selected = '';
      load({ ...showOf(trace, trace.demo), label: `${picked.name}: a trace of ${trace.demo}, compiled` });
    } else {
      const show = parseShow(text, { title: picked.name.replace(/\.[^.]+$/, '') });
      selected = '';
      load({ show, label: `${picked.name}: a score, played as it is` });
    }
    host.play();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    file.value = '';
  }
});

// ── the stage's own canvas size: fill the box, keep 16:9 ──────────────────
function fit(): void {
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const ratio = 16 / 9;
  let width = wrap.clientWidth;
  let height = width / ratio;
  if (height > wrap.clientHeight) {
    height = wrap.clientHeight;
    width = height * ratio;
  }
  width = Math.max(320, Math.floor(width));
  height = Math.max(180, Math.floor(width / ratio));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  if (host) host.stage.dirty = true;
}
window.addEventListener('resize', fit);
new ResizeObserver(fit).observe(canvas.parentElement ?? document.body);

// ── boot ──────────────────────────────────────────────────────────────────
interface Item {
  key: string;
  group: string;
  title: string;
  /** One line for the list; also the show's note in the score pane. */
  note?: string;
  text?: string;
  json?: unknown;
  /** The skin the ground is painted in, when the show is more than one hand. */
  skin?: string;
  /** What each neuron's mind is: a model, a table, a network. Not in the trace. */
  via?: string;
}

const BUNDLED: Item[] = [
  { key: 'duet', group: 'a run, compiled', title: 'duet', note: 'two characters, a real run of examples/duet', json: duetTrace },
  { key: 'alerts', group: 'a run, compiled', title: 'alerts', note: 'a recording of the alert storm (agent-neuron)', json: alertsTrace },
  { key: 'troupe', group: 'a run, compiled', title: 'troupe', note: 'six characters, six neurons, six skins (examples/troupe)', json: troupeTrace, via: 'a table in mind/tell.mjs' },
  { key: 'lab', group: 'a run, compiled', title: 'the lab', note: 'seven scientists, no taking turns, a model in each (examples/lab)', json: labTrace, skin: 'laboratory', via: 'glm-5.3-flash:cloud, a cloud model' },
  { key: 'writer', group: "a network's answer", title: 'writer', note: 'a scene a network wrote (examples/writer)', text: writerScene },
  ...SCENES.map((scene) => ({
    key: `scene:${scene.key}`,
    group: 'scenes, one file each',
    title: scene.title,
    note: scene.note,
    text: scene.text
  }))
];
{
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const item of BUNDLED) {
    let group = groups.get(item.group);
    if (!group) {
      group = document.createElement('optgroup');
      group.label = item.group;
      groups.set(item.group, group);
      picker.append(group);
    }
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = `${item.title} — ${item.note ?? ''}`.replace(/ — $/, '');
    group.append(option);
  }
}
const itemOf = (key: string): Item => BUNDLED.find((b) => b.key === key) ?? BUNDLED[0]!;

function loadBundled(key: string): void {
  const item = itemOf(key);
  selected = '';
  picker.value = item.key;
  if (item.text) {
    // a score document: a network's answer, or a scene written by hand
    const show = parseShow(item.text, { title: item.title, note: item.note });
    load({ show, label: `${item.title}: ${show.events.length} score events, played as it is` });
    return;
  }
  const trace = parseTrace(item.json);
  load({ ...showOf(trace, `${item.title}: ${item.note ?? ''}`.replace(/: $/, ''), item.skin, item.via), label: `${item.title}: ${trace.events.length} events` });
}

/** The next or previous show in the list, for reading the book straight through. */
function step(delta: number): void {
  const at = BUNDLED.findIndex((b) => b.key === picker.value);
  const next = BUNDLED[(at + delta + BUNDLED.length) % BUNDLED.length]!;
  loadBundled(next.key);
  if (host) host.play();
}

picker.addEventListener('change', () => loadBundled(picker.value));
window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) return;
  if (event.key === 'n') step(1);
  else if (event.key === 'p') step(-1);
});

const first = parseTrace(BUNDLED[0]!.json);
host = new ShowHost(canvas, compileTrace(first, { title: first.demo }), {
  onLine: showLine,
  onCard(text) {
    card.hidden = !text;
    card.textContent = text ?? '';
    if (text) bubbles.clear();
  },
  onFrame(bar, beat, seconds) {
    clock.textContent = `${bar}.${Number(beat.toFixed(2))} · ${seconds.toFixed(1)}s`;
  },
  onUnknown(cmd) {
    console.info(`[stage] the score used "${cmd}", which this stage does not draw; ignored`);
  }
});
fit();
loadBundled('duet');

let previous = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.1, Math.max(0, (now - previous) / 1000));
  previous = now;
  host.tick(dt);
  // a bubble holds its second on the film's clock, and each follows its own head
  bubbles.tick(host.time);
  bubbles.place((id) => host.headOf(id));
  netLive(host.time);
  playButton.textContent = host.playing ? '❚❚' : '▶';
  playButton.setAttribute('aria-label', host.playing ? 'pause' : 'play');
  if (host.playing) scrub.value = String(host.time);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
