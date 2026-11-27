// spike 004: write models/neuron.gltf, the one real model file the spike loads.
//
// A neuron built from three's primitives (a soma, five dendrites, an axon with
// a terminal) and exported with three's own GLTFExporter, so the page loads it
// through GLTFLoader exactly as it would load a model someone made in Blender.
// The pieces are named (soma, dendrite-n, axon, terminal) so the page can find
// the soma and light it when the character speaks.
//
//   node spikes/004-iso-tiles/make-model.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter turns its buffer into a data: URI through FileReader, which Node lacks.
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,` + Buffer.from(buf).toString('base64');
      this.onloadend?.();
    });
  }
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

const soma = new THREE.MeshStandardMaterial({ color: 0xe8a0c8, roughness: 0.45, metalness: 0.05 });
const fibre = new THREE.MeshStandardMaterial({ color: 0xc77aa6, roughness: 0.6 });

const root = new THREE.Group();
root.name = 'neuron';

const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 2), soma);
body.name = 'soma';
body.position.y = 0.62;
root.add(body);

/** A fibre from one point to another, as a tapered cylinder. */
function fibreBetween(name, a, b, r0, r1) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const len = from.distanceTo(to);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7), fibre);
  mesh.name = name;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  root.add(mesh);
}

// five dendrites up and out, an axon down to the floor, a terminal where it lands
const c = [0, 0.62, 0];
for (let i = 0; i < 5; i++) {
  const a = (i / 5) * Math.PI * 2 + 0.3;
  fibreBetween(`dendrite-${i + 1}`, c, [Math.cos(a) * 0.5, 0.95 + (i % 2) * 0.15, Math.sin(a) * 0.5], 0.05, 0.012);
}
fibreBetween('axon', c, [0.04, 0.08, 0.02], 0.05, 0.035);
const end = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), fibre);
end.name = 'terminal';
end.position.set(0.04, 0.06, 0.02);
root.add(end);

const out = fileURLToPath(new URL('./models/neuron.gltf', import.meta.url));
mkdirSync(fileURLToPath(new URL('./models/', import.meta.url)), { recursive: true });
new GLTFExporter().parse(
  root,
  (gltf) => {
    writeFileSync(out, JSON.stringify(gltf, null, 1) + '\n');
    console.log('wrote', out);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  { binary: false }
);
