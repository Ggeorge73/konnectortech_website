// Geometry for the story: one equipment corridor, drawn twice by the same shader
// (a "real" look and a "blueprint" look), plus the track and the skyline that only the blueprint shows.
// Everything is built in code from boxes, so the whole 3D asset download is zero bytes.
import * as THREE from 'three';

type BoxOpts = { shade?: number; sys?: number; glow?: number };

/** Merges many boxes into one mesh. Each face keeps 0..1 UVs so the blueprint shader can outline it. */
export class BoxBatch {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private shade: number[] = [];
  private sys: number[] = [];
  private glow: number[] = [];
  private idx: number[] = [];

  add(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, o: BoxOpts = {}) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    // [normal, tangent u, tangent v]
    const faces: [number[], number[], number[]][] = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    const h = [hx, hy, hz];
    for (const [n, u, v] of faces) {
      const base = this.pos.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        this.pos.push(
          cx + (n[0] + u[0] * a + v[0] * b) * h[0],
          cy + (n[1] + u[1] * a + v[1] * b) * h[1],
          cz + (n[2] + u[2] * a + v[2] * b) * h[2],
        );
        this.nor.push(n[0], n[1], n[2]);
        this.uv.push((a + 1) / 2, (b + 1) / 2);
        this.shade.push(o.shade ?? 0.3);
        this.sys.push(o.sys ?? 0);
        this.glow.push(o.glow ?? 0);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aShade', new THREE.Float32BufferAttribute(this.shade, 1));
    g.setAttribute('aSys', new THREE.Float32BufferAttribute(this.sys, 1));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.setIndex(this.idx);
    return g;
  }
}

// Deterministic pseudo-random, so the room is identical on every visit and in every still.
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const LIGHT_Z = [-1, -5, -9, -13, -17];
export const CORRIDOR_END = -20;

// The five systems the scan reveals. Anchors are where the labels sit and where the line passes.
export const SYSTEM_ANCHORS = [
  new THREE.Vector3(-0.95, 1.5, -5), // Finance (rack group, left)
  new THREE.Vector3(0.95, 1.45, -7.5), // Records (shelf of records, right)
  new THREE.Vector3(-0.95, 1.5, -10), // Operations (rack group, left)
  new THREE.Vector3(0.95, 1.2, -12.5), // Legacy system (old terminal, right)
  new THREE.Vector3(-0.95, 1.5, -15), // Vendor platform (rack group, left)
];
export const GATE_Z = [-26, -34, -44, -54, -64];
export const BLOCK_Z = -39;
export const FORK = new THREE.Vector3(0, 1.6, -80);
export const SPHERE_REST = new THREE.Vector3(0.75, 1.45, -3);
export const SKY_SYS = { public: 6, private: 7 };

function rack(b: BoxBatch, side: -1 | 1, z: number, sys: number, seed: number) {
  const x = side * 1.6;
  b.add(x, 1.05, z, 0.7, 2.1, 0.9, { shade: 0.1, sys });
  const fx = side * 1.24;
  for (let i = 0; i < 8; i++) {
    const y = 0.22 + i * 0.235;
    b.add(fx, y, z, 0.03, 0.19, 0.8, { shade: 0.14 + rnd(seed + i) * 0.14, sys });
    b.add(fx - side * 0.02, y + 0.04, z + 0.32, 0.02, 0.028, 0.05, { sys, glow: 1 }); // status light
  }
}

/** corridor = false builds only the skyline: used once the Blender-built corridor has loaded. */
export function buildWorld(corridor = true) {
  const b = new BoxBatch();
  if (corridor) buildCorridor(b);
  buildSkyline(b);
  return b.build();
}

function buildCorridor(b: BoxBatch) {

  // Shell: floor, ceiling and wall panels in 2 m bays
  for (let z = 3; z > CORRIDOR_END; z -= 2) {
    const zc = z - 1;
    // glow -1 marks the shell: see-through in the blueprint
    b.add(0, -0.05, zc, 4.4, 0.1, 2, { shade: 0.2, glow: -1 });
    b.add(0, 3.05, zc, 4.4, 0.1, 2, { shade: 0.12, glow: -1 });
    b.add(-2.15, 1.5, zc, 0.1, 3, 2, { shade: 0.17, glow: -1 });
    b.add(2.15, 1.5, zc, 0.1, 3, 2, { shade: 0.17, glow: -1 });
  }
  // Strip lights down the centre of the ceiling (glow 2+i = lit by light i)
  LIGHT_Z.forEach((z, i) => b.add(0, 2.96, z, 0.16, 0.05, 1.5, { glow: 2 + i }));

  // Cable trays and cables on both sides
  for (const side of [-1, 1] as const) {
    for (let z = 3; z > CORRIDOR_END; z -= 2) b.add(side * 1.45, 2.55, z - 1, 0.6, 0.04, 1.96, { shade: 0.22, glow: -1 });
    for (let c = 0; c < 4; c++) b.add(side * (1.25 + c * 0.13), 2.6, (3 + CORRIDOR_END) / 2, 0.035, 0.035, 3 - CORRIDOR_END, { shade: 0.05 + c * 0.02 });
  }

  // Racks. Three groups on the left are named systems; the rest is unnamed equipment.
  const leftSys: Record<number, number> = { [-4]: 1, [-5]: 1, [-6]: 1, [-9]: 3, [-10]: 3, [-11]: 3, [-14]: 5, [-15]: 5, [-16]: 5 };
  for (let z = -1; z >= -18; z--) {
    if (z === -8 || z === -12) continue; // gaps between groups
    rack(b, -1, z, leftSys[z] ?? 0, 100 + z);
  }
  for (const z of [-1, -2, -3, -4, -10, -15.5, -16.5, -17.5]) rack(b, 1, z, 0, 300 + z);

  // Shelf of records (right): the Records system
  {
    const z0 = -7.5, sys = 2;
    for (const y of [0.3, 0.9, 1.5, 2.1]) b.add(1.72, y, z0, 0.5, 0.04, 2.6, { shade: 0.2, sys });
    for (const dz of [-1.3, 0, 1.3]) b.add(1.72, 1.15, z0 + dz, 0.5, 2.3, 0.05, { shade: 0.16, sys });
    let n = 0;
    for (const y of [0.3, 0.9, 1.5]) {
      for (let z = z0 - 1.2; z < z0 + 1.15; ) {
        const w = 0.07 + rnd(n) * 0.13;
        const hgt = 0.34 + rnd(n + 50) * 0.16;
        if (rnd(n + 90) > 0.12) b.add(1.72, y + 0.02 + hgt / 2, z + w / 2, 0.38, hgt, w * 0.9, { shade: 0.16 + rnd(n + 7) * 0.3, sys });
        z += w + 0.012;
        n++;
      }
    }
  }
  // Old terminal on a desk (right): the Legacy system
  {
    const z0 = -12.5, sys = 4;
    b.add(1.7, 0.72, z0, 0.7, 0.06, 1.5, { shade: 0.22, sys });
    for (const dz of [-0.7, 0.7]) b.add(1.7, 0.36, z0 + dz, 0.66, 0.7, 0.05, { shade: 0.15, sys });
    b.add(1.74, 1.0, z0 + 0.15, 0.46, 0.44, 0.52, { shade: 0.3, sys }); // CRT body
    b.add(1.5, 1.01, z0 + 0.15, 0.02, 0.32, 0.4, { shade: 0.5, sys }); // screen
    b.add(1.52, 0.77, z0 + 0.15, 0.2, 0.03, 0.46, { shade: 0.26, sys }); // keyboard
    b.add(1.75, 0.95, z0 - 0.45, 0.42, 0.4, 0.18, { shade: 0.24, sys }); // tower
    b.add(1.72, 0.2, z0 - 0.3, 0.4, 0.4, 0.4, { shade: 0.18, sys }); // box of tapes
  }

}

function buildSkyline(b: BoxBatch) {
  // Blueprint skyline at the end of the track. Public mission on the left, private enterprise on the right.
  const Z = -112;
  const P = SKY_SYS.public, V = SKY_SYS.private;
  // City hall: stepped block, columns, small dome
  b.add(-7.6, 2, Z, 4.6, 4, 4, { sys: P });
  b.add(-7.6, 4.8, Z, 2.8, 1.6, 2.8, { sys: P });
  b.add(-7.6, 6.2, Z, 1.6, 1.2, 1.6, { sys: P });
  b.add(-7.6, 7.6, Z, 0.12, 1.6, 0.12, { sys: P });
  for (let i = 0; i < 6; i++) b.add(-9.6 + i * 0.8, 1.5, Z + 2.3, 0.22, 3, 0.22, { sys: P });
  b.add(-7.6, 3.2, Z + 2.3, 4.8, 0.3, 0.6, { sys: P });
  // School: long low block with a bell tower
  b.add(-3.2, 1.2, Z + 1, 3.6, 2.4, 3, { sys: P });
  b.add(-2.0, 3.2, Z + 1, 0.9, 1.6, 0.9, { sys: P });
  b.add(-2.0, 4.3, Z + 1, 1.1, 0.5, 1.1, { sys: P });
  for (let i = 0; i < 4; i++) b.add(-4.5 + i * 0.75, 1.3, Z + 2.52, 0.4, 0.9, 0.04, { sys: P });
  // Courthouse: block, pediment, columns, steps
  b.add(-5.4, 1.7, Z + 6, 4.2, 3.4, 3, { sys: P });
  b.add(-5.4, 3.7, Z + 6, 4.6, 0.5, 3.4, { sys: P });
  b.add(-5.4, 4.3, Z + 6, 3, 0.6, 3, { sys: P });
  for (let i = 0; i < 5; i++) b.add(-7.1 + i * 0.85, 1.6, Z + 7.75, 0.24, 3.2, 0.24, { sys: P });
  for (let i = 0; i < 3; i++) b.add(-5.4, 0.1 + i * 0.2, Z + 8.6 - i * 0.3, 4.4 - i * 0.3, 0.2, 0.5, { sys: P });
  // Office towers
  b.add(3.0, 5.5, Z, 2.4, 11, 2.4, { sys: V });
  b.add(5.9, 7.5, Z - 1, 2.6, 15, 2.6, { sys: V });
  b.add(5.9, 15.6, Z - 1, 0.1, 1.4, 0.1, { sys: V });
  b.add(8.6, 4.5, Z + 1, 2, 9, 2, { sys: V });
  for (let i = 1; i < 6; i++) b.add(5.9, i * 2.5, Z - 1, 2.64, 0.05, 2.64, { sys: V });
  for (let i = 1; i < 4; i++) b.add(3.0, i * 2.75, Z, 2.44, 0.05, 2.44, { sys: V });
  // Plant: low hall, saw-tooth roof, two stacks
  b.add(4.6, 1.2, Z + 6.5, 5.6, 2.4, 3.2, { sys: V });
  for (let i = 0; i < 4; i++) b.add(2.5 + i * 1.4, 2.7, Z + 6.5, 0.9, 0.6, 3.2, { sys: V });
  b.add(8.3, 3.2, Z + 6, 0.7, 6.4, 0.7, { sys: V });
  b.add(9.3, 2.6, Z + 6.8, 0.6, 5.2, 0.6, { sys: V });
}

/** The one line. From the sphere's resting place, through all five systems, down the track, to the fork. */
export function buildPath() {
  const pts: THREE.Vector3[] = [SPHERE_REST.clone(), new THREE.Vector3(0.2, 1.5, -4)];
  SYSTEM_ANCHORS.forEach((a) => pts.push(a.clone()));
  pts.push(new THREE.Vector3(-0.3, 1.4, -17), new THREE.Vector3(0, 1.25, -19), new THREE.Vector3(0, 1.2, -22));
  for (let z = -26; z >= -34; z -= 4) pts.push(new THREE.Vector3(0, 1.2, z));
  // The bend: the plan meets a surprise, goes around it and carries on
  pts.push(new THREE.Vector3(0.25, 1.2, BLOCK_Z + 2.6), new THREE.Vector3(1.35, 1.2, BLOCK_Z + 0.9), new THREE.Vector3(1.35, 1.2, BLOCK_Z - 0.9), new THREE.Vector3(0.25, 1.2, BLOCK_Z - 2.6));
  for (let z = -44; z >= -76; z -= 4) pts.push(new THREE.Vector3(0, 1.2, z));
  pts.push(new THREE.Vector3(0, 1.4, -78.5), FORK.clone());
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = 1200;

  // Lookup tables: arc-length u for a given depth z (depth only ever increases along the line)
  const N = 1200;
  const zs = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) zs[i] = curve.getPointAt(i / N).z;
  const uAtZ = (z: number) => {
    let lo = 0, hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (zs[mid] > z) lo = mid; else hi = mid;
    }
    const span = zs[lo] - zs[hi] || 1;
    return (lo + (zs[lo] - z) / span) / N;
  };
  const uAnchors = SYSTEM_ANCHORS.map((a) => uAtZ(a.z));
  return { curve, uAtZ, uAnchors, uTrack: uAtZ(-19), uEnd: 1 };
}

/** Sub-curve between two arc-length positions, as a polyline curve for tubes. */
export function subCurve(curve: THREE.Curve<THREE.Vector3>, u0: number, u1: number, n = 40) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) pts.push(curve.getPointAt(u0 + ((u1 - u0) * i) / n));
  return new THREE.CatmullRomCurve3(pts);
}
