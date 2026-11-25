// labskin.ts: the lab's own ground.
//
// maxcot paints a show's ground through its skin, and the stage's own skins are
// paper, print, screens - none of them a laboratory. So the stage has one more
// ground, here, and nothing else about the skin is ours: the figures are drawn
// by maxcot's pencil, and a character that names its own skin is composited by
// the host as usual.
//
// The room is drawn in the stage's own projection, not on a flat backdrop. A
// member's camera says where its feet are (cam.cy), how wide a world unit is
// (cam.unit over the depth scale) and where x = 0 lands (cam.cx - x * unit), so
// the floor, the walls and the bench are built from the same numbers that stand
// the cast: a character's feet are on the floor it stands on, at the depth it
// stands at, and a bench drawn behind it stays behind it. `Room` is that
// projection; `roomOf` reads it off one actor's scene; the host hands it to
// `setRoom` before a ground is painted, because a ground is given no camera.
import type { Ctx2D, Scene, Skin } from 'maxcot';
import { skinsByName } from 'maxcot/skins';

/** The name a show gives this ground: `skin: "laboratory"`. */
export const LABORATORY = 'laboratory';

/** A show's skin by name: maxcot's own, or the laboratory ground. */
export function skinNamed(name: string | undefined): Skin | undefined {
  if (!name) return undefined;
  if (name === LABORATORY) return laboratory();
  return skinsByName()[name];
}

/** Where the room is, in the stage's terms: floor, walls and props follow it. */
export interface Room {
  /** A point on the floor -> the canvas, with the width of one world unit there. */
  at(x: number, z: number): { x: number; y: number; unit: number };
}

/** The stage's depth: a member at z is drawn `1 / (1 + z/4)` of the size it is at z = 0. */
const DEPTH = 0.25;
/** How far one unit of depth lifts a body off the floor line, in world units. */
const LIFT = 0.12;

/**
 * The room as one actor's scene sees it.
 *
 * maxcot stands a member at `cx + (x - x0) * unit`, `cy - z * unit * 0.12`, and
 * draws it `unit / (1 + z/4)` big, so one actor's camera plus its world x and z
 * fixes the whole floor plane. A test pins this against a second actor.
 */
export function roomOf(scene: Scene, member: { x: number; z: number }): Room {
  const scale = 1 / (1 + member.z * DEPTH);
  const unit = scene.cam.unit / scale; // px per world unit at z = 0
  const cx = scene.cam.cx - member.x * unit; // screen x of x = 0
  const floor = scene.cam.cy + member.z * unit * LIFT; // the floor line at z = 0
  return {
    at(x: number, z: number) {
      return {
        x: cx + x * unit,
        y: floor - z * unit * LIFT,
        unit: unit / (1 + z * DEPTH)
      };
    }
  };
}

/** The projection the ground paints with: the host sets it, the room reads it. */
let room: Room | null = null;

/** Hand the room the stage's projection (the host calls this before a ground is painted). */
export function setRoom(next: Room | null): void {
  room = next;
}

/** A projection for a ground painted with no scene to read: a room of the right shape. */
export function plainRoom(w: number, h: number): Room {
  const unit = h / 6.4;
  return {
    at(x: number, z: number) {
      return { x: w / 2 + x * unit, y: h * 0.82 - z * unit * LIFT, unit: unit / (1 + z * DEPTH) };
    }
  };
}

/** The laboratory: maxcot's pencil for the figures, and a room behind them. */
export function laboratory(): Skin {
  const pencil = skinsByName().pencil!;
  return {
    ...pencil,
    name: LABORATORY,
    label: 'Laboratory',
    group: 'drawn',
    about: 'A lab at 2am: blackboard, shelves, a bench of glassware, a floor in the stage’s own perspective.',
    ground: { css: '#20242c', draw: roomDraw }
  };
}

/**
 * The near bench, painted over the cast: the room's foreground.
 *
 * A ground is painted behind the actors and cannot cover them, so the bench
 * this side of the lens - the one the audience sits at - is a plate the host
 * lays over the finished frame (see ShowHost.paintMixed). It is camera space,
 * not world space: the lens is here, and the bench is at the bottom of it.
 */
export function foreground(ctx: Ctx2D, w: number, h: number): void {
  const top = h * 0.865;
  const shade = ctx.createLinearGradient(0, top - h * 0.06, 0, top);
  shade.addColorStop(0, 'rgba(8,10,14,0)');
  shade.addColorStop(1, 'rgba(8,10,14,0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, top - h * 0.06, w, h * 0.06);
  // the bench: an edge, then the dark under it
  ctx.fillStyle = '#6d747e';
  ctx.fillRect(0, top, w, Math.max(3, h * 0.012));
  ctx.fillStyle = '#3c434c';
  ctx.fillRect(0, top + Math.max(3, h * 0.012), w, h - top);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, top, w, Math.max(1, h * 0.003));
  // what is on it, just silhouettes at the bottom of the picture
  const glass = (x: number, tall: number): void => {
    const bw = w * 0.028;
    ctx.beginPath();
    ctx.moveTo(x - bw / 2, top);
    ctx.lineTo(x - bw * 0.34, top - tall);
    ctx.lineTo(x + bw * 0.34, top - tall);
    ctx.lineTo(x + bw / 2, top);
    ctx.closePath();
    ctx.fillStyle = 'rgba(18,22,28,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,225,255,0.18)';
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.stroke();
  };
  glass(w * 0.12, h * 0.09);
  glass(w * 0.155, h * 0.06);
  glass(w * 0.72, h * 0.075);
  glass(w * 0.88, h * 0.1);
  // a rack of tubes, and a notebook
  for (let i = 0; i < 5; i++) {
    const x = w * (0.36 + i * 0.014);
    ctx.fillStyle = 'rgba(18,22,28,0.8)';
    ctx.fillRect(x, top - h * 0.055, w * 0.007, h * 0.055);
  }
  ctx.fillStyle = 'rgba(28,33,40,0.9)';
  ctx.fillRect(w * 0.54, top - h * 0.014, w * 0.06, Math.max(2, h * 0.012));
}

// ── the room, in world units ───────────────────────────────────────────────────
// The cast lives between x = -8 and x = 8 and z = -2 and z = 4.5; a body is about
// 1.5 units tall. The back wall is behind everybody and the benches run along it
// and down the left wall, so nothing the set owns can be in front of a character.
const Z_FAR = 4.6; // the back wall: behind every character

function roomDraw(ctx: Ctx2D, w: number, h: number): void {
  const P = room ?? plainRoom(w, h);
  const at = (x: number, z: number) => P.at(x, z);
  const px = (z: number) => at(0, z).unit;
  // the room is sized from the picture, not from a constant: the floor runs
  // past the bottom edge and the walls past both sides, and the wall behind the
  // cast climbs to the top of the frame
  const origin = at(0, 0);
  const halfX = w / 2 / origin.unit + 1.5;
  const near = -(h - origin.y) / (origin.unit * LIFT) - 1;
  const wallBase = at(0, Z_FAR).y;
  const wallH = Math.max(3, (wallBase + 4) / px(Z_FAR));

  /** A flat quad on the floor (four floor points). */
  const floorQuad = (x1: number, z1: number, x2: number, z2: number, fill: string): void => {
    const a = at(x1, z1);
    const b = at(x2, z1);
    const c = at(x2, z2);
    const d = at(x1, z2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  /** A flat quad standing on the floor at depth z: x1..x2 across, low..high up. */
  const face = (x1: number, x2: number, z: number, low: number, high: number, fill: string): void => {
    const p = at(x1, z);
    const q = at(x2, z);
    const u = px(z);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - low * u);
    ctx.lineTo(q.x, q.y - low * u);
    ctx.lineTo(q.x, q.y - high * u);
    ctx.lineTo(p.x, p.y - high * u);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  /** A box standing on the floor: the face toward the camera, and its top. */
  const solid = (x1: number, x2: number, z1: number, z2: number, low: number, high: number, top: string, front: string): void => {
    const a = at(x1, z2);
    const b = at(x2, z2);
    const c = at(x2, z1);
    const d = at(x1, z1);
    const uf = px(z1);
    const ub = px(z2);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - low * uf);
    ctx.lineTo(c.x, c.y - low * uf);
    ctx.lineTo(c.x, c.y - high * uf);
    ctx.lineTo(d.x, d.y - high * uf);
    ctx.closePath();
    ctx.fillStyle = front;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - high * ub);
    ctx.lineTo(b.x, b.y - high * ub);
    ctx.lineTo(c.x, c.y - high * uf);
    ctx.lineTo(d.x, d.y - high * uf);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();
  };

  // ── the box of the room ────────────────────────────────────────────────────
  ctx.fillStyle = '#171b21';
  ctx.fillRect(0, 0, w, h);
  floorQuad(-halfX, near, halfX, Z_FAR, '#333b46');
  // its grid, one line a unit, so the floor is flat and goes back
  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = Math.max(1, px(0) * 0.006);
  for (let x = -halfX; x <= halfX; x += 1) {
    const p = at(x, near);
    const q = at(x, Z_FAR);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  for (let z = Math.ceil(near); z <= Z_FAR; z += 1) {
    const p = at(-halfX, z);
    const q = at(halfX, z);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  // every other tile a shade darker, so the floor is a floor and not a plane
  for (let x = -halfX; x < halfX; x += 2) {
    for (let z = Math.ceil(near); z < Z_FAR; z += 2) {
      floorQuad(x, z, Math.min(x + 2, halfX), Math.min(z + 2, Z_FAR), 'rgba(255,255,255,0.035)');
    }
  }
  // the back wall
  face(-halfX, halfX, Z_FAR, 0, wallH, '#262d36');
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (let x = -halfX; x <= halfX; x += 2) {
    const p = at(x, Z_FAR);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - wallH * px(Z_FAR));
    ctx.stroke();
  }
  // the two side walls, running back to front
  const side = (x: number, fill: string): void => {
    const a = at(x, Z_FAR);
    const b = at(x, near);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, 0);
    ctx.lineTo(a.x, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  side(-halfX, '#1f252d');
  side(halfX, '#1f252d');

  // ── the blackboard, on the back wall ───────────────────────────────────────
  const board = { x1: -6.2, x2: -1.6, low: 1.4, high: 2.9 };
  face(board.x1 - 0.09, board.x2 + 0.09, Z_FAR - 0.01, board.low - 0.09, board.high + 0.09, '#6d5a3d');
  face(board.x1, board.x2, Z_FAR - 0.02, board.low, board.high, '#1e3a33');
  {
    const u = px(Z_FAR);
    const left = at(board.x1, Z_FAR);
    const top = at(board.x1, Z_FAR).y - board.high * u;
    const bw = (board.x2 - board.x1) * px(0);
    const bh = (board.high - board.low) * u;
    const x0 = left.x + bw * 0.06;
    const y0 = top + bh * 0.18;
    ctx.strokeStyle = 'rgba(235,240,235,0.5)';
    ctx.lineWidth = Math.max(1, u * 0.012);
    const scribble = (row: number, from: number, to: number, wobble: number): void => {
      ctx.beginPath();
      ctx.moveTo(x0 + bw * from, y0 + bh * row);
      for (let i = 1; i <= 12; i++) {
        ctx.lineTo(x0 + bw * (from + ((to - from) * i) / 12), y0 + bh * row + Math.sin(i * 2.1 + row * 9) * bh * wobble);
      }
      ctx.stroke();
    };
    scribble(0.12, 0, 0.62, 0.012);
    scribble(0.28, 0, 0.44, 0.008);
    ctx.beginPath();
    ctx.moveTo(x0 + bw * 0.6, y0 + bh * 0.5);
    ctx.bezierCurveTo(x0 + bw * 0.66, y0 + bh * 0.2, x0 + bw * 0.74, y0 + bh * 0.78, x0 + bw * 0.8, y0 + bh * 0.52);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x0 + bw * (0.06 + i * 0.13), y0 + bh * 0.82, Math.max(1.5, u * 0.012), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── shelves, on the back wall to the right ─────────────────────────────────
  for (const row of [0, 1]) {
    const up = row === 0 ? 1.5 : 2.15;
    face(0.9, 6.6, Z_FAR - 0.02, up, up + 0.05, '#4b4236');
    for (let i = 0; i < 7; i++) {
      const jx = 1.15 + i * 0.76;
      const tall = (row === 0 ? 0.44 : 0.38) * (i % 3 === 0 ? 0.8 : 1);
      face(jx, jx + 0.44, Z_FAR - 0.05, up + 0.05, up + 0.05 + tall, 'rgba(190,220,225,0.15)');
      face(jx + 0.03, jx + 0.41, Z_FAR - 0.06, up + 0.05, up + 0.05 + tall * 0.45, i % 2 ? 'rgba(120,220,180,0.4)' : 'rgba(230,190,120,0.36)');
    }
  }

  // ── the benches: one along the back wall under the board, one down the left ─
  solid(-6.8, 0.9, Z_FAR - 0.55, Z_FAR - 0.05, 0, 0.62, '#7c838d', '#4e555f');
  solid(-halfX + 0.3, -halfX + 1.4, near + 0.6, Z_FAR - 0.8, 0, 0.62, '#767d87', '#474e57');

  // glassware on the back bench
  {
    const u = px(Z_FAR - 0.3);
    const glass = (x: number, tall: number, tint: string): void => {
      const p = at(x, Z_FAR - 0.3);
      const bw = u * 0.2;
      ctx.fillStyle = 'rgba(200,225,230,0.16)';
      ctx.fillRect(p.x - bw / 2, p.y - (0.62 + tall) * u, bw, tall * u);
      ctx.strokeStyle = 'rgba(220,240,245,0.4)';
      ctx.lineWidth = Math.max(1, u * 0.008);
      ctx.strokeRect(p.x - bw / 2, p.y - (0.62 + tall) * u, bw, tall * u);
      ctx.fillStyle = tint;
      ctx.fillRect(p.x - bw / 2 + 1, p.y - (0.62 + tall * 0.55) * u, bw - 2, tall * 0.5 * u);
    };
    glass(-5.9, 0.34, 'rgba(120,220,180,0.5)');
    glass(-5.35, 0.26, 'rgba(230,190,120,0.45)');
    glass(-1.2, 0.3, 'rgba(150,190,240,0.45)');
    glass(-0.65, 0.24, 'rgba(240,140,120,0.42)');
    // a rack of test tubes
    for (let i = 0; i < 6; i++) {
      const p = at(-3.7 + i * 0.22, Z_FAR - 0.3);
      ctx.fillStyle = 'rgba(210,230,235,0.14)';
      ctx.fillRect(p.x, p.y - 0.95 * u, u * 0.1, 0.33 * u);
      ctx.fillStyle = i % 2 ? 'rgba(120,220,180,0.45)' : 'rgba(240,140,120,0.4)';
      ctx.fillRect(p.x + 1, p.y - 0.85 * u, u * 0.1 - 2, 0.2 * u);
    }
    // a microscope, because it is a laboratory
    const m = at(-2.2, Z_FAR - 0.3);
    ctx.strokeStyle = '#9aa3ad';
    ctx.lineWidth = Math.max(2, u * 0.03);
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 0.62 * u);
    ctx.lineTo(m.x, m.y - 1.05 * u);
    ctx.lineTo(m.x + u * 0.22, m.y - 1.3 * u);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(m.x + u * 0.24, m.y - 0.95 * u, u * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── the wall above the board: a poster, a clock, a pipe run ─────────────────
  {
    const u = px(Z_FAR);
    // a periodic table, pinned
    face(1.0, 3.6, Z_FAR - 0.02, 3.1, 4.5, '#e8e3d3');
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 9; col++) {
        ctx.fillStyle = ['#c96f5b', '#7fa6c9', '#89b98a', '#d8b76a'][(row + col) % 4];
        const p = at(1.12 + col * 0.27, Z_FAR - 0.03);
        const y = p.y - (4.4 - row * 0.3) * u;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(p.x, y, 0.22 * u, 0.22 * u);
        ctx.globalAlpha = 1;
      }
    }
    // a clock over the shelves, stopped at 2am
    const c = at(5.4, Z_FAR - 0.03);
    ctx.strokeStyle = 'rgba(230,235,240,0.5)';
    ctx.lineWidth = Math.max(1.5, u * 0.02);
    ctx.beginPath();
    ctx.arc(c.x, c.y - 3.6 * u, 0.45 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 3.6 * u);
    ctx.lineTo(c.x, c.y - 3.95 * u);
    ctx.moveTo(c.x, c.y - 3.6 * u);
    ctx.lineTo(c.x + 0.3 * u, c.y - 3.55 * u);
    ctx.stroke();
    // a pipe run along the wall, high up
    ctx.strokeStyle = 'rgba(150,165,180,0.35)';
    ctx.lineWidth = Math.max(2, u * 0.05);
    const p1 = at(-6, Z_FAR - 0.04);
    const p2 = at(6.6, Z_FAR - 0.04);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y - 5.4 * u);
    ctx.lineTo(p2.x, p2.y - 5.4 * u);
    ctx.stroke();
  }

  // ── a pool of light on the floor, under the room ────────────────────────────
  {
    const c = at(0, 1.2);
    const pool = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(w, h) * 0.45);
    pool.addColorStop(0, 'rgba(210,232,255,0.1)');
    pool.addColorStop(0.5, 'rgba(210,232,255,0.04)');
    pool.addColorStop(1, 'rgba(210,232,255,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, w * 0.55, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── the light: a cold strip over the floor, and the dark at the edges ───────
  const lamp = ctx.createRadialGradient(w * 0.5, wallBase - 2 * px(Z_FAR), 0, w * 0.5, wallBase - 2 * px(Z_FAR), Math.max(w, h) * 0.85);
  lamp.addColorStop(0, 'rgba(200,225,255,0.14)');
  lamp.addColorStop(1, 'rgba(200,225,255,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);
}
