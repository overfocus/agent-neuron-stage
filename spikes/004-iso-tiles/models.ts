// spike 004: the models a character may be drawn as, and how a model plays a pose.
//
// The table is the page's: a score or a payload names a key here, never a file.
//   neuron  a glTF file made by make-model.mjs (no rig: it gestures)
//   glass   built in code (no rig: it gestures)
//   robot   three.js's RobotExpressive (CC0, models/robot/README.md): a rigged
//           body with 14 animation clips and three face morphs
//   shadow  the same robot, every material black: the same body, unlit
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** One model, ready to stand on a tile: its object, and its clips if it has a rig. */
export interface Loaded {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
}

const files = new Map<string, Promise<GLTF>>();
function file(url: string): Promise<GLTF> {
  if (!files.has(url)) files.set(url, new GLTFLoader().loadAsync(url));
  return files.get(url)!;
}

/** A copy that can animate on its own: SkeletonUtils keeps each copy's bones its own. Materials are copied too. */
async function instance(url: string, height: number, recolour?: (m: THREE.MeshStandardMaterial) => void): Promise<Loaded> {
  const gltf = await file(url);
  const object = cloneSkinned(gltf.scene);
  object.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    n.castShadow = true;
    const mats = (Array.isArray(n.material) ? n.material : [n.material]).map((m: THREE.Material) => {
      const copy = m.clone() as THREE.MeshStandardMaterial;
      recolour?.(copy);
      return copy;
    });
    n.material = Array.isArray(n.material) ? mats : mats[0]!;
  });
  // every model stands `height` tall with its feet on the tile, whatever units it was made in.
  // A fresh clone's world matrices are stale: without this the robot (whose armature
  // scales its centimetre meshes ×100) measures a hundred times too small.
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  const k = height / (size.y || 1);
  const holder = new THREE.Group();
  object.scale.setScalar(k);
  object.position.y = -box.min.y * k;
  holder.add(object);
  return { object: holder, clips: gltf.animations };
}

const here = (p: string): string => new URL(p, import.meta.url).href;

export const MODELS: Record<string, { label: string; load: () => Promise<Loaded> }> = {
  neuron: { label: 'neuron (glTF, no rig)', load: () => instance(here('./models/neuron.gltf'), 1.15) },
  glass: { label: 'glass (built in code)', load: async () => ({ object: glassNeuron(), clips: [] }) },
  robot: { label: 'robot (rigged, 14 clips)', load: () => instance(here('./models/robot/RobotExpressive.glb'), 1.35) },
  shadow: {
    label: 'shadow (the robot, unlit)',
    load: () =>
      instance(here('./models/robot/RobotExpressive.glb'), 1.35, (m) => {
        m.color.setHex(0x0b0a0f);
        m.roughness = 0.35;
        m.metalness = 0.2;
        if ('emissive' in m) m.emissive.setHex(0x14081e);
        m.transparent = true;
        m.opacity = 0.9;
      })
  }
};

function glassNeuron(): THREE.Object3D {
  const g = new THREE.Group();
  const soma = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshPhysicalMaterial({ color: 0x9fe3ff, roughness: 0.05, transmission: 0.6, thickness: 0.5, flatShading: true })
  );
  soma.name = 'soma';
  soma.position.y = 0.6;
  g.add(soma);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 40), new THREE.MeshStandardMaterial({ color: 0x5ab8e0 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.6;
  g.add(ring);
  return g;
}

// ── a pose, on a rigged model ───────────────────────────────────────────────

/** How a clip plays: once and back to standing, held at its last frame, or looping until the next pose. */
type Play = 'once' | 'hold' | 'loop';
const CLIP_PLAY: Record<string, Play> = {
  Wave: 'once', Yes: 'once', No: 'once', ThumbsUp: 'once', Punch: 'once', Jump: 'once', Standing: 'once', WalkJump: 'once',
  Death: 'hold', Sitting: 'hold',
  Dance: 'loop'
};

/**
 * A pose name to a clip. A clip's own name always works (`pose: 'Sitting'`);
 * otherwise maxcot's pose names are read by family, so a score written for
 * maxcot characters still moves a robot. Null: no clip, the body stands.
 */
export function clipFor(pose: string): string | null {
  if (CLIP_PLAY[pose]) return pose;
  const rules: [RegExp, string][] = [
    [/wave|cheer|arms-up|present/, 'Wave'],
    [/thumbsup|deal|pleased|proud|peace/, 'ThumbsUp'],
    [/nod|yes|agree|bow/, 'Yes'],
    [/refus|stop|shake|^no$|point-you/, 'No'],
    [/fists|furious|feel-angry/, 'Punch'],
    [/surprised|terrified|recoil/, 'Jump'],
    [/slump|collapse|faint/, 'Death'],
    [/sit/, 'Sitting'],
    [/dance|excited|bounce/, 'Dance'],
    [/rise|getup|stand/, 'Standing']
  ];
  for (const [re, clip] of rules) if (re.test(pose)) return clip;
  return null;
}

/** A pose name to the robot's face: one of its three morphs, or none. */
export function faceFor(pose: string): 'Angry' | 'Surprised' | 'Sad' | null | undefined {
  if (/angry|furious|fedup|fists/.test(pose)) return 'Angry';
  if (/sad|sulk|tired|slump|crying|collapse|Death/.test(pose)) return 'Sad';
  if (/surprised|terrified|wide|recoil/.test(pose)) return 'Surprised';
  if (/rest|happy|pleased|neutral|Standing/.test(pose)) return null; // clears the face
  return undefined; // leaves it
}

/**
 * The animation of one rigged body. Everything is a function of song time,
 * so a seek lands a held clip at its end and a wave half done.
 */
export class Rig {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private base: THREE.AnimationAction | null = null;
  private baseName = '';
  private gesture: { name: string; action: THREE.AnimationAction } | null = null;
  private faces: { mesh: THREE.Mesh; index: Record<string, number> }[] = [];
  private faceTo: Record<string, number> = {};

  constructor(object: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(object);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    object.traverse((n) => {
      if (n instanceof THREE.Mesh && n.morphTargetDictionary && n.morphTargetInfluences) this.faces.push({ mesh: n, index: n.morphTargetDictionary });
    });
    this.setBase('Idle');
  }

  has(clip: string): boolean {
    return this.actions.has(clip);
  }

  /** Idle, Walking or Running underneath whatever the body is doing. */
  setBase(name: string, timeScale = 1): void {
    const next = this.actions.get(name);
    if (!next) return;
    next.timeScale = timeScale;
    if (this.baseName === name) return;
    next.reset().play();
    if (this.base) next.crossFadeFrom(this.base, 0.25, false);
    this.base = next;
    this.baseName = name;
  }

  /** Play a clip that started `since` seconds ago (0 when it starts now). */
  play(name: string, since: number): void {
    const action = this.actions.get(name);
    if (!action) return;
    const how = CLIP_PLAY[name] ?? 'once';
    const length = action.getClip().duration;
    if (how === 'once' && since >= length) {
      this.stopGesture();
      return; // long over: a seek does not replay a wave that has finished
    }
    if (this.gesture && this.gesture.action !== action) this.gesture.action.fadeOut(0.2);
    action.reset();
    action.setLoop(how === 'loop' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = how === 'hold';
    action.time = how === 'loop' ? since % length : Math.min(since, length);
    action.setEffectiveWeight(1).fadeIn(since > 0 ? 0 : 0.2).play();
    this.gesture = { name, action };
  }

  stopGesture(): void {
    if (this.gesture) this.gesture.action.fadeOut(0.3);
    this.gesture = null;
  }

  face(name: 'Angry' | 'Surprised' | 'Sad' | null, snap: boolean): void {
    this.faceTo = name ? { [name]: 1 } : {};
    if (snap) this.easeFace(1);
  }

  private easeFace(k: number): void {
    for (const { mesh, index } of this.faces) {
      for (const [key, i] of Object.entries(index)) {
        const want = this.faceTo[key] ?? 0;
        const now = mesh.morphTargetInfluences![i]!;
        mesh.morphTargetInfluences![i] = now + (want - now) * k;
      }
    }
  }

  update(dt: number): void {
    // a one-shot that has run out hands the body back to its base
    if (this.gesture && !this.gesture.action.isRunning() && !this.gesture.action.clampWhenFinished) this.stopGesture();
    this.mixer.update(dt);
    this.easeFace(Math.min(1, dt * 6));
  }

  /** Is the body busy with a gesture that holds it (sitting, fallen)? Then it does not walk on top of it. */
  get held(): boolean {
    return !!this.gesture && this.gesture.action.clampWhenFinished;
  }
}
