// spike 004: the tile room, and how a character finds its way across it.
//
// Pure: no three.js, no DOM. A room is a few rows of text, a path is A* over
// it, and a walk is a position along that path at a fraction of its length.
// If the verdict is adopted this is the part that moves into the compiler
// (src/), with tests, because where a character goes is a decision about the
// show, not about the picture.

/** What a tile is made of: the page colours it, the path only cares whether it is open. */
export type Surface = 'stone' | 'grass' | 'earth' | 'path' | 'wood' | 'wall' | 'hedge' | 'water' | 'black';

/** One tile: how high its top is (in steps), and whether a body can stand on it. */
export interface Tile {
  kind: 'floor' | 'wall' | 'water';
  surface: Surface;
  /** Height of the tile's top in steps (0..3). A wall is a tall block. */
  h: number;
  walk: boolean;
}

/** The text of a room: one character per tile. */
const LEGEND: Record<string, Omit<Tile, 'h'> & { h?: number }> = {
  '.': { kind: 'floor', surface: 'stone', walk: true },
  ',': { kind: 'floor', surface: 'grass', walk: true },
  ':': { kind: 'floor', surface: 'earth', walk: true },
  '=': { kind: 'floor', surface: 'path', walk: true },
  b: { kind: 'floor', surface: 'wood', walk: true },
  '#': { kind: 'wall', surface: 'wall', walk: false, h: 3 },
  '^': { kind: 'wall', surface: 'hedge', walk: false, h: 2 },
  '~': { kind: 'water', surface: 'water', walk: false },
  '*': { kind: 'water', surface: 'black', walk: false }
};

export interface Grid {
  /** Columns (x). */
  w: number;
  /** Rows (z, into the picture). */
  d: number;
  tiles: Tile[];
}

export type Cell = [number, number];

/**
 * A room from rows of text, one character per tile:
 * `.` stone, `0`..`3` stone at that height, `,` grass, `:` earth, `=` a path,
 * `b` wood (a bridge), `#` a wall, `^` a hedge, `~` water, `*` black water.
 * Anything else is stone, and short rows are padded with it, so a room is
 * always a rectangle.
 */
export function parseGrid(rows: string[]): Grid {
  const w = Math.max(...rows.map((r) => r.length));
  const d = rows.length;
  const tiles: Tile[] = [];
  for (const row of rows) {
    for (let c = 0; c < w; c++) {
      const ch = row[c] ?? '.';
      if (ch >= '0' && ch <= '3') tiles.push({ kind: 'floor', surface: 'stone', h: Number(ch), walk: true });
      else {
        const t = LEGEND[ch] ?? LEGEND['.']!;
        tiles.push({ ...t, h: t.h ?? 0 });
      }
    }
  }
  return { w, d, tiles };
}

/** Close tiles a prop stands on (a column, a tree): a path goes round them. */
export function block(g: Grid, cells: Cell[]): void {
  for (const [c, r] of cells) {
    const t = tileAt(g, c, r);
    if (t) t.walk = false;
  }
}

/**
 * The open tile beside a target that is nearest to the one walking there: where
 * you stand to talk to someone. Null when every side of them is closed.
 *
 * `depth` is the camera's direction across the floor (iso looks down (1, 1)).
 * When it is given, a side ACROSS the picture beats a side in front or behind,
 * because two bodies one behind the other along the line of sight are one body
 * on screen: "beside" is beside as the audience sees it.
 */
export function besideOf(g: Grid, target: Cell, from: Cell, blocked: Set<string> = new Set(), depth?: Cell): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  const here = tileAt(g, target[0], target[1]);
  for (const [dc, dr] of STEPS8) {
    const c = target[0] + dc;
    const r = target[1] + dr;
    const t = tileAt(g, c, r);
    if (!t?.walk || blocked.has(key(c, r))) continue;
    if (here && Math.abs(t.h - here.h) > 1) continue;
    const along = depth ? Math.abs(dc * depth[0] + dr * depth[1]) / Math.hypot(depth[0], depth[1]) : 0;
    const d = Math.hypot(c - from[0], r - from[1]) + (dc && dr ? 0.01 : 0) + along * 6; // across the picture first, then near, then a side before a corner
    if (d < bestD) {
      bestD = d;
      best = [c, r];
    }
  }
  return best;
}

export function tileAt(g: Grid, c: number, r: number): Tile | undefined {
  if (c < 0 || r < 0 || c >= g.w || r >= g.d) return undefined;
  return g.tiles[r * g.w + c];
}

const key = (c: number, r: number): string => `${c},${r}`;

/** The open tile nearest to a cell (itself if it is open), breadth first; ties go to the first found. */
export function nearestOpen(g: Grid, at: Cell, blocked: Set<string> = new Set()): Cell | null {
  const [c0, r0] = [clampInt(at[0], 0, g.w - 1), clampInt(at[1], 0, g.d - 1)];
  const seen = new Set([key(c0, r0)]);
  const queue: Cell[] = [[c0, r0]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    if (tileAt(g, c, r)?.walk && !blocked.has(key(c, r))) return [c, r];
    for (const [dc, dr] of STEPS4) {
      const n: Cell = [c + dc, r + dr];
      if (!tileAt(g, n[0], n[1]) || seen.has(key(n[0], n[1]))) continue;
      seen.add(key(n[0], n[1]));
      queue.push(n);
    }
  }
  return null;
}

const STEPS4: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const STEPS8: Cell[] = [...STEPS4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

export interface PathOptions {
  /** The highest step a body climbs in one tile. Default 1. */
  climb?: number;
  /** Tiles another body stands on: avoided, but the goal may still be one of them's neighbour. */
  blocked?: Set<string>;
}

/**
 * A* from one tile to another, eight ways, never cutting a corner past a wall,
 * never climbing more than `climb` in one step. Deterministic: the same room
 * and the same two tiles give the same path. A goal that is not open is
 * replaced by the open tile nearest to it. Returns the tiles walked, start
 * first, or null when nothing connects them.
 */
export function findPath(g: Grid, from: Cell, to: Cell, o: PathOptions = {}): Cell[] | null {
  const climb = o.climb ?? 1;
  const blocked = o.blocked ?? new Set<string>();
  const goal = nearestOpen(g, to, blocked);
  if (!goal || !tileAt(g, from[0], from[1])) return null;
  if (goal[0] === from[0] && goal[1] === from[1]) return [from];

  const h = (c: number, r: number): number => {
    const dx = Math.abs(c - goal[0]);
    const dz = Math.abs(r - goal[1]);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); // octile
  };
  const open: { c: number; r: number; f: number; g: number; n: number }[] = [{ c: from[0], r: from[1], f: h(from[0], from[1]), g: 0, n: 0 }];
  const best = new Map<string, number>([[key(from[0], from[1]), 0]]);
  const came = new Map<string, string>();
  let order = 1;
  while (open.length) {
    // the smallest f, and among equals the earliest pushed: a stable order
    let i = 0;
    for (let j = 1; j < open.length; j++) if (open[j]!.f < open[i]!.f || (open[j]!.f === open[i]!.f && open[j]!.n < open[i]!.n)) i = j;
    const cur = open.splice(i, 1)[0]!;
    if (cur.c === goal[0] && cur.r === goal[1]) return walkBack(came, goal);
    if (cur.g > (best.get(key(cur.c, cur.r)) ?? Infinity)) continue;
    const here = tileAt(g, cur.c, cur.r)!;
    for (const [dc, dr] of STEPS8) {
      const c = cur.c + dc;
      const r = cur.r + dr;
      const t = tileAt(g, c, r);
      if (!t || !t.walk || blocked.has(key(c, r))) continue;
      if (Math.abs(t.h - here.h) > climb) continue;
      if (dc && dr) {
        // a diagonal only between two open sides, or it clips a wall's corner
        const a = tileAt(g, cur.c + dc, cur.r);
        const b = tileAt(g, cur.c, cur.r + dr);
        if (!a?.walk || !b?.walk || Math.abs(a.h - here.h) > climb || Math.abs(b.h - here.h) > climb) continue;
      }
      const step = (dc && dr ? Math.SQRT2 : 1) + Math.abs(t.h - here.h) * 0.5; // a climb costs a little
      const gNext = cur.g + step;
      if (gNext >= (best.get(key(c, r)) ?? Infinity)) continue;
      best.set(key(c, r), gNext);
      came.set(key(c, r), key(cur.c, cur.r));
      open.push({ c, r, g: gNext, f: gNext + h(c, r), n: order++ });
    }
  }
  return null;
}

function walkBack(came: Map<string, string>, goal: Cell): Cell[] {
  const out: Cell[] = [goal];
  let k = key(goal[0], goal[1]);
  while (came.has(k)) {
    k = came.get(k)!;
    const [c, r] = k.split(',').map(Number) as Cell;
    out.unshift([c, r]);
  }
  return out;
}

/** How long a path is, in tiles walked (a diagonal is √2). */
export function pathLength(path: Cell[]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]);
  return n;
}

/** Where on a path a body is at fraction p (0..1) of its length, eased so it starts and stops like a person. */
export function along(g: Grid, path: Cell[], p: number): { x: number; z: number; h: number; dx: number; dz: number } {
  const t = Math.min(1, Math.max(0, p));
  const e = t * t * (3 - 2 * t);
  const total = pathLength(path);
  const first = path[0]!;
  if (path.length < 2 || total === 0) return { x: first[0], z: first[1], h: tileAt(g, first[0], first[1])?.h ?? 0, dx: 0, dz: 0 };
  let left = e * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= seg || i === path.length - 1) {
      const f = seg === 0 ? 1 : Math.min(1, left / seg);
      const ha = tileAt(g, a[0], a[1])?.h ?? 0;
      const hb = tileAt(g, b[0], b[1])?.h ?? 0;
      // the step up happens in the middle of the move between two tiles
      const hf = f < 0.35 ? 0 : f > 0.65 ? 1 : (f - 0.35) / 0.3;
      return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, h: ha + (hb - ha) * hf, dx: b[0] - a[0], dz: b[1] - a[1] };
    }
    left -= seg;
  }
  const last = path[path.length - 1]!;
  return { x: last[0], z: last[1], h: tileAt(g, last[0], last[1])?.h ?? 0, dx: 0, dz: 0 };
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
