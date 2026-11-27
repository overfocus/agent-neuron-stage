// spike 004: scenery, built in code. Each prop is a small three.js group made
// of primitives, standing on the origin of its tile (y = 0 is the tile's top).
// They are the "built in code" end of the model question: no file, no licence,
// and every one could be exported to glTF the way make-model.mjs does the neuron.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { PropKind } from './rooms.ts';

const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, y = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A prop, and what it does each frame (a lamp flickers, a sun turns). */
export interface Built {
  object: THREE.Object3D;
  tick?: (t: number) => void;
}

export function buildProp(kind: PropKind): Built {
  switch (kind) {
    case 'column': {
      const g = new THREE.Group();
      const stone = std(0xe9e3d3, { roughness: 0.6 });
      g.add(mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), stone, 0.06));
      g.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.9, 16), stone, 1.07));
      g.add(mesh(new THREE.BoxGeometry(0.66, 0.14, 0.66), stone, 2.09));
      return { object: g };
    }
    case 'pine': {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6), std(0x6b4a2f), 0.25));
      const leaf = std(0x2f6b3c, { flatShading: true });
      [0, 1, 2].forEach((i) => g.add(mesh(new THREE.ConeGeometry(0.55 - i * 0.13, 0.75, 7), leaf, 0.75 + i * 0.42)));
      return { object: g };
    }
    case 'deadtree': {
      const g = new THREE.Group();
      const bark = std(0x2a2522, { flatShading: true });
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.5, 5), bark, 0.75));
      // bare branches, crooked and fixed: the same tree every time
      [[0.4, 1.0, 0.7], [-0.5, 1.2, -0.3], [0.2, 1.35, -0.6], [-0.3, 0.8, 0.5]].forEach(([x, y, z], i) => {
        const len = 0.5 + (i % 2) * 0.15;
        const b = mesh(new THREE.CylinderGeometry(0.015, 0.045, len, 4), bark);
        b.position.set(x! * 0.4, y!, z! * 0.4);
        b.lookAt(x! * 2, y! + 0.6, z! * 2);
        b.rotateX(Math.PI / 2);
        g.add(b);
      });
      return { object: g };
    }
    case 'lantern': {
      const g = new THREE.Group();
      const iron = std(0x2b2b2e, { metalness: 0.6, roughness: 0.4 });
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 8), iron, 0.75));
      const glass = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb040, emissiveIntensity: 1.6 });
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), glass, 1.6));
      g.add(mesh(new THREE.ConeGeometry(0.18, 0.14, 4).rotateY(Math.PI / 4), iron, 1.8));
      const light = new THREE.PointLight(0xffc070, 3, 5, 1.6);
      light.position.y = 1.6;
      g.add(light);
      // a slow, uneven flicker; the phase is from the lamp's place, so each lamp is its own
      return {
        object: g,
        tick: (t) => {
          const phase = g.position.x * 1.7 + g.position.z * 0.9;
          light.intensity = 3 + Math.sin(t * 7 + phase) * 0.25 + Math.sin(t * 13.1 + phase) * 0.15;
        }
      };
    }
    case 'mirror': {
      const g = new THREE.Group();
      const frame = std(0x9c7a3c, { metalness: 0.7, roughness: 0.35 });
      g.add(mesh(new THREE.BoxGeometry(0.9, 1.5, 0.08), frame, 0.95));
      // a real reflection: three's Reflector renders the room again from behind the glass
      const glass = new Reflector(new THREE.PlaneGeometry(0.76, 1.34), { textureWidth: 512, textureHeight: 512, color: 0xb8c4cc });
      glass.position.set(0, 0.95, 0.045);
      g.add(glass);
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), frame, 0.1));
      return { object: g };
    }
    case 'mask': {
      // the persona: a pale face on a stand, its back hollow
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.12, 0.9, 8), std(0x5a4632), 0.45));
      const face = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.3, side: THREE.DoubleSide })
      );
      face.rotation.x = Math.PI / 2;
      face.scale.set(0.8, 1, 1.1);
      face.position.set(0, 1.15, 0);
      face.castShadow = true;
      g.add(face);
      const hole = new THREE.MeshBasicMaterial({ color: 0x111111 });
      [-0.09, 0.09].forEach((x) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), hole);
        eye.scale.set(1.3, 0.6, 0.4);
        eye.position.set(x, 1.2, 0.27);
        g.add(eye);
      });
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16, Math.PI), hole);
      smile.rotation.z = Math.PI;
      smile.position.set(0, 1.06, 0.28);
      g.add(smile);
      return { object: g };
    }
    case 'blacksun': {
      // nigredo: a black disc with a black corona, hanging over the pool, turning slowly
      const g = new THREE.Group();
      const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2, metalness: 0.4, emissive: 0x120606 });
      const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16), black);
      g.add(sun);
      for (let i = 0; i < 16; i++) {
        const ray = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 5), black);
        const a = (i / 16) * Math.PI * 2;
        ray.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0);
        ray.rotation.z = a - Math.PI / 2;
        g.add(ray);
      }
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.05, 48), new THREE.MeshBasicMaterial({ color: 0x7a2a1a, side: THREE.DoubleSide }));
      g.add(halo);
      g.position.y = 3.6;
      const holder = new THREE.Group();
      holder.add(g);
      // it faces the camera's side of the room, so the disc reads as a disc
      g.rotation.y = Math.PI / 4;
      const spin = new THREE.Group();
      while (g.children.length) spin.add(g.children[0]!);
      g.add(spin);
      return { object: holder, tick: (t) => (spin.rotation.z = t * 0.12) };
    }
    case 'table': {
      // food: a plank table with bread and fruit, where hunger goes in life
      const g = new THREE.Group();
      const wood = std(0x7a5634);
      g.add(mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), wood, 0.5));
      [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]].forEach(([x, z]) => {
        const leg = mesh(new THREE.BoxGeometry(0.07, 0.48, 0.07), wood, 0.24);
        leg.position.x = x!;
        leg.position.z = z!;
        g.add(leg);
      });
      const loaf = mesh(new THREE.CapsuleGeometry(0.08, 0.18, 4, 8).rotateZ(Math.PI / 2), std(0xc98a3e), 0.6);
      loaf.position.x = -0.18;
      g.add(loaf);
      [0xc0392b, 0xe67e22, 0x8e44ad].forEach((c, i) => {
        const fruit = mesh(new THREE.SphereGeometry(0.06, 10, 8), std(c, { roughness: 0.5 }), 0.6);
        fruit.position.set(0.12 + i * 0.1, 0.6, (i - 1) * 0.08);
        g.add(fruit);
      });
      return { object: g };
    }
    case 'ouroboros': {
      // wholeness: a serpent ring swallowing its tail, over the circle
      const g = new THREE.Group();
      const scale = new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.45, metalness: 0.3, emissive: 0x0b1e10 });
      const body = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.11, 12, 64, Math.PI * 1.9), scale);
      g.add(body);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 8), scale);
      head.position.set(1.2, -0.02, 0);
      head.rotation.z = Math.PI; // its mouth at its own tail
      g.add(head);
      g.rotation.x = -Math.PI / 2;
      g.position.y = 2.9;
      const holder = new THREE.Group();
      holder.add(g);
      return { object: holder, tick: (t) => (holder.rotation.y = t * 0.25) };
    }
  }
}
