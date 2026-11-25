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
const last = { who: '', text: '' };

let host: ShowHost;
let loaded: Loaded;
let selected = '';

/** Show a line the way the reader asked for it; an empty text clears both surfaces. */
function showLine(who: string, text: string): void {
  last.who = who;
  last.text = text;
  bubbles.clear();
  caption.classList.remove('said');
  caption.textContent = '';
  if (!text) return;
  if (who) select(who);
  if (lineMode === 'bubbles' && who) {
    bubbles.say(who, text);
    return;
  }
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
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'cast-row' + (actor.id === selected ? ' on' : '');
    row.dataset.actor = actor.id;
    row.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'cast-id';
    name.textContent = actor.id;
    const kind = document.createElement('span');
    kind.className = 'cast-kind';
    kind.textContent = actor.kind;
    const play = document.createElement('span');
    play.className = 'cast-who';
    play.textContent = `${actor.who} · ${actor.weight.toFixed(2)}`;
    row.append(name, kind, play);
    if (actor.note) {
      const note = document.createElement('span');
      note.className = 'cast-note';
      note.textContent = actor.note;
      row.append(note);
    }
    row.addEventListener('click', () => select(actor.id));
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
  const chart = netOf(loaded.trace, { via: loaded.via });
  const NS = 'http://www.w3.org/2000/svg';
  const W = 340;
  const H = 300;
  const pad = 10;
  const at = (x: number, y: number) => ({ x: pad + x * (W - pad * 2), y: pad + y * (H - pad * 2) });
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

  for (const edge of chart.edges) {
    const from = place.get(edge.from);
    const to = place.get(edge.to);
    if (!from || !to) continue;
    const a = chart.nodes.find((n) => n.id === edge.from)!;
    const b = chart.nodes.find((n) => n.id === edge.to)!;
    svg.append(line(from, to, radius(a.kind), radius(b.kind), 'net-edge', true));
  }

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
  }

  note.textContent = chart.mind
    ? `every neuron but the source talks to ${chart.mind.label}`
    : 'the trace does not say what a neuron’s mind runs — a model is not part of a trace';
  pane.append(svg, note);
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
  { key: 'lab', group: 'a run, compiled', title: 'the lab', note: 'seven scientists, no taking turns, a model in each (examples/lab)', json: labTrace, skin: 'stencil', via: 'glm-5.3-flash:cloud, a cloud model' },
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
  if (bubbles.speaker) bubbles.place(host.headOf(bubbles.speaker));
  playButton.textContent = host.playing ? '❚❚' : '▶';
  playButton.setAttribute('aria-label', host.playing ? 'pause' : 'play');
  if (host.playing) scrub.value = String(host.time);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
