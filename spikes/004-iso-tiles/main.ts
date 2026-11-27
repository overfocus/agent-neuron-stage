// spike 004: an isometric tile room in three.js, a show played on it, and a
// character that is either a maxcot billboard or a 3D model.
//
// Questions (see README.md for the verdict):
//   1. Does a maxcot character survive the move into 3D as a billboard: its
//      canvas as a texture on a camera-facing sprite, feet on a tile?
//   2. Can the stage's `move` become a walk across tiles, routed around walls
//      and water and up steps, without inventing time?
//   3. Can a 3D model be a skin: a named entry in a table the page owns, so a
//      payload could name one the way it names a maxcot skin, never a file?
//   4. (round two) Does it hold in a big room with scenery, a rigged model whose
//      clips play maxcot's poses, a camera that follows the shot, and a scene
//      written by hand that walks between named places?
//   5. (round three, life.ts) Can each character have an inner network run by
//      the engine (drives that remember, and a will), live, with the page as
//      its body and a camera that follows whose story is happening?
//
// It plays a compiled trace (src/fromtrace.ts) or a written score
// (src/fromscore.ts) through maxcot's Conductor, like the real host does, but
// the host here is new and throwaway.
import * as THREE from 'three';
import { Actor, render, camera as maxCamera } from 'maxcot';
import type { Scene } from 'maxcot';
import { skinsByName } from 'maxcot/skins';
import { createConductor, type CommandContext, type ScheduledEvent } from 'maxcot/score';
import { compileTrace, hasPose } from '../../src/fromtrace.ts';
import { parseShow } from '../../src/fromscore.ts';
import { parseTrace } from '../../src/trace.ts';
import type { Show } from '../../src/show.ts';
import duetTrace from '../../src/traces/duet.json';
import labTrace from '../../src/traces/lab.json';
import troupeTrace from '../../src/traces/troupe.json';
import shadowScore from './scenes/shadow.score?raw';
import { along, besideOf, block, findPath, nearestOpen, parseGrid, pathLength, tileAt, type Cell, type Grid, type Surface } from './grid.ts';
import { LAB, LIFE, SHADOW, type Room } from './rooms.ts';
import { createLife, type Life, type LifeBody } from './life.ts';
import { buildProp } from './props.ts';
import { MODELS, Rig, clipFor, faceFor } from './models.ts';

// ── the stage: renderer, camera, light ──────────────────────────────────────

/** World height of one step of a tile's height. A tile is 1 × 1. */
const STEP = 0.32;
/** How far one stage unit (maxcot's x and z) reaches across the tiles, for shows that place by x and z. */
const STAGE_X = 1.5;
const STAGE_Z = 2.2;
/** A walk with no `over` goes at this pace, in beats per tile (see README: the one place a pace is the stage's). */
const BEATS_PER_TILE = 0.75;

const view = document.getElementById('view') as HTMLDivElement;
const bubbleLayer = document.getElementById('bubbles') as HTMLDivElement;
const readout = document.getElementById('readout') as HTMLDivElement;
const card = document.getElementById('card') as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.prepend(renderer.domElement);

const scene3 = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
/** The iso direction: the camera always looks down (1, 1, 1). */
const ISO = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(60);

const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3226, 1.1);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene3.add(hemi, sun, sun.target);

// ── the room ────────────────────────────────────────────────────────────────

let room: Room = LAB;
let grid: Grid = parseGrid(room.rows);
const roomGroup = new THREE.Group();
scene3.add(roomGroup);
/** Each instanced tile mesh, and which cell each of its instances is. */
const tilePick = new Map<THREE.InstancedMesh, Cell[]>();
/**
 * The cutaway: a wall or hedge between the camera and a character is lowered to
 * a stub, the way iso games do, or a walk down the pass is a walk behind a wall.
 * Each tall tile keeps its full matrix and its stub, and which one it shows.
 */
interface Tall {
  mesh: THREE.InstancedMesh;
  index: number;
  full: THREE.Matrix4;
  stub: THREE.Matrix4;
  cut: boolean;
}
const tall = new Map<string, Tall>();
const propTicks: ((t: number) => void)[] = [];

const SURFACE: Record<Surface, { color: number; alt: number; rough: number }> = {
  stone: { color: 0xd9d3c4, alt: 0xcfc8b7, rough: 0.9 },
  grass: { color: 0x7fa65a, alt: 0x76a052, rough: 1 },
  earth: { color: 0x463d38, alt: 0x40372f, rough: 1 },
  path: { color: 0xc8b48a, alt: 0xc0ab80, rough: 1 },
  wood: { color: 0x8a6440, alt: 0x7e5a38, rough: 0.8 },
  wall: { color: 0x6f665e, alt: 0x6a6159, rough: 0.9 },
  hedge: { color: 0x2f5e33, alt: 0x2b5a30, rough: 1 },
  water: { color: 0x4f8fb8, alt: 0x4a8ab2, rough: 0.15 },
  black: { color: 0x07070a, alt: 0x0a0a0e, rough: 0.05 }
};

function topOf(c: number, r: number): number {
  const t = tileAt(grid, c, r)!;
  if (t.surface === 'water' || t.surface === 'black') return -0.12;
  if (t.surface === 'wall') return 1.25;
  if (t.surface === 'hedge') return 0.7;
  return t.h * STEP;
}

/** The top of a tile, in world space. */
function tileTop(c: number, r: number, h?: number): THREE.Vector3 {
  return new THREE.Vector3(c, (h ?? tileAt(grid, c, r)?.h ?? 0) * STEP, r);
}

function buildRoom(next: Room): void {
  room = next;
  grid = parseGrid(room.rows);
  block(grid, room.props.filter((p) => p.block !== false).map((p) => p.at));
  roomGroup.clear();
  tilePick.clear();
  tall.clear();
  propTicks.length = 0;

  // one instanced mesh per surface: a 36 × 28 room is nine draw calls, not a thousand
  const by = new Map<Surface, Cell[]>();
  for (let r = 0; r < grid.d; r++) for (let c = 0; c < grid.w; c++) {
    const s = tileAt(grid, c, r)!.surface;
    if (!by.has(s)) by.set(s, []);
    by.get(s)!.push([c, r]);
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4();
  const colour = new THREE.Color();
  for (const [surface, cells] of by) {
    const look = SURFACE[surface];
    const wet = surface === 'water' || surface === 'black';
    const mat = new THREE.MeshStandardMaterial({ roughness: look.rough, metalness: surface === 'black' ? 0.6 : 0, transparent: surface === 'water', opacity: 0.85 });
    const mesh = new THREE.InstancedMesh(unit, mat, cells.length);
    cells.forEach(([c, r], i) => {
      const top = topOf(c, r);
      const base = -0.5;
      const solid = surface === 'wall' || surface === 'hedge';
      m4.compose(new THREE.Vector3(c, (top + base) / 2, r), new THREE.Quaternion(), new THREE.Vector3(solid ? 1 : 0.985, top - base, solid ? 1 : 0.985));
      mesh.setMatrixAt(i, m4);
      const h = tileAt(grid, c, r)!.h;
      colour.setHex((c + r) % 2 ? look.color : look.alt).offsetHSL(0, 0, surface === 'stone' ? h * 0.04 : 0);
      mesh.setColorAt(i, colour);
    });
    mesh.receiveShadow = true;
    mesh.castShadow = surface === 'wall' || surface === 'hedge';
    if (wet) mesh.castShadow = false;
    roomGroup.add(mesh);
    tilePick.set(mesh, cells);
    if (surface === 'wall' || surface === 'hedge') {
      cells.forEach(([c, r], i) => {
        const full = new THREE.Matrix4();
        mesh.getMatrixAt(i, full);
        const stub = new THREE.Matrix4().compose(new THREE.Vector3(c, -0.5 + 0.09, r), new THREE.Quaternion(), new THREE.Vector3(1, 0.18, 1));
        tall.set(`${c},${r}`, { mesh, index: i, full, stub, cut: false });
      });
    }
  }

  for (const prop of room.props) {
    const built = buildProp(prop.kind);
    built.object.position.copy(tileTop(prop.at[0], prop.at[1]));
    built.object.rotation.y = ((prop.turn ?? 0) * Math.PI) / 2;
    roomGroup.add(built.object);
    if (built.tick) propTicks.push(built.tick);
  }

  // the light: a high clear day, or a low sun from the west that leaves the east in dusk
  const centre = new THREE.Vector3((grid.w - 1) / 2, 0, (grid.d - 1) / 2);
  if (room.light === 'dusk') {
    scene3.background = new THREE.Color(0x14121a);
    hemi.color.setHex(0xb8b0d8);
    hemi.groundColor.setHex(0x1a1420);
    hemi.intensity = 0.55;
    sun.color.setHex(0xffb070);
    sun.intensity = 2.2;
    sun.position.set(centre.x - 24, 9, centre.z - 4);
  } else {
    scene3.background = new THREE.Color(0x1a1c22);
    hemi.color.setHex(0xdfe8ff);
    hemi.groundColor.setHex(0x3a3226);
    hemi.intensity = 1.1;
    sun.color.setHex(0xfff2dd);
    sun.intensity = 1.8;
    sun.position.set(centre.x - 6, 14, centre.z + 9);
  }
  sun.target.position.copy(centre);
  const reach = Math.max(grid.w, grid.d) * 0.75;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, far: 120 });
  sun.shadow.camera.updateProjectionMatrix();
  shotWhole();
  camNow.copy(camWant);
}

// ── the camera: a shot is where the camera wants to be; it eases there ─────

/** Where the camera looks and how much it takes in (half the frame's height, in tiles). */
const camWant = { at: new THREE.Vector3(), half: 8, on: [] as string[], framing: 'wide' };
const camNow = { at: new THREE.Vector3(), half: 8, copy(w: { at: THREE.Vector3; half: number }) { this.at.copy(w.at); this.half = w.half; } };
let zoom = 1;
/** The audience took the camera (dragged it): shots wait until the next one in the score. */
let handHeld = false;

const FRAMING: Record<string, number> = { close: 1.6, medium: 2.6, full: 4, wide: 6 };

function shotWhole(): void {
  camWant.on = [];
  camWant.at.set((grid.w - 1) / 2, 0, (grid.d - 1) / 2);
  camWant.half = Math.max(grid.w, grid.d) * 0.56;
}

function shot(framing: string, on: string[]): void {
  handHeld = false;
  zoom = 1;
  if (!on.length) return shotWhole();
  camWant.on = on;
  camWant.framing = framing;
}

/** A shot on bodies follows them: where they are now, framed by how many and how far apart. */
function followShot(): void {
  const bs = camWant.on.map((id) => bodies.get(id)).filter((b): b is Body => !!b);
  if (!bs.length) return;
  const box = new THREE.Box3();
  for (const b of bs) box.expandByPoint(b.root.position);
  box.getCenter(camWant.at);
  camWant.at.y += 0.6;
  const size = box.getSize(new THREE.Vector3());
  // the spread across the screen: in iso, a tile's width runs along (1, 0, -1)
  const spread = Math.max(size.x, size.z) * 0.75;
  camWant.half = Math.max(FRAMING[camWant.framing] ?? 4, spread + 1.5);
}

function placeCamera(dt: number): void {
  const w = view.clientWidth;
  const h = view.clientHeight;
  renderer.setSize(w, h, false);
  if (!handHeld && camWant.on.length) followShot();
  const k = dt >= 1 ? 1 : 1 - Math.exp(-dt * 2.2);
  if (!handHeld) {
    camNow.at.lerp(camWant.at, k);
    camNow.half += (camWant.half - camNow.half) * k;
  }
  const half = camNow.half / zoom;
  const aspect = w / h;
  Object.assign(cam, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
  cam.position.copy(camNow.at).add(ISO);
  cam.lookAt(camNow.at);
  cam.updateProjectionMatrix();
}

// ── looks ───────────────────────────────────────────────────────────────────

const SKINS = skinsByName();

/** What draws one character: a maxcot skin by name, or a model by name. */
type Look = { kind: 'maxcot'; skin: string } | { kind: 'model'; model: string };

/** A style name read as a look: maxcot's skins first, then the page's models. */
function lookOf(name: string | undefined): Look | null {
  if (!name) return null;
  if (SKINS[name]) return { kind: 'maxcot', skin: name };
  if (MODELS[name]) return { kind: 'model', model: name };
  return null;
}

// ── a body on the tiles ─────────────────────────────────────────────────────

const CANVAS_W = 256;
const CANVAS_H = 320;
/** How tall a maxcot body stands, in tiles. */
const BODY_TILES = 1.35;

interface Walk {
  path: Cell[];
  t0: number;
  t1: number;
  /** A walk the audience asked for by clicking runs on the wall clock, not the score's. */
  free: boolean;
}

class Body {
  readonly id: string;
  readonly actor: Actor;
  readonly root = new THREE.Group();
  look: Look;
  cell: Cell;
  /** Where the score thinks the character stands, in maxcot's stage units: a `move` by x and z steps from here. */
  sx: number;
  sz: number;
  walk: Walk | null = null;
  /** Who this body faces, if anyone. It keeps turning to them while they move. */
  facing: string | null = null;
  /** Which way a model faces on the floor: toward the camera (down the iso diagonal) until it turns. */
  heading = new THREE.Vector2(1, 1);
  /** The last clip a pose asked for, and when in song time: a model that loads late still lands it. */
  private gesture: { clip: string; t: number } | null = null;
  private faceName: 'Angry' | 'Surprised' | 'Sad' | null = null;
  // billboard
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private tex = new THREE.CanvasTexture(this.canvas);
  private sprite: THREE.Sprite | null = null;
  private mcam: ReturnType<typeof maxCamera> | null = null;
  private lastStep = -1;
  private time = 0;
  // model
  private model: THREE.Object3D | null = null;
  private rig: Rig | null = null;
  private soma: THREE.Mesh | null = null;
  private glow = 0;
  private tilt = 0;
  private hot = 0;
  private bob = 0;
  private gone = false;

  constructor(id: string, who: string, cell: Cell, sx: number, sz: number, look: Look) {
    this.id = id;
    this.actor = new Actor({ who });
    this.actor.pose('rest').snap();
    this.cell = cell;
    this.sx = sx;
    this.sz = sz;
    this.look = look;
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
    );
    shadow.position.y = 0.01;
    shadow.userData.blob = true;
    this.root.add(shadow);
    this.root.position.copy(tileTop(cell[0], cell[1]));
    scene3.add(this.root);
    void this.setLook(look);
  }

  async setLook(look: Look): Promise<void> {
    this.look = look;
    if (this.sprite) {
      this.root.remove(this.sprite);
      this.sprite = null;
    }
    if (this.model) {
      this.root.remove(this.model);
      this.model = null;
      this.rig = null;
      this.soma = null;
    }
    if (look.kind === 'maxcot') {
      this.sprite = this.billboard();
      this.root.add(this.sprite);
      return;
    }
    const entry = MODELS[look.model];
    if (!entry) return;
    const loaded = await entry.load();
    if (this.look !== look || this.gone) return; // changed again, or left, while it loaded
    loaded.object.traverse((n) => {
      if (n.name === 'soma' && n instanceof THREE.Mesh) this.soma = n;
    });
    this.model = loaded.object;
    this.rig = loaded.clips.length ? new Rig(loaded.object, loaded.clips) : null;
    this.model.rotation.y = Math.atan2(this.heading.x, this.heading.y);
    this.root.add(this.model);
    // what the score asked for before the file arrived
    if (this.rig) {
      this.rig.face(this.faceName, true);
      if (this.gesture) this.rig.play(this.gesture.clip, Math.max(0, conductor.songT - this.gesture.t));
    }
  }

  /**
   * The maxcot character as a sprite. maxcot frames a figure by its own camera;
   * that camera is fixed once from the rest pose, so a pose that moves the body
   * moves it on the sprite instead of reframing it, and the feet stay on the tile.
   */
  private billboard(): THREE.Sprite {
    const F = this.actor.frame(0);
    this.mcam = maxCamera(F.P, CANVAS_W, CANVAS_H, 'full');
    const S = this.paint(0, true)!;
    const feet = S.body.y + S.body.h;
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, alphaTest: 0.08 });
    const sprite = new THREE.Sprite(mat);
    const height = (BODY_TILES * CANVAS_H) / S.body.h;
    sprite.scale.set((height * CANVAS_W) / CANVAS_H, height, 1);
    sprite.center.set((S.body.x + S.body.w / 2) / CANVAS_W, 1 - feet / CANVAS_H);
    return sprite;
  }

  private paint(t: number, force = false): Scene | null {
    if (this.look.kind !== 'maxcot' || !this.mcam) return null;
    const skin = SKINS[this.look.skin] ?? SKINS['pencil']!;
    const step = Math.floor(t * (skin.fps || 12));
    if (!force && step === this.lastStep) return null;
    this.lastStep = step;
    this.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const S = render(this.ctx as never, CANVAS_W, CANVAS_H, this.actor.frame(null), { skin, cam: this.mcam, ground: false, t, key: this.id });
    this.tex.needsUpdate = true;
    return S;
  }

  /** A pose: maxcot draws it on a billboard; a rigged model plays the clip it maps to; any other model gestures. */
  pose(name: string, since: number, at: number): void {
    // the maxcot actor is kept in step whatever draws the body, so a recast lands the right pose;
    // a model's own clip names (`Sitting`) mean nothing to it and are left out
    if (hasPose(name)) this.actor.pose(name);
    const face = faceFor(name);
    if (face !== undefined) {
      this.faceName = face;
      this.rig?.face(face, since > 0);
    }
    const clip = clipFor(name);
    if (clip) {
      this.gesture = { clip, t: at };
      this.rig?.play(clip, since);
    } else if (/rest|Standing/.test(name)) this.gesture = null;
    // a model with no rig reads the pose's family as a gesture of the whole body
    if (since === 0) {
      if (/angry|furious|fedup|fists/.test(name)) this.hot = 1;
      if (/shrug|tired|sad|sulk|collapse/.test(name)) this.tilt = 1;
      this.bob = 1;
    }
  }

  speak(): void {
    this.glow = 1;
    this.bob = 1;
  }

  /** Turn to face a point. A billboard turns in the drawing (maxcot's yaw); a model turns in the room. */
  faceToward(target: THREE.Vector3, snap: boolean): void {
    const here = this.root.position;
    if (Math.hypot(target.x - here.x, target.z - here.z) < 0.05) return;
    this.heading.set(target.x - here.x, target.z - here.z);
    if (snap && this.model) this.model.rotation.y = Math.atan2(this.heading.x, this.heading.y);
    if (this.look.kind === 'maxcot') {
      const a = here.clone().project(cam).x;
      const b = target.clone().project(cam).x;
      const dir = Math.sign(b - a);
      if (dir) {
        this.actor.set('view.yaw', dir * 0.38);
        if (snap) this.actor.snap();
      }
    }
  }

  step(dt: number, songT: number, wallT: number): void {
    this.time += dt;
    this.actor.update(dt);
    // a walk puts the body where its clock says it has got to
    let speed = 0;
    if (this.walk) {
      const now = this.walk.free ? wallT : songT;
      const span = this.walk.t1 - this.walk.t0;
      const p = span <= 0 ? 1 : (now - this.walk.t0) / span;
      const at = along(grid, this.walk.path, p);
      const before = this.root.position.clone();
      this.root.position.set(at.x, at.h * STEP, at.z);
      speed = dt > 0 ? Math.hypot(this.root.position.x - before.x, this.root.position.z - before.z) / dt : 0;
      if (at.dx || at.dz) {
        this.heading.set(at.dx, at.dz);
        if (this.look.kind === 'maxcot') this.faceToward(this.root.position.clone().add(new THREE.Vector3(at.dx, 0, at.dz)), false);
      }
      if (p >= 1) {
        this.cell = this.walk.path[this.walk.path.length - 1]!;
        this.walk = null;
      }
    } else if (this.facing) {
      const other = bodies.get(this.facing);
      if (other) this.faceToward(other.root.position, false);
    }
    if (this.look.kind === 'maxcot') this.paint(this.time);
    if (this.model) {
      const want = Math.atan2(this.heading.x, this.heading.y);
      let d = want - this.model.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.model.rotation.y += d * Math.min(1, dt * 8);
    }
    if (this.rig) {
      // the legs follow the walk: a stroll, or a run when the score asks for a lot of ground in few beats
      if (this.walk && speed > 0.05) {
        this.rig.stopGesture();
        this.rig.setBase(speed > 2.8 ? 'Running' : 'Walking', Math.min(1.6, Math.max(0.6, speed / (speed > 2.8 ? 3.5 : 1.6))));
      } else this.rig.setBase('Idle');
      this.rig.update(dt);
    } else if (this.model) {
      this.glow = Math.max(0, this.glow - dt * 0.9);
      this.hot = Math.max(0, this.hot - dt * 0.5);
      this.tilt = Math.max(0, this.tilt - dt * 0.6);
      this.bob = Math.max(0, this.bob - dt * 2.5);
      this.model.position.y = Math.sin((1 - this.bob) * Math.PI) * this.bob * 0.12 + Math.sin(this.time * 2) * 0.015;
      this.model.rotation.z = Math.sin(this.tilt * Math.PI) * 0.25;
      const m = this.soma?.material as THREE.MeshStandardMaterial | undefined;
      if (m && 'emissive' in m) m.emissive.setRGB(0.9 * this.glow + 0.8 * this.hot, 0.55 * this.glow, 0.25 * this.glow);
    }
  }

  /** The head, in world space, for a bubble. */
  head(): THREE.Vector3 {
    return this.root.position.clone().add(new THREE.Vector3(0, this.look.kind === 'maxcot' ? BODY_TILES + 0.1 : 1.45, 0));
  }

  dispose(): void {
    this.gone = true;
    scene3.remove(this.root);
    this.tex.dispose();
  }
}

// ── the show, played ────────────────────────────────────────────────────────

const bodies = new Map<string, Body>();
const bubbles = new Map<string, { el: HTMLDivElement; until: number }>();
let show: Show;
let lookMode: 'show' | 'maxcot' | 'mixed' | 'model' = 'show';
let selected: string | null = null;

/** The plays on offer: a trace (compiled) or a score (read), each in its room. */
const PLAYS: Record<string, { room: Room; show: () => Show }> = {
  shadow: { room: SHADOW, show: () => parseShow(shadowScore) },
  lab: { room: LAB, show: () => fromTrace(labTrace) },
  duet: { room: LAB, show: () => fromTrace(duetTrace) },
  troupe: { room: LAB, show: () => fromTrace(troupeTrace) }
};
function fromTrace(json: unknown): Show {
  const trace = parseTrace(json);
  return compileTrace(trace, { title: trace.demo, skin: 'pencil' });
}

/** The tile a stage position stands on: maxcot's x across, z into the picture. */
function cellOf(sx: number, sz: number): Cell {
  return [Math.round(grid.w / 2 - 0.5 + sx * STAGE_X), Math.round(grid.d / 2 - 1 + sz * STAGE_Z)];
}

/** A place a score names: a mark (`'B'`), a cell (`[c, r]`), or nothing it understands. */
function placeOf(v: unknown): Cell | null {
  if (typeof v === 'string' && room.marks[v]) return room.marks[v]!;
  if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))) return [Math.round(v[0]), Math.round(v[1])];
  return null;
}

function occupied(except: string): Set<string> {
  const s = new Set<string>();
  for (const b of bodies.values()) if (b.id !== except) s.add(`${b.cell[0]},${b.cell[1]}`);
  return s;
}

function lookFor(index: number, style: string | undefined): Look {
  const own = lookOf(style) ?? { kind: 'maxcot', skin: show.skin && SKINS[show.skin] ? show.skin : 'pencil' };
  const skin = own.kind === 'maxcot' ? own.skin : 'pencil';
  if (lookMode === 'show') return own;
  if (lookMode === 'maxcot') return { kind: 'maxcot', skin };
  if (lookMode === 'model') return { kind: 'model', model: ['robot', 'neuron', 'glass', 'shadow'][index % 4]! };
  // mixed: every other character a model
  return index % 2 ? { kind: 'model', model: ['robot', 'neuron', 'glass'][((index - 1) / 2) % 3]! } : { kind: 'maxcot', skin };
}

/** Walk a body to a tile, by the room's own paths. Returns the tiles it will cover. */
function walkTo(b: Body, goal: Cell, t0: number, t1: number | null, free: boolean): number {
  // a walk still under way when another starts finishes first: that is where the next one leaves from
  if (b.walk) {
    b.cell = b.walk.path[b.walk.path.length - 1]!;
    b.walk = null;
  }
  const path = findPath(grid, b.cell, goal, { blocked: occupied(b.id) });
  if (!path || path.length < 2) return 0;
  const length = pathLength(path);
  // the score's own `over` decides how long; otherwise a pace (the audience's click, or a score that left it out)
  const end = t1 ?? t0 + length * BEATS_PER_TILE * conductor.spb();
  b.walk = { path, t0, t1: end, free };
  b.cell = path[path.length - 1]!; // reserve the tile it is going to
  b.facing = null;
  return length;
}

const conductor = createConductor({
  onCommand: (cmd, value, event, ctx) => command(cmd, value, event, ctx),
  onReset: () => {
    for (const b of bodies.values()) b.dispose();
    bodies.clear();
    for (const { el } of bubbles.values()) el.remove();
    bubbles.clear();
    card.hidden = true;
    shotWhole();
  },
  onSettle: () => {
    for (const b of bodies.values()) b.actor.snap();
    if (!handHeld) {
      if (camWant.on.length) followShot();
      camNow.copy(camWant);
    }
  }
});

function command(cmd: string, value: unknown, event: ScheduledEvent, ctx: CommandContext): void {
  const on = typeof event.on === 'string' ? event.on : null;
  const body = on ? bodies.get(on) : undefined;
  switch (cmd) {
    case 'enter': {
      const spec = (typeof value === 'string' ? { id: value } : value) as { id: string; who?: string; x?: number; z?: number; tile?: unknown };
      const index = show.actors.findIndex((a) => a.id === spec.id);
      const sx = spec.x ?? show.actors[index]?.x ?? 0;
      const sz = spec.z ?? show.actors[index]?.z ?? 0;
      const want = placeOf(spec.tile) ?? cellOf(sx, sz);
      const cell = nearestOpen(grid, want, occupied(spec.id)) ?? [0, 0];
      bodies.get(spec.id)?.dispose();
      bodies.set(spec.id, new Body(spec.id, spec.who ?? spec.id, cell, sx, sz, lookFor(index, show.actors[index]?.style)));
      return;
    }
    case 'manner':
      if (body && value && typeof value === 'object') body.actor.setManner(value as never);
      return;
    case 'set':
      if (body && typeof value === 'string' && typeof event.to === 'number') {
        body.actor.set(value, event.to);
        if (ctx.instant) body.actor.snap();
      }
      return;
    case 'look': {
      const target = typeof value === 'string' ? bodies.get(value) : undefined;
      if (!body || !target || target === body) return;
      body.facing = target.id;
      body.faceToward(target.root.position, ctx.instant);
      return;
    }
    case 'pose':
      if (body && typeof value === 'string') {
        body.pose(value, ctx.instant ? ctx.since : 0, event.t);
        if (ctx.instant) body.actor.snap();
      }
      return;
    case 'say': {
      if (!body || typeof value !== 'string') return;
      if (!ctx.instant) body.speak();
      const words = value.split(/\s+/).length;
      const until = event.t + Math.max(2, words * 0.4);
      if (until < ctx.now) return; // a line long said is not shown on a seek
      bubble(body.id, value, until);
      return;
    }
    case 'move': {
      if (!body || !value || typeof value !== 'object') return;
      const m = value as { x?: number; z?: number; dx?: number; dz?: number; to?: unknown };
      const beats = typeof event.over === 'number' ? event.over : null;
      const t1 = beats != null ? event.t + beats * conductor.spb() : null;
      if (m.to !== undefined) {
        // a place, or a person: walk to stand beside them, on the side nearest the walker
        const other = typeof m.to === 'string' ? bodies.get(m.to) : undefined;
        const goal = other ? besideOf(grid, other.cell, body.cell, occupied(body.id), [1, 1]) : placeOf(m.to);
        if (goal) walkTo(body, goal, event.t, t1, false);
        return;
      }
      body.sx = m.x ?? body.sx + (m.dx ?? 0);
      body.sz = m.z ?? body.sz + (m.dz ?? 0);
      walkTo(body, cellOf(body.sx, body.sz), event.t, t1, false);
      return;
    }
    case 'style': {
      if (!body || typeof value !== 'string') return;
      const look = lookOf(value);
      // the page's look buttons win over the score's: they are the audience's
      if (look && lookMode === 'show') void body.setLook(look);
      return;
    }
    case 'shot': {
      const ids = Array.isArray(event.on) ? event.on.filter((x): x is string => typeof x === 'string') : on ? [on] : [];
      shot(typeof value === 'string' ? value : 'wide', ids);
      return;
    }
    case 'exit':
      if (body) {
        body.dispose();
        bodies.delete(body.id);
      }
      return;
    case 'end': {
      const text = (value as { text?: string })?.text ?? show.title;
      card.textContent = text;
      card.hidden = false;
      return;
    }
  }
}

function bubble(id: string, text: string, until: number): void {
  let b = bubbles.get(id);
  if (!b) {
    const el = document.createElement('div');
    el.className = 'bubble';
    bubbleLayer.append(el);
    b = { el, until };
    bubbles.set(id, b);
  }
  // text, never HTML: nothing from a trace or a score is set as markup
  b.el.replaceChildren();
  const who = document.createElement('b');
  who.textContent = id;
  b.el.append(who, document.createTextNode(text));
  b.until = until;
}

// ── life: no score; the minds run in the engine (life.ts, life/bridge.mjs) ──

let life: Life | null = null;
const lifePanel = document.getElementById('life') as HTMLElement;
/** Bubbles in life live on the wall clock: there is no song. */
const wall = (): number => performance.now() / 1000;

function loadLife(): void {
  if (room !== LIFE || !roomGroup.children.length) buildRoom(LIFE);
  show = { title: 'life', note: 'no score: each character is a live engine network', bpm: 84, beatsPerBar: 4, skin: 'pencil', tail: 0, actors: [], events: [] };
  conductor.load([], { bpm: show.bpm, beatsPerBar: show.beatsPerBar, tail: 0 });
  conductor.seek(0);
  conductor.pause();
  selected = null;
  handHeld = false;
  zoom = 1;
  lifePanel.hidden = false;
  life = createLife(
    {
      grid: () => grid,
      room: () => room,
      bodies: () => bodies as unknown as Map<string, LifeBody>,
      enter: (id, who, cell, look) => {
        const b = new Body(id, who, cell, 0, 0, look);
        bodies.set(id, b);
        return b;
      },
      walk: (b, goal, pace) => {
        const body = b as unknown as Body;
        const now = wall();
        // a mind changes its mind mid-walk: leave from where the body is, not where the walk was going
        if (body.walk) {
          const here: Cell = [Math.round(body.root.position.x), Math.round(body.root.position.z)];
          body.cell = tileAt(grid, here[0], here[1])?.walk ? here : body.walk.path[0]!;
          body.walk = null;
        }
        if (!walkTo(body, goal, now, now + 1, true)) return false;
        const w = body.walk as Walk | null; // set by walkTo
        if (w) w.t1 = w.t0 + pathLength(w.path) * pace;
        return true;
      },
      say: (id, text, seconds) => {
        bodies.get(id)?.speak();
        bubble(id, text, wall() + seconds);
      },
      frame: (ids, framing) => shot(framing, ids),
      occupied,
      project: (v) => {
        const p = v.clone().project(cam);
        return { x: ((p.x + 1) / 2) * view.clientWidth, y: ((1 - p.y) / 2) * view.clientHeight };
      }
    },
    lifePanel
  );
}

function load(name: string): void {
  life?.stop();
  life = null;
  lifePanel.hidden = true;
  if (name === 'life') return loadLife();
  const play = PLAYS[name] ?? PLAYS['shadow']!;
  if (play.room !== room || !roomGroup.children.length) buildRoom(play.room);
  show = play.show();
  conductor.load(show.events, { bpm: show.bpm, beatsPerBar: show.beatsPerBar, tail: show.tail });
  selected = null;
  handHeld = false;
  zoom = 1;
  conductor.seek(0);
  conductor.play();
}

// ── the page ────────────────────────────────────────────────────────────────

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pick(ev: PointerEvent): { body?: Body; cell?: Cell } {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, cam);
  // a body first: its sprite or model (not its shadow blob), then the tile under the pointer
  const roots = [...bodies.values()].map((b) => b.root);
  const hitBody = ray.intersectObjects(roots, true).find((h) => !h.object.userData.blob);
  if (hitBody) {
    let o: THREE.Object3D | null = hitBody.object;
    while (o && !roots.includes(o as THREE.Group)) o = o.parent;
    const body = [...bodies.values()].find((b) => b.root === o);
    if (body) return { body };
  }
  const hit = ray.intersectObjects([...tilePick.keys()], false)[0];
  if (!hit || hit.instanceId == null) return {};
  return { cell: tilePick.get(hit.object as THREE.InstancedMesh)![hit.instanceId] };
}

const highlight = new THREE.Mesh(
  new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false })
);
highlight.visible = false;
scene3.add(highlight);

// drag to pan (the camera is then the audience's until the next shot); a click without a drag walks
let drag: { x: number; y: number; moved: boolean } | null = null;
renderer.domElement.addEventListener('pointerdown', (ev) => {
  drag = { x: ev.clientX, y: ev.clientY, moved: false };
});
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (drag && (ev.buttons & 1)) {
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    if (drag.moved || Math.hypot(dx, dy) > 5) {
      drag.moved = true;
      handHeld = true;
      // screen pixels to world: the frame is 2·half tall; right is (1,0,-1), up the screen is (-1,0,-1) on the floor
      const per = (2 * camNow.half) / zoom / view.clientHeight;
      const right = new THREE.Vector3(1, 0, -1).normalize();
      const up = new THREE.Vector3(-1, 0, -1).normalize().multiplyScalar(Math.SQRT2);
      camNow.at.addScaledVector(right, -dx * per).addScaledVector(up, dy * per);
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    }
    return;
  }
  const { cell } = pick(ev);
  const t = cell && tileAt(grid, cell[0], cell[1]);
  highlight.visible = !!t?.walk;
  if (cell && t) highlight.position.copy(tileTop(cell[0], cell[1])).add(new THREE.Vector3(0, 0.012, 0));
});
renderer.domElement.addEventListener('pointerup', (ev) => {
  const wasDrag = drag?.moved;
  drag = null;
  if (wasDrag) return;
  const { body, cell } = pick(ev);
  if (body) {
    selected = body.id;
    life?.select(body.id);
    return;
  }
  const who = selected ? bodies.get(selected) : [...bodies.values()].find((b) => b.id !== 'cue');
  if (!who || !cell) return;
  selected = who.id;
  walkTo(who, cell, performance.now() / 1000, null, true);
  // the audience's walk is on the wall clock, at the stage's pace
  if (who.walk) who.walk.t1 = who.walk.t0 + pathLength(who.walk.path) * 0.4;
});

const showSel = document.getElementById('show') as HTMLSelectElement;
showSel.addEventListener('change', () => load(showSel.value));
document.getElementById('restart')!.addEventListener('click', () => load(showSel.value));
const playBtn = document.getElementById('play') as HTMLButtonElement;
playBtn.addEventListener('click', () => {
  if (life) life.paused = !life.paused;
  else if (conductor.playing) conductor.pause();
  else conductor.play();
});
const scrub = document.getElementById('scrub') as HTMLInputElement;
// life has no song to scrub, and a seek would clear the stage of its minds' bodies
scrub.addEventListener('input', () => !life && conductor.seek((Number(scrub.value) / 1000) * conductor.total));
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-look]')) {
  btn.addEventListener('click', () => {
    if (life) return; // in life a look is the character's own (life.ts)
    lookMode = btn.dataset.look as typeof lookMode;
    for (const b of document.querySelectorAll<HTMLButtonElement>('[data-look]')) b.setAttribute('aria-pressed', String(b === btn));
    conductor.seek(conductor.songT); // recast at the same moment
  });
}
document.getElementById('whole')!.addEventListener('click', () => {
  handHeld = true;
  zoom = 1;
  camNow.at.set((grid.w - 1) / 2, 0, (grid.d - 1) / 2);
  camNow.half = Math.max(grid.w, grid.d) * 0.56;
});
document.getElementById('wander')!.addEventListener('click', () => {
  const now = performance.now() / 1000;
  for (const b of bodies.values()) {
    const goal: Cell = [Math.floor(Math.random() * grid.w), Math.floor(Math.random() * grid.d)];
    walkTo(b, goal, now, null, true);
    if (b.walk) b.walk.t1 = b.walk.t0 + pathLength(b.walk.path) * 0.4;
  }
});
view.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  zoom = Math.min(4, Math.max(0.4, zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)));
}, { passive: false });

/**
 * Lower every tall tile that stands in front of a character. The camera looks
 * down (1, 1, 1), so what hides a body at (c, r) is in front of it on both axes:
 * the tiles one and two steps toward the camera. A body's own row and column
 * one step forward hide its legs; the diagonal two steps out hides its head.
 */
const IN_FRONT: Cell[] = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [2, 0], [0, 2]];
function cutaway(): void {
  if (!tall.size) return;
  const cut = new Set<string>();
  for (const b of bodies.values()) {
    const c = Math.round(b.root.position.x);
    const r = Math.round(b.root.position.z);
    for (const [dc, dr] of IN_FRONT) cut.add(`${c + dc},${r + dr}`);
  }
  const touched = new Set<THREE.InstancedMesh>();
  for (const [key, t] of tall) {
    const want = cut.has(key);
    if (want === t.cut) continue;
    t.cut = want;
    t.mesh.setMatrixAt(t.index, want ? t.stub : t.full);
    touched.add(t.mesh);
  }
  for (const m of touched) {
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }
}

// frame timing, for the verdict
let msAvg = 0;
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const t0 = performance.now();
  conductor.tick(dt);
  const songT = conductor.songT;
  for (const b of bodies.values()) b.step(dt, songT, now / 1000);
  const lifeLine = life?.frame();
  for (const tick of propTicks) tick(now / 1000);
  cutaway();
  placeCamera(dt);
  renderer.render(scene3, cam);
  // bubbles ride the heads, in screen space
  const rect = renderer.domElement.getBoundingClientRect();
  const bubbleT = life ? now / 1000 : songT;
  for (const [id, b] of bubbles) {
    const body = bodies.get(id);
    if (!body || bubbleT > b.until || bubbleT < b.until - 30) {
      b.el.remove();
      bubbles.delete(id);
      continue;
    }
    const p = body.head().project(cam);
    b.el.style.left = `${((p.x + 1) / 2) * rect.width}px`;
    b.el.style.top = `${((1 - p.y) / 2) * rect.height}px`;
  }
  msAvg = msAvg * 0.95 + (performance.now() - t0) * 0.05;
  scrub.value = String(Math.round((songT / (conductor.total || 1)) * 1000));
  playBtn.textContent = (life ? !life.paused : conductor.playing) ? 'pause' : 'play';
  const walking = [...bodies.values()].filter((b) => b.walk).length;
  if (lifeLine !== undefined) {
    readout.textContent = `life · ${room.name} ${grid.w}×${grid.d} · ${bodies.size} minds on the tiles, ${walking} walking · ${msAvg.toFixed(1)} ms a frame · ${lifeLine}`;
    requestAnimationFrame(frame);
    return;
  }
  readout.textContent =
    `${show.title} · ${room.name} ${grid.w}×${grid.d} · ${songT.toFixed(1)} / ${conductor.total.toFixed(1)} s · ` +
    `${bodies.size} on the tiles, ${walking} walking · ${msAvg.toFixed(1)} ms a frame · ` +
    (selected ? `click a tile to walk ${selected}` : 'click a character, then a tile; drag to look around');
  requestAnimationFrame(frame);
}

load('shadow');
showSel.value = 'shadow';
requestAnimationFrame(frame);

// for the probe: what the page has on it
(window as unknown as { spike004: unknown }).spike004 = {
  bodies: () => [...bodies.values()].map((b) => ({ id: b.id, cell: b.cell, look: b.look, walking: !!b.walk })),
  msAvg: () => msAvg,
  seek: (t: number) => conductor.seek(t),
  total: () => conductor.total
};
