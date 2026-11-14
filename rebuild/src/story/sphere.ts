// The chrome sphere and its transformation into the Konnector mark.
// The sphere is 36 plates. Each plate has two shapes with the same grid of points:
// a patch of the sphere, and one piece of the mark (an arc of a ring node, or a length of a bar).
// The transformation lifts each plate off the sphere, turns it, then rolls it into its piece and locks it.
import * as THREE from 'three';

export const R = 0.3; // sphere radius, world units
const S = 0.0195; // world units per unit of the logo's 70 x 62 drawing
const NU = 10, NV = 6; // quads per plate
const VERTS = (NU + 1) * (NV + 1);
const TUBE = 2.5 * S; // half the logo's stroke width
const RING = 6.5 * S;

const logo = (x: number, y: number) => new THREE.Vector2((x - 35) * S, (31 - y) * S);
export const NODES = [logo(35, 9), logo(10, 51), logo(60, 51)]; // top, left, right
const BARS = [
  [logo(31.5, 14.5), logo(13.5, 45.5)], // straight, like the plan
  [logo(38.5, 14.5), logo(43, 22), logo(37, 33), logo(56.5, 45.5)], // bent, like the real world
  [logo(16.5, 51), logo(28, 51), logo(31, 47), logo(35, 51), logo(53.5, 51)], // the bump in the base
];

type Shape = (u: number, v: number, out: THREE.Vector3) => void;

function spherePlates(): Shape[] {
  const counts = [4, 8, 12, 8, 4];
  const lat = [-90, -54, -18, 18, 54, 90].map((d) => (d * Math.PI) / 180);
  const gap = 0.014;
  const out: Shape[] = [];
  counts.forEach((count, b) => {
    for (let i = 0; i < count; i++) {
      const lon0 = ((i + (b % 2) * 0.5) / count) * Math.PI * 2 + gap;
      const lon1 = ((i + 1 + (b % 2) * 0.5) / count) * Math.PI * 2 - gap;
      const la0 = lat[b] + (b === 0 ? 0 : gap), la1 = lat[b + 1] - (b === counts.length - 1 ? 0 : gap);
      out.push((u, v, p) => {
        const lon = lon0 + (lon1 - lon0) * u, la = la0 + (la1 - la0) * v;
        p.set(R * Math.cos(la) * Math.sin(lon), R * Math.sin(la), R * Math.cos(la) * Math.cos(lon));
      });
    }
  });
  return out;
}

function markPieces(): Shape[] {
  const out: Shape[] = [];
  const phi = (v: number) => -Math.PI / 2 + v * Math.PI * 2; // seam at the back
  // Ring nodes: 8 arcs each
  for (const c of NODES) {
    for (let i = 0; i < 8; i++) {
      const t0 = (i / 8) * Math.PI * 2, t1 = ((i + 1) / 8) * Math.PI * 2;
      out.push((u, v, p) => {
        const t = t0 + (t1 - t0) * u, f = phi(v), r = RING + TUBE * Math.cos(f);
        p.set(c.x + r * Math.cos(t), c.y + r * Math.sin(t), TUBE * Math.sin(f));
      });
    }
  }
  // Bars: tubes along each polyline, with mitred joints so the bends are clean
  for (const pts of BARS) {
    const dir = (a: THREE.Vector2, b: THREE.Vector2) => b.clone().sub(a).normalize();
    const perp = (d: THREE.Vector2) => new THREE.Vector2(-d.y, d.x);
    const miter = pts.map((_, j) => {
      const dIn = j > 0 ? dir(pts[j - 1], pts[j]) : null, dOut = j < pts.length - 1 ? dir(pts[j], pts[j + 1]) : null;
      if (!dIn) return perp(dOut!);
      if (!dOut) return perp(dIn);
      const m = perp(dIn).add(perp(dOut)).normalize();
      return m.multiplyScalar(1 / Math.max(0.35, m.dot(perp(dIn))));
    });
    for (let j = 0; j < pts.length - 1; j++) {
      const len = pts[j].distanceTo(pts[j + 1]);
      const parts = len > 30 * S ? 3 : len > 15 * S ? 2 : 1;
      for (let k = 0; k < parts; k++) {
        const s0 = k / parts, s1 = (k + 1) / parts;
        const a = pts[j], bb = pts[j + 1], ma = miter[j], mb = miter[j + 1];
        out.push((u, v, p) => {
          const s = s0 + (s1 - s0) * u, f = phi(v), c = TUBE * Math.cos(f);
          p.set(a.x + (bb.x - a.x) * s + (ma.x + (mb.x - ma.x) * s) * c, a.y + (bb.y - a.y) * s + (ma.y + (mb.y - ma.y) * s) * c, TUBE * Math.sin(f));
        });
      }
    }
  }
  return out;
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const inOut = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

export function buildPlates(detail: number) {
  const A = spherePlates(), B = markPieces();
  const count = Math.min(A.length, B.length); // 36
  const tmp = new THREE.Vector3();
  const sample = (shape: Shape) => {
    const arr = new Float32Array(VERTS * 3);
    const c = new THREE.Vector3();
    let k = 0;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      shape(i / NU, j / NV, tmp);
      arr[k++] = tmp.x; arr[k++] = tmp.y; arr[k++] = tmp.z;
      c.add(tmp);
    }
    return { arr, c: c.multiplyScalar(1 / VERTS) };
  };
  const a = A.map(sample), b = B.map(sample);
  // Pair plates with pieces by angle around the centre, so the plates sweep outward instead of crossing.
  const ang = (v: THREE.Vector3) => Math.atan2(v.y, v.x);
  const ai = a.map((_, i) => i).sort((p, q) => ang(a[p].c) - ang(a[q].c) || a[p].c.z - a[q].c.z);
  const bi = b.map((_, i) => i).sort((p, q) => ang(b[p].c) - ang(b[q].c));
  const pairs = ai.slice(0, count).map((p, n) => ({ a: a[p], b: b[bi[n]], order: (a[p].c.y / R + 1) / 2, spin: n % 2 ? 1 : -1 }));

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * VERTS * 3);
  const index: number[] = [];
  pairs.forEach((_, n) => {
    const o = n * VERTS;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const p0 = o + j * (NU + 1) + i, p1 = p0 + 1, p2 = p0 + NU + 1, p3 = p2 + 1;
      index.push(p0, p1, p3, p0, p3, p2);
    }
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);

  const axis = new THREE.Vector3(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  let last = -1;
  /** tau: 0 = sphere, 1 = mark. */
  const update = (tau: number) => {
    if (Math.abs(tau - last) < 1e-4) return;
    last = tau;
    pairs.forEach((pl, n) => {
      // Staggered start from the top of the sphere down; each plate takes 55% of the clip.
      const e = Math.min(1, Math.max(0, (tau - (1 - pl.order) * 0.42) / 0.55));
      const k1 = smooth(e / 0.4); // lift off and turn, as a rigid plate
      const k2 = inOut((e - 0.4) / 0.6); // travel, roll into the piece, lock
      axis.copy(pl.a.c).normalize();
      q.setFromAxisAngle(axis, k1 * (Math.PI / 2) * pl.spin * (1 - k2));
      const lift = 0.17 * k1 * (1 - k2);
      // Lock with a small overshoot (about 5%) and settle
      const x = (k2 - 0.8) / 0.2;
      const over = x > 0 && x < 1 ? 1 + 0.05 * Math.sin(Math.PI * x) : 1;
      const o = n * VERTS * 3;
      for (let i = 0; i < VERTS * 3; i += 3) {
        v.set(pl.a.arr[i] - pl.a.c.x, pl.a.arr[i + 1] - pl.a.c.y, pl.a.arr[i + 2] - pl.a.c.z).applyQuaternion(q);
        const ax = pl.a.c.x + v.x + axis.x * lift, ay = pl.a.c.y + v.y + axis.y * lift, az = pl.a.c.z + v.z + axis.z * lift;
        const bx = pl.b.c.x + (pl.b.arr[i] - pl.b.c.x) * over, by = pl.b.c.y + (pl.b.arr[i + 1] - pl.b.c.y) * over, bz = pl.b.c.z + (pl.b.arr[i + 2] - pl.b.c.z) * over;
        pos[o + i] = ax + (bx - ax) * k2;
        pos[o + i + 1] = ay + (by - ay) * k2;
        pos[o + i + 2] = az + (bz - az) * k2;
      }
    });
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
  update(0);
  void detail;
  return { geo, update };
}

/** Three seams on the sphere's face that trace the triangle of the mark: a hint of the ending. */
export function buildSeamTriangle(mat: THREE.Material) {
  const g = new THREE.Group();
  const corner = NODES.map((n) => {
    const x = n.x * 0.62, y = n.y * 0.62;
    return new THREE.Vector3(x, y, Math.sqrt(Math.max(0, R * R - x * x - y * y))).normalize();
  });
  for (let i = 0; i < 3; i++) {
    const a = corner[i], b = corner[(i + 1) % 3];
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) pts.push(a.clone().lerp(b, k / 16).normalize().multiplyScalar(R * 1.006));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 6), mat));
  }
  return g;
}

/** The mechanism inside: a hub and three pistons that push out toward the three nodes. */
export function buildMechanism(mat: THREE.Material, rodMat: THREE.Material) {
  const g = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 24), mat);
  hub.rotation.x = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16), rodMat);
  cap.rotation.x = Math.PI / 2;
  g.add(hub, cap);
  const rods: { rod: THREE.Mesh; len: number }[] = [];
  for (const n of NODES) {
    const len = n.length() - RING;
    const arm = new THREE.Group();
    arm.rotation.z = Math.atan2(n.y, n.x) - Math.PI / 2; // cylinders run along +y
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len * 0.5, 14), mat);
    barrel.position.y = len * 0.25 + 0.03;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.02, 14), rodMat);
    collar.position.y = len * 0.5 + 0.03;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 10), rodMat);
    arm.add(barrel, collar, rod);
    g.add(arm);
    rods.push({ rod, len });
  }
  const update = (tau: number) => {
    const show = smooth((tau - 0.04) / 0.14) * (1 - smooth((tau - 0.8) / 0.16));
    g.visible = show > 0.001;
    g.scale.setScalar(Math.max(0.001, show));
    const ext = smooth((tau - 0.12) / 0.38) * (1 - smooth((tau - 0.72) / 0.2));
    for (const { rod, len } of rods) {
      const l = Math.max(0.001, len * (0.45 + 0.55 * ext));
      rod.scale.y = l;
      rod.position.y = l / 2 + 0.03;
    }
  };
  update(0);
  return { group: g, update };
}

export const MARK_SCALE = S;
export const MARK_TUBE = TUBE;
export const MARK_RING = RING;
