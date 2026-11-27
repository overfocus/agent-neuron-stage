// spike 004, round three: life. Characters with no script, each with an inner
// network run by the engine (life/cast/<who>.network.json, through
// life/bridge.mjs), and a camera that can follow their stories.
//
// The split:
//   the engine has the mind: seven drives (serve neurons that remember) and a will
//   the page has the body and the world: where everyone stands, who is near
//     whom, what is dark, where the food is; it tells each mind what happened
//     (a sense), and acts out what the will intends
//
// The page never reads a network file. It learns each network's shape from the
// live stream (a signal says which neuron sent to which), and each drive's level
// from that drive's answers.
import * as THREE from 'three';
import { besideOf, nearestOpen, tileAt, type Cell, type Grid } from './grid.ts';
import { FOOD, type Room } from './rooms.ts';

const BRIDGE = 'http://127.0.0.1:5292';

/** What life needs of a body (main.ts's Body has all of it). */
export interface LifeBody {
  readonly id: string;
  cell: Cell;
  readonly root: THREE.Object3D;
  walk: unknown;
  facing: string | null;
  heading: THREE.Vector2;
  pose(name: string, since: number, at: number): void;
  speak(): void;
  faceToward(target: THREE.Vector3, snap: boolean): void;
  head(): THREE.Vector3;
}

export type LifeLook = { kind: 'maxcot'; skin: string } | { kind: 'model'; model: string };

/** What life needs of the page. */
export interface World {
  grid(): Grid;
  room(): Room;
  bodies(): Map<string, LifeBody>;
  enter(id: string, who: string, cell: Cell, look: LifeLook): LifeBody;
  /** Walk on the wall clock at `pace` seconds a tile. False when there is no way. */
  walk(b: LifeBody, goal: Cell, pace: number): boolean;
  say(id: string, text: string, seconds: number): void;
  /** Point the camera at these bodies; [] is the whole room. */
  frame(ids: string[], framing: 'full' | 'medium' | 'wide'): void;
  occupied(except: string): Set<string>;
  project(v: THREE.Vector3): { x: number; y: number };
}

/** How each character of the cast is drawn. The mind says nothing about looks. */
const LOOKS: Record<string, { who: string; look: LifeLook; start: Cell }> = {
  mara: { who: 'max', look: { kind: 'model', model: 'robot' }, start: [9, 14] },
  kes: { who: 'teen', look: { kind: 'model', model: 'shadow' }, start: [24, 8] },
  tobin: { who: 'clerk', look: { kind: 'maxcot', skin: 'felttip' }, start: [5, 20] },
  wren: { who: 'girl', look: { kind: 'maxcot', skin: 'ballpoint' }, start: [6, 9] },
  oli: { who: 'oldman', look: { kind: 'maxcot', skin: 'riso' }, start: [12, 16] }
};

const DRIVES = ['hunger', 'loneliness', 'anger', 'resentment', 'fear', 'happiness', 'desire'] as const;
type Drive = (typeof DRIVES)[number];

interface Intent {
  intent: string;
  who?: string;
  to?: string;
  from?: string;
  why?: { drive: string; level: number };
  say?: string;
  pose?: string;
}

interface Mind {
  id: string;
  up: boolean;
  levels: Partial<Record<Drive, number>>;
  about: Partial<Record<Drive, string>>;
  grudges: Record<string, number>;
  intent: Intent;
  since: number;
  story: { t: number; text: string }[];
  /** the network as the stream has shown it: neurons, and links with when each last carried a signal */
  nodes: Set<string>;
  links: Map<string, number>;
  lit: Map<string, number>;
  // the body's side of acting on an intent
  arrived: boolean;
  lastPath: number;
  nextWander: number;
  doneAt: number;
  eating: number;
}

/** How much a story beat is worth watching, for the director. */
const DRAMA: Record<string, number> = { confront: 10, flee: 8, celebrate: 5, seek: 4, sulk: 3, go: 3, mope: 2, eat: 2, idle: 0 };

const STROLL = 0.55;
const RUN = 0.26;

export type CameraMode = 'director' | 'follow' | 'free';

export function createLife(world: World, panel: HTMLElement) {
  const minds = new Map<string, Mind>();
  let source: EventSource | null = null;
  let status = 'connecting to the minds…';
  let speed = 2;
  let paused = false;
  let lastTick = 0;
  let selected: string | null = null;
  let camera: CameraMode = 'director';
  let lead: { who: string; score: number; t: number } | null = null;
  let framed = '';
  const t0 = performance.now() / 1000;
  const clock = (): number => performance.now() / 1000;
  const tags = new Map<string, HTMLDivElement>();
  const tagLayer = document.createElement('div');
  tagLayer.className = 'tags';
  panel.parentElement!.append(tagLayer);

  // ── talking to the minds ───────────────────────────────────────────────────

  function inject(who: string, payload: Record<string, unknown>): void {
    const m = minds.get(who);
    if (!m?.up) return;
    void fetch(`${BRIDGE}/inject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ who, payload })
    }).catch(() => undefined);
  }

  function mindOf(id: string): Mind {
    let m = minds.get(id);
    if (!m) {
      m = {
        id, up: true, levels: {}, about: {}, grudges: {}, intent: { intent: 'idle' }, since: clock(), story: [],
        nodes: new Set(), links: new Map(), lit: new Map(), arrived: false, lastPath: 0, nextWander: 0, doneAt: 0, eating: 0
      };
      minds.set(id, m);
    }
    return m;
  }

  function hear(who: string, ev: { type: string; from?: string; to?: string[]; payload?: unknown }, live: boolean): void {
    const m = mindOf(who);
    if (ev.from) m.nodes.add(ev.from);
    if (ev.type === 'signal' && ev.from && Array.isArray(ev.to)) {
      for (const to of ev.to) {
        m.nodes.add(to);
        const key = `${ev.from}>${to}`;
        if (!m.links.has(key)) m.links.set(key, 0);
        if (live) m.lit.set(key, clock());
      }
      return;
    }
    if (ev.type !== 'answer' || !ev.payload || typeof ev.payload !== 'object') return;
    const p = ev.payload as Record<string, unknown>;
    if (typeof p.drive === 'string' && typeof p.level === 'number' && (DRIVES as readonly string[]).includes(p.drive)) {
      const d = p.drive as Drive;
      m.levels[d] = p.level;
      if (typeof p.about === 'string') m.about[d] = p.about;
      else delete m.about[d];
      if (d === 'resentment' && p.grudges && typeof p.grudges === 'object') {
        m.grudges = Object.fromEntries(Object.entries(p.grudges as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === 'number'));
      }
      return;
    }
    if (ev.from === 'will' && typeof p.intent === 'string') intend(m, p as unknown as Intent, live);
  }

  function connect(): void {
    source?.close();
    source = new EventSource(`${BRIDGE}/events`);
    source.onopen = () => (status = 'minds: live');
    source.onerror = () => {
      status = 'no minds: start them with  node spikes/004-iso-tiles/life/bridge.mjs';
      for (const m of minds.values()) m.up = false;
    };
    source.onmessage = (msg) => {
      let data: { hello?: { cast: { who: string; up: boolean }[]; last: Record<string, Record<string, { type: string; from?: string; payload?: unknown }>> }; who?: string; ev?: never; down?: boolean };
      try {
        data = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (data.hello) {
        for (const { who, up } of data.hello.cast) {
          mindOf(who).up = up;
          cast(who);
          for (const ev of Object.values(data.hello.last[who] ?? {})) hear(who, ev, false);
        }
        status = `minds: live (${data.hello.cast.length})`;
        return;
      }
      if (data.who && data.down) mindOf(data.who).up = false;
      if (data.who && data.ev) hear(data.who, data.ev, true);
    };
  }

  function cast(who: string): void {
    if (world.bodies().has(who)) return;
    const l = LOOKS[who] ?? { who: 'max', look: { kind: 'maxcot', skin: 'pencil' }, start: [8, 14] as Cell };
    const cell = nearestOpen(world.grid(), l.start, world.occupied(who)) ?? l.start;
    world.enter(who, l.who, cell, l.look);
  }

  // ── the senses: what the page tells every mind, once a (life) second ───────

  function near(a: LifeBody, b: LifeBody, r: number): boolean {
    return a.root.position.distanceTo(b.root.position) <= r;
  }

  function markAt(b: LifeBody): string | null {
    const room = world.room();
    for (const [name, [c, r]] of Object.entries(room.marks)) {
      if (Math.max(Math.abs(c - b.root.position.x), Math.abs(r - b.root.position.z)) <= 2.5) return name;
    }
    return null;
  }

  function tick(): void {
    const bodies = world.bodies();
    for (const [id, b] of bodies) {
      const company = [...bodies.values()].filter((o) => o !== b && near(b, o, 3.2)).map((o) => o.id);
      inject(id, { sense: 'tick', dt: speed, company, at: markAt(b), dark: b.root.position.x >= 18.5 });
    }
  }

  // ── the will, acted out ────────────────────────────────────────────────────

  function intend(m: Mind, next: Intent, live: boolean): void {
    m.intent = next;
    m.since = clock();
    m.arrived = false;
    m.lastPath = 0;
    const why = next.why && next.why.drive !== 'none' ? ` (${next.why.drive} ${next.why.level.toFixed(2)})` : '';
    const what = next.who ? ` ${next.who}` : next.to ? ` to ${next.to}` : next.from ? ` from ${next.from}` : '';
    m.story.unshift({ t: clock() - t0, text: `${next.intent}${what}${why}` });
    m.story.length = Math.min(m.story.length, 14);
    if (!live) return;
    const b = world.bodies().get(m.id);
    if (!b) return;
    if (next.pose) b.pose(next.pose, 0, 0);
    if (next.intent === 'celebrate') b.pose('Dance', 0, 0);
    if (next.intent === 'idle' || next.intent === 'seek' || next.intent === 'go') b.pose('rest', 0, 0);
    if (next.say) world.say(m.id, next.say, 3.5);
    const score = DRAMA[next.intent] ?? 0;
    if (score && (!lead || score >= lead.score || clock() - lead.t > 8)) lead = { who: m.id, score, t: clock() };
  }

  function nearestOf(cells: Cell[], from: THREE.Vector3): Cell {
    return cells.reduce((a, c) => (Math.hypot(c[0] - from.x, c[1] - from.z) < Math.hypot(a[0] - from.x, a[1] - from.z) ? c : a));
  }

  function besideCell(b: LifeBody, target: Cell): Cell | null {
    return besideOf(world.grid(), target, b.cell, world.occupied(b.id), [1, 1]);
  }

  function randomOpen(around: Cell, reach: number): Cell | null {
    const g = world.grid();
    for (let i = 0; i < 12; i++) {
      const c: Cell = [around[0] + Math.round((Math.random() * 2 - 1) * reach), around[1] + Math.round((Math.random() * 2 - 1) * reach)];
      if (tileAt(g, c[0], c[1])?.walk) return c;
    }
    return null;
  }

  /** A tile far from a threat (or, with none, out of the dark): the best of a few tries. */
  function refuge(b: LifeBody, from: LifeBody | null): Cell | null {
    const g = world.grid();
    let best: Cell | null = null;
    let score = -Infinity;
    for (let i = 0; i < 40; i++) {
      const c: Cell = [Math.floor(Math.random() * g.w), Math.floor(Math.random() * g.d)];
      if (!tileAt(g, c[0], c[1])?.walk) continue;
      const far = from ? Math.hypot(c[0] - from.root.position.x, c[1] - from.root.position.z) : 0;
      const lit = c[0] < 17 ? 6 : 0;
      const s = far + lit - Math.hypot(c[0] - b.cell[0], c[1] - b.cell[1]) * 0.15;
      if (s > score) {
        score = s;
        best = c;
      }
    }
    return best;
  }

  function act(m: Mind, b: LifeBody, now: number): void {
    const bodies = world.bodies();
    const i = m.intent;
    const walking = !!b.walk;
    const other = i.who ? bodies.get(i.who) : undefined;
    switch (i.intent) {
      case 'idle':
      case 'mope':
        if (!walking && now > m.nextWander) {
          const goal = randomOpen(b.cell, i.intent === 'mope' ? 2 : 5);
          if (goal) world.walk(b, goal, i.intent === 'mope' ? STROLL * 1.8 : STROLL);
          m.nextWander = now + 5 + Math.random() * 8;
        }
        return;
      case 'eat': {
        const table = nearestOf(FOOD, b.root.position);
        const close = Math.hypot(table[0] - b.root.position.x, table[1] - b.root.position.z) <= 1.6;
        if (!close) {
          if (!walking && now - m.lastPath > 3) {
            const goal = besideCell(b, table);
            if (goal) world.walk(b, goal, STROLL);
            m.lastPath = now;
          }
          return;
        }
        if (walking) return;
        if (!m.eating) {
          m.eating = now;
          b.faceToward(new THREE.Vector3(table[0], 0, table[1]), false);
          b.pose('Sitting', 0, 0);
          world.say(m.id, 'Bread. Finally.', 2.5);
        } else if (now - m.eating > 3) {
          m.eating = 0;
          b.pose('Standing', 0, 0);
          inject(m.id, { sense: 'ate' });
          m.lastPath = now + 4; // stay at the table while the mind digests it
        }
        return;
      }
      case 'seek':
      case 'confront': {
        // to someone: the friend the will names, or the nearest body
        let target = other;
        if (!target && i.intent === 'seek') {
          target = [...bodies.values()].filter((o) => o !== b).sort((x, y) => x.root.position.distanceTo(b.root.position) - y.root.position.distanceTo(b.root.position))[0];
        }
        if (i.intent === 'confront' && i.who === 'you') {
          // a grudge against the audience: it turns to the camera and says so
          // (again, while the anger lasts: saying it is what lets it go)
          if (walking || now - m.doneAt < 8) return;
          m.doneAt = now;
          b.heading.set(1, 1);
          b.pose('point-you', 0, 0);
          world.say(m.id, m.arrived ? 'I am still talking to you.' : 'And you. Yes, you. I saw what you did.', 4);
          m.arrived = true;
          inject(m.id, { sense: 'vented', at: 'you' });
          return;
        }
        if (!target) return;
        const dist = target.root.position.distanceTo(b.root.position);
        if (dist > 1.7) {
          if (now - m.lastPath > (walking ? 3 : 0.5)) {
            const goal = besideCell(b, target.cell);
            if (goal) world.walk(b, goal, i.intent === 'confront' ? STROLL * 0.8 : STROLL);
            m.lastPath = now;
          }
          return;
        }
        if (walking || now - m.doneAt < (i.intent === 'confront' ? 10 : 8)) return;
        m.doneAt = now;
        b.facing = target.id;
        target.facing = b.id;
        b.faceToward(target.root.position, false);
        target.faceToward(b.root.position, false);
        if (i.intent === 'seek') {
          b.pose('wave', 0, 0);
          world.say(m.id, `There you are, ${target.id}.`, 3);
          const them = minds.get(target.id);
          const cross = them && (['sulk', 'confront', 'mope', 'flee'].includes(them.intent.intent) || (them.levels.anger ?? 0) >= 0.5);
          if (cross) {
            // reaching out to someone in a bad way: a snub, and the snub is remembered (this is where feuds start)
            setTimeout(() => {
              target.pose('stop', 0, 0);
              world.say(target.id, 'Not now. Go away.', 3);
              inject(m.id, { sense: 'hurt', from: target.id });
            }, 1200);
          } else {
            inject(m.id, { sense: 'kind', from: target.id });
            inject(target.id, { sense: 'kind', from: m.id });
          }
        } else {
          b.pose('fists', 0, 0);
          world.say(m.id, `You hurt me, ${target.id}. I want you to know it.`, 4);
          inject(target.id, { sense: 'hurt', from: m.id });
          inject(m.id, { sense: 'vented', at: target.id });
          target.pose('recoil', 0, 0);
        }
        return;
      }
      case 'flee': {
        const threat = i.from ? bodies.get(i.from) ?? null : null;
        const close = threat ? threat.root.position.distanceTo(b.root.position) < 5 : b.root.position.x >= 17;
        if (!walking && close && now - m.lastPath > 1.5) {
          const goal = refuge(b, threat);
          if (goal) world.walk(b, goal, RUN);
          m.lastPath = now;
        }
        return;
      }
      case 'go': {
        const mark = i.to ? world.room().marks[i.to] : undefined;
        if (!mark) return;
        const there = Math.hypot(mark[0] - b.root.position.x, mark[1] - b.root.position.z) <= 2;
        if (there) {
          // being there is the point: a small wander inside it
          if (!walking && now > m.nextWander) {
            const goal = randomOpen(mark, 2);
            if (goal) world.walk(b, goal, STROLL * 1.6);
            m.nextWander = now + 6 + Math.random() * 6;
          }
          return;
        }
        if (!walking && now - m.lastPath > 3) {
          const goal = nearestOpen(world.grid(), mark, world.occupied(b.id));
          if (goal) world.walk(b, goal, STROLL);
          m.lastPath = now;
        }
        return;
      }
      case 'celebrate': {
        if (now - m.doneAt < 10) return;
        m.doneAt = now;
        for (const o of bodies.values()) if (o !== b && near(b, o, 3.2)) inject(o.id, { sense: 'kind', from: m.id });
        return;
      }
      case 'sulk':
        // it stands where it is, turned away from everyone
        if (!m.arrived) {
          m.arrived = true;
          b.heading.set(-1, -1);
        }
        return;
    }
  }

  // ── the camera: whose story is on screen ───────────────────────────────────

  function direct(now: number): string {
    const bodies = world.bodies();
    if (camera === 'free') return 'camera: yours';
    let who: string | null = null;
    if (camera === 'follow') who = selected && bodies.has(selected) ? selected : null;
    else {
      // the director: whoever's story has the most drama now, held for a while before it cuts
      if (lead && (DRAMA[minds.get(lead.who)?.intent.intent ?? 'idle'] ?? 0) === 0 && now - lead.t > 6) lead = null;
      if (!lead) {
        const best = [...minds.values()].filter((m) => bodies.has(m.id)).sort((a, b) => (DRAMA[b.intent.intent] ?? 0) - (DRAMA[a.intent.intent] ?? 0) || b.since - a.since)[0];
        if (best && (DRAMA[best.intent.intent] ?? 0) > 0) lead = { who: best.id, score: DRAMA[best.intent.intent] ?? 0, t: now };
      }
      who = lead?.who ?? null;
    }
    if (!who) {
      if (framed !== 'whole') world.frame([], 'wide');
      framed = 'whole';
      return camera === 'follow' ? 'camera: pick someone to follow' : 'camera: nothing happening, the whole room';
    }
    const m = minds.get(who);
    const ids = [who];
    const with_ = m?.intent.who ?? m?.intent.from;
    if (with_ && bodies.has(with_) && with_ !== who) ids.push(with_);
    const key = ids.join('+');
    if (key !== framed) world.frame(ids, ids.length > 1 ? 'medium' : 'full');
    framed = key;
    return `camera: ${camera === 'follow' ? 'following' : 'the director is on'} ${who}'s story${ids[1] ? ` (with ${ids[1]})` : ''}`;
  }

  // ── the panel ──────────────────────────────────────────────────────────────

  const el = (tag: string, cls?: string, text?: string): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  panel.replaceChildren();
  const statusEl = el('div', 'status');
  const cameraRow = el('div', 'row');
  const camButtons = (['director', 'follow', 'free'] as CameraMode[]).map((mode) => {
    const btn = el('button', '', mode) as HTMLButtonElement;
    btn.addEventListener('click', () => {
      camera = mode;
      framed = '';
    });
    cameraRow.append(btn);
    return { mode, btn };
  });
  const speedRow = el('div', 'row');
  speedRow.append(el('span', 'dim', 'life speed'));
  const speedButtons = [1, 2, 4].map((s) => {
    const btn = el('button', '', `${s}×`) as HTMLButtonElement;
    btn.addEventListener('click', () => (speed = s));
    speedRow.append(btn);
    return { s, btn };
  });
  const castRow = el('div', 'cast');
  const who = el('div', 'who');
  const intentEl = el('div', 'intent');
  const bars = el('div', 'bars');
  const barEls = new Map<Drive, { fill: HTMLElement; value: HTMLElement }>();
  for (const d of DRIVES) {
    const row = el('div', 'bar');
    const fill = el('i');
    const track = el('span', 'track');
    track.append(fill);
    const value = el('span', 'v');
    row.append(el('span', 'k', d), track, value);
    bars.append(row);
    barEls.set(d, { fill, value });
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  const net = document.createElementNS(svgNS, 'svg');
  net.setAttribute('viewBox', '0 0 280 170');
  net.classList.add('net');
  const pokes = el('div', 'row pokes');
  const POKES: [string, string, Record<string, unknown>][] = [
    ['feed', 'you gave them bread', { sense: 'ate' }],
    ['be kind', 'you were kind', { sense: 'kind', from: 'you' }],
    ['insult', 'you insulted them', { sense: 'hurt', from: 'you' }],
    ['scare', 'you scared them', { sense: 'scare', from: 'you' }],
    ['apologise', 'you said sorry', { sense: 'apology', from: 'you' }]
  ];
  for (const [label, note, payload] of POKES) {
    const btn = el('button', '', label);
    btn.addEventListener('click', () => {
      if (!selected) return;
      inject(selected, payload);
      const m = minds.get(selected);
      m?.story.unshift({ t: clock() - t0, text: `· ${note}` });
    });
    pokes.append(btn);
  }
  const storyEl = el('ol', 'story');
  panel.append(statusEl, cameraRow, speedRow, castRow, who, intentEl, bars, net, el('div', 'dim', 'poke them:'), pokes, el('div', 'dim', 'their story, newest first:'), storyEl);

  /** Where each neuron sits in the drawing: senses on the left, the will on the right, the drives between. */
  function layout(id: string): [number, number] {
    if (id === 'senses') return [22, 85];
    if (id === 'will') return [258, 85];
    const i = (DRIVES as readonly string[]).indexOf(id);
    const n = DRIVES.length;
    const a = ((i < 0 ? n : i) / n) * Math.PI * 2 - Math.PI / 2;
    return [140 + Math.cos(a) * 62, 85 + Math.sin(a) * 66];
  }

  function drawNet(m: Mind, now: number): void {
    net.replaceChildren();
    for (const key of m.links.keys()) {
      const [a, b] = key.split('>') as [string, string];
      const [x1, y1] = layout(a);
      const [x2, y2] = layout(b);
      const glow = Math.max(0, 1 - (now - (m.lit.get(key) ?? -9)) / 0.8);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', glow > 0 ? `rgba(255,214,110,${0.25 + glow * 0.75})` : 'rgba(160,170,190,0.18)');
      line.setAttribute('stroke-width', String(1 + glow * 1.5));
      net.append(line);
    }
    for (const id of m.nodes) {
      const [x, y] = layout(id);
      const level = (m.levels as Record<string, number>)[id];
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      c.setAttribute('r', String(id === 'senses' || id === 'will' ? 11 : 8 + (level ?? 0) * 8));
      c.setAttribute('fill', id === 'will' ? '#6c8f45' : id === 'senses' ? '#4f6a8a' : `rgba(220,${Math.round(150 - (level ?? 0) * 110)},90,${0.35 + (level ?? 0) * 0.65})`);
      net.append(c);
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', String(x));
      t.setAttribute('y', String(y + (id === 'senses' || id === 'will' ? 24 : 20)));
      t.setAttribute('text-anchor', 'middle');
      t.textContent = id;
      net.append(t);
    }
  }

  let lastPanel = 0;
  function drawPanel(now: number, camLine: string): void {
    if (now - lastPanel < 0.12) return;
    lastPanel = now;
    statusEl.textContent = `${status} · ${camLine}`;
    for (const { mode, btn } of camButtons) btn.setAttribute('aria-pressed', String(mode === camera));
    for (const { s, btn } of speedButtons) btn.setAttribute('aria-pressed', String(s === speed));
    // the cast, each with what it means to do
    if (castRow.childElementCount !== minds.size) {
      castRow.replaceChildren();
      for (const id of minds.keys()) {
        const btn = el('button', '', id);
        btn.dataset.who = id;
        btn.addEventListener('click', () => select(id));
        castRow.append(btn);
      }
    }
    for (const btn of castRow.querySelectorAll<HTMLButtonElement>('button')) {
      const m = minds.get(btn.dataset.who!);
      btn.textContent = `${btn.dataset.who} · ${m?.intent.intent ?? '…'}`;
      btn.setAttribute('aria-pressed', String(btn.dataset.who === selected));
    }
    const m = selected ? minds.get(selected) : undefined;
    for (const part of [who, intentEl, bars, net, pokes, storyEl]) (part as HTMLElement).style.display = m ? '' : 'none';
    if (!m) return;
    who.textContent = `${m.id}${m.up ? '' : ' (mind down)'}`;
    const i = m.intent;
    intentEl.textContent = `means to ${i.intent}${i.who ? ` ${i.who}` : ''}${i.to ? ` (to ${i.to})` : ''}${i.from ? ` (from ${i.from})` : ''}` + (i.why && i.why.drive !== 'none' ? ` because ${i.why.drive} is ${i.why.level.toFixed(2)}` : '');
    for (const d of DRIVES) {
      const v = m.levels[d];
      const { fill, value } = barEls.get(d)!;
      fill.style.width = `${Math.round((v ?? 0) * 100)}%`;
      const about = d === 'resentment'
        ? Object.entries(m.grudges).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, g]) => `${k} ${g.toFixed(2)}`).join(', ')
        : m.about[d] ?? '';
      value.textContent = v === undefined ? '…' : `${v.toFixed(2)}${about ? ` ${about}` : ''}`;
    }
    drawNet(m, now);
    storyEl.replaceChildren(...m.story.map((s) => el('li', '', `${Math.floor(s.t / 60)}:${String(Math.floor(s.t % 60)).padStart(2, '0')}  ${s.text}`)));
  }

  function select(id: string | null): void {
    selected = id;
    if (camera === 'follow') framed = '';
  }

  function drawTags(): void {
    for (const [id, b] of world.bodies()) {
      let tag = tags.get(id);
      if (!tag) {
        tag = el('div', 'tag') as HTMLDivElement;
        tagLayer.append(tag);
        tags.set(id, tag);
      }
      const p = world.project(b.root.position);
      tag.style.left = `${p.x}px`;
      tag.style.top = `${p.y}px`;
      tag.textContent = `${id} · ${minds.get(id)?.intent.intent ?? ''}`;
      tag.classList.toggle('on', id === selected);
    }
  }

  connect();

  return {
    get selected() {
      return selected;
    },
    select,
    get paused() {
      return paused;
    },
    set paused(v: boolean) {
      paused = v;
    },
    frame(): string {
      const now = clock();
      if (!paused && now - lastTick >= 1) {
        lastTick = now;
        tick();
      }
      for (const m of minds.values()) {
        const b = world.bodies().get(m.id);
        if (b && !paused) act(m, b, now);
      }
      const camLine = direct(now);
      drawPanel(now, camLine);
      drawTags();
      return camLine;
    },
    stop(): void {
      source?.close();
      source = null;
      tagLayer.remove();
      panel.replaceChildren();
    }
  };
}

export type Life = ReturnType<typeof createLife>;
