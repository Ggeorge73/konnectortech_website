'use client';
// The story: scene layer (React Three Fiber) + HUD layer, both driven by one number, story time T.
// Loaded after first paint, only in story mode. The content layer never depends on it.
import { Component, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { createDirector, CENTRE, type Director, type Tier } from './director';
import { createScrollTime, type ScrollTime } from './scrollTime';
import { BLOCK_Z, buildWorld, FORK, GATE_Z, subCurve } from './world';
import { loadRoom, type RoomAssets } from './room';
import { loadSphereClip, type SphereClip } from './sphereClip';
import { BLOOM_LAYER, createBloom, OVERLAY_LAYER, type Bloom } from './bloom';

// Model and texture downloads still in flight. The frame loop warms up shaders once this reaches zero.
const pending = { count: 0 };
import { buildMechanism, buildPlates, buildSeamTriangle, MARK_RING, MARK_TUBE, NODES, R } from './sphere';
import { AMBER, CHROME_FRAG, CHROME_VERT, clamp, CYAN, glowTexture, GRID_FRAG, GRID_VERT, LINK_FRAG, LINK_VERT, mix, NIGHT, ROOM_FRAG, ROOM_VERT, smooth, WIRE } from './shaders';
import { createOverlay } from './overlay';
import { createSound } from './sound';

type Props = { stage: RefObject<HTMLDivElement | null>; hud: RefObject<HTMLDivElement | null>; onFail: (reason: string) => void };
type Env = { rt: THREE.WebGLCubeRenderTarget; cam: THREE.CubeCamera };
const RADIAL = 6, TUBULAR = 900;

/** The room, drawn twice by one shader. Its only inputs are the mask and light uniforms, so the geometry can be swapped for a Blender model later. */
// The corridor is the Blender-built model (baked lighting + blueprint line set). Until it has loaded, or if it
// cannot load, the coded stand-in is drawn, so the story never waits on a download. The skyline is always coded.
function Corridor({ uniforms }: { uniforms: Director['roomU'] }) {
  const gl = useThree((st) => st.gl);
  const [assets, setAssets] = useState<RoomAssets | null>(null);
  const geometry = useMemo(() => buildWorld(!assets), [assets]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    let cancelled = false, loaded: RoomAssets | null = null;
    const tier = document.documentElement.dataset.tier === 'full' ? 'full' : 'light';
    pending.count++;
    loadRoom(gl, tier, uniforms as unknown as Record<string, THREE.IUniform>)
      .then((a) => { if (cancelled) a.dispose(); else { loaded = a; setAssets(a); } })
      .catch((err) => console.warn('Blender room not loaded; using the stand-in', err))
      .finally(() => { pending.count--; });
    return () => { cancelled = true; loaded?.dispose(); };
  }, [gl, uniforms]);
  return (
    <>
      <mesh geometry={geometry} frustumCulled={false}>
        <shaderMaterial args={[{ vertexShader: ROOM_VERT, fragmentShader: ROOM_FRAG, uniforms }]} />
      </mesh>
      {assets ? <primitive object={assets.mesh} /> : null}
      {assets ? <primitive object={assets.lines} /> : null}
    </>
  );
}

/** Faint blueprint grid under the track and the skyline. */
function GridFloor({ s }: { s: Director }) {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uOpacity: { value: 0 }, uWire: { value: WIRE } }), []);
  useFrame(() => {
    uniforms.uOpacity.value = s.finale ? 0 : s.sweep;
    if (mesh.current) mesh.current.visible = uniforms.uOpacity.value > 0.01;
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, -0.02, -95]}>
      <planeGeometry args={[160, 150]} />
      <shaderMaterial args={[{ vertexShader: GRID_VERT, fragmentShader: GRID_FRAG, uniforms, transparent: true, depthWrite: false }]} />
    </mesh>
  );
}

/** The one line, the amber links it replaces, and the two branches at the fork. */
function Lines({ s }: { s: Director }) {
  const line = useRef<THREE.Mesh>(null), halo = useRef<THREE.Mesh>(null);
  const branchRefs = useRef<(THREE.Mesh | null)[]>([]);
  const built = useMemo(() => {
    const { curve, uAnchors } = s.path;
    const hasGap = [true, true, false, true]; // three of the four links stop short with a visible gap
    const gapOf = [0, 1, -1, 2]; // which gap (Gap 01, 02, 03) each of the four links leads to
    const links: { geometry: THREE.TubeGeometry; material: THREE.ShaderMaterial; u0: number; u1: number; gap: number; hot: boolean; mesh: THREE.Mesh | null }[] = [];
    for (let i = 0; i < 4; i++) {
      const a = uAnchors[i], b = uAnchors[i + 1];
      for (const [u0, u1] of hasGap[i] ? [[a, mix(a, b, 0.36)], [mix(a, b, 0.64), b]] : [[a, b]]) {
        links.push({
          u0, u1, mesh: null, gap: gapOf[i], hot: false,
          geometry: new THREE.TubeGeometry(subCurve(curve, u0, u1), 48, 0.014, 5),
          material: new THREE.ShaderMaterial({ vertexShader: LINK_VERT, fragmentShader: LINK_FRAG, transparent: true, uniforms: { uColor: { value: AMBER }, uDashes: { value: Math.max(3, Math.round((u1 - u0) * 260)) }, uOpacity: { value: 0 }, uCut: { value: 0 }, uHot: { value: 0 } } }),
        });
      }
    }
    const main = new THREE.TubeGeometry(curve, TUBULAR, 0.016, RADIAL);
    const branches = [-1, 1].map((side) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([FORK.clone(), new THREE.Vector3(side * 1.2, 1.5, -84), new THREE.Vector3(side * 4.2, 1.2, -92), new THREE.Vector3(side * 5.4, 0.6, -104)]), 120, 0.03, RADIAL));
    // A soft cyan halo around the line stands in for bloom: glow on the connected line only, Full tier only
    const halo = new THREE.TubeGeometry(curve, 300, 0.07, RADIAL);
    return { links, main, branches, halo };
  }, [s]);
  useEffect(() => () => { built.main.dispose(); built.halo.dispose(); built.branches.forEach((g) => g.dispose()); built.links.forEach((l) => { l.geometry.dispose(); l.material.dispose(); }); }, [built]);

  useFrame(() => {
    if (line.current) {
      line.current.visible = !s.finale && s.T >= 2;
      built.main.setDrawRange(0, Math.floor(clamp(s.u) * TUBULAR) * RADIAL * 6);
      built.halo.setDrawRange(0, Math.floor(clamp(s.u) * 300) * RADIAL * 6);
      line.current.layers.enable(BLOOM_LAYER); // Full tier: real bloom on the line. Light tier: the soft halo below stands in for it.
      if (halo.current) { halo.current.layers.set(OVERLAY_LAYER); halo.current.visible = s.tier === 'light' && line.current.visible; }
    }
    for (const l of built.links) {
      if (l.mesh) l.mesh.visible = s.linkOpacity > 0.001 && s.u < l.u1;
      // Scene 2: the dashed path to the chosen gap brightens (and takes the existing bloom on Full); the others dim
      const chosen = s.T < 2 ? s.gap : -1, hot = chosen >= 0 && l.gap === chosen;
      l.material.uniforms.uOpacity.value = s.linkOpacity * (chosen >= 0 && !hot ? 0.28 : 1);
      l.material.uniforms.uHot.value = hot ? 1 : 0;
      if (l.mesh && l.hot !== hot) { l.hot = hot; if (hot) l.mesh.layers.enable(BLOOM_LAYER); else l.mesh.layers.disable(BLOOM_LAYER); }
      l.material.uniforms.uCut.value = clamp((s.u - l.u0) / (l.u1 - l.u0));
    }
    built.branches.forEach((g, i) => {
      const m = branchRefs.current[i];
      if (m) m.visible = s.branchP > 0.001;
      g.setDrawRange(0, Math.floor(s.branchP * 120) * RADIAL * 6);
      branchRefs.current[i]?.layers.enable(BLOOM_LAYER);
    });
  });
  return (
    <>
      <mesh ref={line} geometry={built.main} frustumCulled={false}><meshBasicMaterial color={CYAN} toneMapped={false} /></mesh>
      <mesh ref={halo} geometry={built.halo} frustumCulled={false} visible={false}><meshBasicMaterial color={CYAN} toneMapped={false} transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      {built.links.map((l, i) => <mesh key={i} ref={(m) => { l.mesh = m; }} geometry={l.geometry} material={l.material} />)}
      {built.branches.map((g, i) => <mesh key={i} ref={(m) => { branchRefs.current[i] = m; }} geometry={g} frustumCulled={false}><meshBasicMaterial color={CYAN} toneMapped={false} /></mesh>)}
    </>
  );
}

/** Five ring gates that lock with a quarter turn, and the amber block the line bends around. */
function Gates({ s }: { s: Director }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(() => GATE_Z.map(() => new THREE.MeshBasicMaterial({ color: WIRE.clone(), toneMapped: false, transparent: true, opacity: 0.55 })), []);
  const ring = useMemo(() => new THREE.TorusGeometry(0.95, 0.03, 8, 64), []);
  const tick = useMemo(() => new THREE.BoxGeometry(0.05, 0.22, 0.05), []);
  const blockGeo = useMemo(() => new THREE.BoxGeometry(1.3, 1.9, 1.5), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(blockGeo), [blockGeo]);
  const block = useRef<THREE.Group>(null);
  useEffect(() => () => { mats.forEach((m) => m.dispose()); ring.dispose(); tick.dispose(); blockGeo.dispose(); edges.dispose(); }, [mats, ring, tick, blockGeo, edges]);
  useFrame(() => {
    GATE_Z.forEach((_, i) => {
      const g = groups.current[i], k = s.gateLock[i];
      if (!g) return;
      g.rotation.z = (Math.PI / 2) * (k + 0.05 * Math.sin(Math.PI * clamp((k - 0.7) / 0.3))); // quarter turn, small overshoot, settle
      mats[i].color.copy(WIRE).lerp(CYAN, k);
      mats[i].opacity = 0.5 + 0.5 * k;
      g.visible = !s.finale && s.T > 2.6;
      for (const c of g.children) { if (k > 0.5) c.layers.enable(BLOOM_LAYER); else c.layers.disable(BLOOM_LAYER); } // a ring glows once it has locked
    });
    if (block.current) {
      block.current.visible = s.rise > 0.001;
      block.current.scale.set(1, Math.max(0.001, s.rise), 1);
      block.current.position.y = 0.95 * s.rise;
    }
  });
  return (
    <>
      {GATE_Z.map((z, i) => (
        <group key={z} ref={(g) => { groups.current[i] = g; }} position={[0, 1.2, z]}>
          <mesh geometry={ring} material={mats[i]} />
          {[0, 1, 2, 3].map((n) => <mesh key={n} geometry={tick} material={mats[i]} position={[Math.cos((n * Math.PI) / 2) * 0.95, Math.sin((n * Math.PI) / 2) * 0.95, 0]} rotation-z={(n * Math.PI) / 2 + Math.PI / 2} />)}
        </group>
      ))}
      <group ref={block} position={[0, 0, BLOCK_Z]}>
        <mesh geometry={blockGeo}><meshBasicMaterial color="#070503" /></mesh>
        <lineSegments geometry={edges}><lineBasicMaterial color={AMBER} toneMapped={false} /></lineSegments>
      </group>
    </>
  );
}

/** The chrome sphere: 36 plates that unfold into the Konnector mark, with the mechanism inside. */
function Sphere({ s, env }: { s: Director; env: Env }) {
  const turn = useRef<THREE.Group>(null), core = useRef<THREE.Mesh>(null), arrive = useRef<THREE.Mesh>(null);
  const b = useMemo(() => {
    const chromeU = { uEnv: { value: env.rt.texture }, uRough: { value: 0.02 }, uGain: { value: 2.4 }, uEdge: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uCyan: { value: CYAN } };
    const metal = (tint: THREE.Color, rough: number) => new THREE.ShaderMaterial({ vertexShader: CHROME_VERT, fragmentShader: CHROME_FRAG, uniforms: { ...chromeU, uTint: { value: tint }, uRough: { value: rough }, uEdge: { value: 0 } } });
    const chrome = new THREE.ShaderMaterial({ vertexShader: CHROME_VERT, fragmentShader: CHROME_FRAG, uniforms: chromeU, side: THREE.DoubleSide });
    const dark = metal(new THREE.Color(0.32, 0.36, 0.42), 0.35), rod = metal(new THREE.Color(1.1, 1.15, 1.2), 0.1);
    const seamMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, toneMapped: false });
    const glow = glowTexture();
    const nodes = NODES.map(() => ({
      sprite: new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }),
      ring: new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, toneMapped: false }),
    }));
    const arriveGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-4.5, NODES[1].y - 0.1, 0), new THREE.Vector3(-2, NODES[1].y - 0.02, 0), new THREE.Vector3(NODES[1].x - MARK_RING, NODES[1].y, 0)]), 80, 0.012, RADIAL);
    return { chromeU, chrome, dark, rod, seamMat, glow, nodes, arriveGeo, plates: buildPlates(1), seams: buildSeamTriangle(seamMat), mech: buildMechanism(dark, rod), nodeRing: new THREE.TorusGeometry(MARK_RING, 0.0045, 6, 48) };
  }, [env]);
  useEffect(() => () => {
    [b.chrome, b.dark, b.rod, b.seamMat, ...b.nodes.flatMap((n) => [n.sprite, n.ring])].forEach((m) => m.dispose());
    [b.plates.geo, b.arriveGeo, b.nodeRing].forEach((g) => g.dispose());
    b.glow.dispose();
    for (const group of [b.seams, b.mech.group]) group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }, [b]);

  // The Blender-animated transformation replaces the coded plates once it has loaded
  const [clip, setClip] = useState<SphereClip | null>(null);
  useEffect(() => {
    let cancelled = false, loaded: SphereClip | null = null;
    pending.count++;
    loadSphereClip({ plate: b.chrome, mechanism: b.dark, rod: b.rod })
      .then((c) => { if (cancelled) c.dispose(); else { loaded = c; setClip(c); } })
      .catch((err) => console.warn('Blender sphere clip not loaded; using the coded plates', err))
      .finally(() => { pending.count--; });
    return () => { cancelled = true; loaded?.dispose(); };
  }, [b]);

  useFrame(() => {
    const ball = s.ball;
    if (!ball) return;
    const { tau, q, finale, done, time } = s;
    ball.position.copy(s.spherePos);
    ball.position.y += Math.sin(time * 0.9) * 0.022 * s.hover; // at rest it hovers and turns slowly
    if (turn.current) turn.current.rotation.y = Math.sin(time * 0.22) * 0.4 * s.hover;
    if (clip) clip.setProgress(tau);
    else { b.plates.update(tau); b.mech.update(tau); }
    core.current?.scale.setScalar(Math.max(0.001, 1 - smooth((tau - 0.08) / 0.2)));
    b.chromeU.uRough.value = mix(0.02, 0.3, smooth((tau - 0.75) / 0.25)); // mirror chrome becomes brushed chrome
    b.chromeU.uEdge.value = done * 0.55;
    // Triangle seams: pulse once on arrival, rest faint, open again before the transformation
    b.seamMat.opacity = tau > 0.25 ? 0 : Math.max(0.5, s.pulse, finale ? smooth((q - 0.1) / 0.1) : 0) * (1 - smooth((tau - 0.1) / 0.15));
    b.nodes.forEach((n, i) => {
      const on = smooth((done - i * 0.2) / 0.5);
      n.sprite.opacity = on * (s.tier === 'full' ? 0.25 : 0.85);
      n.ring.opacity = on;
    });
    if (arrive.current) { arrive.current.visible = s.arriveP > 0.001; arrive.current.layers.enable(BLOOM_LAYER); }
    b.seams.traverse((o) => o.layers.enable(BLOOM_LAYER));
    // On Full the node glow comes from the bloom; the sprites are the Light-tier stand-in
    b.arriveGeo.setDrawRange(0, Math.floor(s.arriveP * 80) * RADIAL * 6);
  });

  return (
    <group ref={(g) => { s.ball = g; }}>
      <group ref={turn}>
        {clip ? <primitive object={clip.scene} /> : <mesh geometry={b.plates.geo} material={b.chrome} frustumCulled={false} />}
        <mesh ref={core}><sphereGeometry args={[R * 0.975, 32, 20]} /><meshBasicMaterial color="#03060b" /></mesh>
        <primitive object={b.seams} />
      </group>
      {clip ? null : <primitive object={b.mech.group} />}
      {NODES.map((n, i) => (
        <group key={i} position={[n.x, n.y, 0]}>
          <sprite ref={(o) => { o?.layers.set(OVERLAY_LAYER); }} material={b.nodes[i].sprite} position={[0, 0, 0.02]} scale={MARK_RING * 5.2} />
          <mesh ref={(o) => { o?.layers.enable(BLOOM_LAYER); }} geometry={b.nodeRing} material={b.nodes[i].ring} position={[0, 0, MARK_TUBE + 0.002]} />
        </group>
      ))}
      {/* The line arrives from the edge of the screen and joins the mark's first node */}
      <mesh ref={arrive} geometry={b.arriveGeo} frustumCulled={false}><meshBasicMaterial color={CYAN} toneMapped={false} /></mesh>
    </group>
  );
}

const C_REST = new THREE.Vector3(0, 1.55, 2.2), L_REST = new THREE.Vector3(0.35, 1.4, -6);
const C_SCAN = new THREE.Vector3(1.9, 2.3, 2.0), L_SCAN = new THREE.Vector3(-1.2, 1.2, -9.5); // still inside the room, a little higher and closer
const C_DOORS = new THREE.Vector3(0, 2.3, -74.4), L_DOORS = new THREE.Vector3(0, 3.6, -112);

/** Runs the frame: director, camera, mask inputs, reflections, the draw itself, then the HUD and content layer. */
function Loop({ s, env, scroll, stage, hud, onFail, onStepDown }: { s: Director; env: Env; scroll: RefObject<ScrollTime | null>; stage: HTMLElement; hud: HTMLElement; onFail: (r: string) => void; onStepDown: () => void }) {
  const overlay = useMemo(() => createOverlay(s, stage, hud), [s, stage, hud]);
  const sound = useMemo(createSound, []);
  const v = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), a: new THREE.Vector3(), top: new THREE.Vector2(), slow: 0, measured: 0, cubeTick: 0, cubeFace: -1, cubeAt: 0, locked: 0, tau: 0, aspect: 0, fpsEl: null as HTMLElement | null, fpsT: 0, fpsN: 0, fpsMin: 999, bloom: null as Bloom | null, bloomW: 0, bloomH: 0, cubePos: new THREE.Vector3(1e9, 0, 0), cubeSweep: -1, cubeFinale: false, calls: 0, winT: 0, winN: 0, bad: 0, best: 0, tierAt: 0, fpsMinScene: 0, fpsMinTier: '', gpu: '', warmed: false, cubeDrawn: false, programs: 0, hist: new Uint32Array(401), statN: 0, statT: 0, statRung: '', hitch: 0, lastHitch: '', hitchBy: {} as Record<string, number>,
    quiet: 0, ft: 0, held: 0, stillKey: new Float64Array(48), stillDrawn: false, still: false, warmCount: -1, warmedThisFrame: false, t0: 0, hitchScene: [0, 0, 0, 0, 0, 0, 0], uploads: 0, sizeKey: '', sizeSeen: '', prev: { compiled: false, loading: false, upload: false, resized: false, cube: false, warm: false, script: 0, scene: 1 } }), []);
  useEffect(() => () => { v.bloom?.dispose(); v.bloom = null; }, [v]);
  useEffect(() => {
    // Preview builds only: the readout is never part of a production build
    if (process.env.NEXT_PUBLIC_PREVIEW !== '1' || !new URLSearchParams(window.location.search).has('fps')) return;
    const el = document.createElement('div');
    el.setAttribute('style', 'position:fixed;left:10px;bottom:10px;z-index:99;background:#0b1220;color:#7fdbff;border:1px solid #00c2ff;border-radius:6px;padding:6px 10px;font:500 12px/1.5 ui-monospace,monospace;pointer-events:none;white-space:pre;max-width:calc(100vw - 20px);overflow:hidden');
    document.body.appendChild(el);
    v.fpsEl = el;
    return () => { el.remove(); v.fpsEl = null; };
  }, [v]);
  const gl = useThree((t) => t.gl);

  useEffect(() => {
    const root = document.documentElement;
    const onMove = (e: PointerEvent) => {
      s.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      if (s.dragging) { s.lensTarget.set(e.clientX - s.sphereScreen.x, e.clientY - s.sphereScreen.y); s.lastDrag = performance.now(); }
    };
    const ring = hud.querySelector<HTMLElement>('[data-hud="ring"]');
    const grab = ring?.querySelector<SVGElement>('.grab');
    // The lens can be dragged around the room on the Full tier
    const onDown = (e: Event) => { if (s.tier !== 'full') return; s.dragging = true; ring?.classList.add('is-dragging'); (e.target as Element).setPointerCapture?.((e as PointerEvent).pointerId); e.preventDefault(); };
    const onUp = () => { s.dragging = false; ring?.classList.remove('is-dragging'); };
    const onSector = () => { s.sector = root.dataset.sector || ''; };
    const onSound = (e: Event) => sound.set(Boolean((e as CustomEvent).detail));
    const onLost = (e: Event) => { e.preventDefault(); onFail('context-lost'); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('kt:sector', onSector);
    window.addEventListener('kt:sound', onSound);
    grab?.addEventListener('pointerdown', onDown);
    gl.domElement.addEventListener('webglcontextlost', onLost);
    // Used by scripts/capture-stills.mjs and the tests to hold the story at a given time
    (window as unknown as { __ktStory?: unknown }).__ktStory = { setT: (t: number | null) => { s.forcedT = t; }, ready: () => s.live, time: () => s.T, stats: () => ({ tier: s.tier, lowRes: s.lowRes, dpr: s.dpr, calls: v.calls, frames: s.frames, T: s.T, line: s.u, branches: s.branchP, arrive: s.arriveP, mark: s.tau, stage: s.stageOpacity, sphere: [s.sphereScreen.x, s.sphereScreen.y], size: [s.W, s.H] }) };
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('kt:sector', onSector);
      window.removeEventListener('kt:sound', onSound);
      grab?.removeEventListener('pointerdown', onDown);
      gl.domElement.removeEventListener('webglcontextlost', onLost);
      sound.set(false);
      overlay.dispose();
      stage.classList.remove('is-live');
      delete root.dataset.storyReady;
      delete (window as unknown as { __ktStory?: unknown }).__ktStory;
    };
  }, [s, hud, stage, gl, sound, overlay, onFail]);

  // 1. Director: story time → state. Runs before every component's own frame callback.
  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta);
    v.t0 = performance.now(); // start of this frame's own work, for the readout
    scroll.current?.sync();
    s.step(v.t0, dt, scroll.current?.getT() ?? 0);
    let locked = 0;
    for (const on of s.gateOn) if (on) locked++;
    if (locked > v.locked && s.frames > 5) sound.click(); // a soft click when a ring locks
    v.locked = locked;
    sound.tone(Math.abs(s.tau - v.tau) > 1e-4 ? s.tau : -1); // a rising tone for the transformation
    if (v.tau < 0.98 && s.tau >= 0.98) sound.click();
    v.tau = s.tau;
  }, -1);

  // 2. Camera, mask, reflections and the draw. A positive priority hands the render call to us.
  useFrame((state, delta) => {
    const dt = Math.min(0.1, delta);
    const camera = state.camera as THREE.PerspectiveCamera;
    const W = (s.W = state.size.width), H = (s.H = state.size.height);
    s.dpr = state.viewport.dpr;
    s.mobile = W <= 860;
    // A change of size (a foldable phone opened or closed, a phone turned) pauses the tier check and the ?fps=1 statistics
    // for 2 seconds, as a tier change does: the frames around a resize are slow for reasons the visitor never sees again.
    const sizeNow = `${W}x${H}@${s.dpr}`;
    if (v.sizeSeen && v.sizeSeen !== sizeNow && s.frames > 5) v.tierAt = s.time;
    v.sizeSeen = sizeNow;
    if (v.aspect !== W / H) {
      v.aspect = W / H;
      // Keep the horizontal field of view usable on tall phone screens
      camera.fov = Math.max(40, THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(20)) / v.aspect) * 0.92)));
      camera.updateProjectionMatrix();
    }
    const { T, q, finale, spherePos: sp } = s;
    s.pointerEase.lerp(s.pointer, 1 - Math.exp(-dt * 3));
    if (finale) { v.pos.copy(C_REST); v.look.copy(CENTRE); }
    else if (T < 2) { const k = smooth((s.p2 - 0.28) / 0.34); v.pos.copy(C_REST).lerp(C_SCAN, k); v.look.copy(L_REST).lerp(L_SCAN, k); }
    else {
      // Scene 3: follow the sphere from inside the room, behind and slightly above.
      // Scene 4: move to one side and look along the line like a track.
      const k4 = smooth((T - 2.9) / 0.3), side = k4 * smooth((-20 - sp.z) / 8);
      v.pos.set(sp.x * mix(-0.35, 0.6, k4) + 1.5 * side, Math.min(2.6, sp.y + mix(1.05, 1.0, k4)) + 0.6 * side, sp.z + mix(4.6, 5.4, k4));
      v.look.set(sp.x * 0.5, sp.y - mix(0.2, 0.1, k4), sp.z - mix(3.5, 8, k4));
      const kIn = smooth((T - 2) / 0.2);
      if (kIn < 1) { v.pos.lerpVectors(C_SCAN, v.pos, kIn); v.look.lerpVectors(L_SCAN, v.look, kIn); }
      if (T >= 4) { const k5 = smooth((s.p5 - 0.02) / 0.35); v.pos.lerp(C_DOORS, k5); v.look.lerp(L_DOORS, k5); }
    }
    v.pos.x += s.pointerEase.x * 0.1; // reflections shift a little as the pointer moves
    v.pos.y -= s.pointerEase.y * 0.05;
    camera.position.copy(v.pos);
    camera.lookAt(v.look);
    // Keep the subject clear of the text panel: right of centre on desktop, upper part of the screen on phones
    const centred = finale ? smooth(q / 0.18) : 0;
    const shiftX = s.capture || s.mobile ? 0 : mix(0.15, 0, centred);
    const shiftY = s.capture ? 0 : s.mobile ? -0.2 - 0.1 * smooth((T - 2.9) / 0.2) * (1 - smooth((T - 5) / 0.3)) : mix(0, 0.1, centred) - 0.2 * (finale ? smooth((q - 0.72) / 0.25) : 0);
    camera.setViewOffset(W, H, -shiftX * W, -shiftY * H, W, H);
    camera.updateMatrixWorld();

    // Mask inputs in screen pixels: the lens, and the centre of the radar sweep
    const ball = s.ball;
    if (!ball) return;
    v.a.copy(ball.position).project(camera); s.sphereScreen.set((v.a.x * 0.5 + 0.5) * W, (-v.a.y * 0.5 + 0.5) * H);
    v.a.copy(ball.position).setY(ball.position.y + R).project(camera); v.top.set((v.a.x * 0.5 + 0.5) * W, (-v.a.y * 0.5 + 0.5) * H);
    const rPx = Math.max(8, Math.abs(s.sphereScreen.y - v.top.y));
    if (!s.dragging && (performance.now() - s.lastDrag > 1600 || T > 0.95)) s.lensTarget.multiplyScalar(Math.exp(-dt * 4));
    s.lensOffset.lerp(s.lensTarget, 1 - Math.exp(-dt * 12));
    const lensOn = finale ? 0 : (1 - smooth((T - 0.98) / 0.12)) * smooth((s.tEnter - 0.75) / 0.25);
    s.lens.x = s.sphereScreen.x + s.lensOffset.x;
    s.lens.y = s.sphereScreen.y + s.lensOffset.y;
    s.lens.r = rPx * 2.25;
    s.roomU.uLens.value.set(s.lens.x * s.dpr, (H - s.lens.y) * s.dpr, lensOn > 0.01 ? s.lens.r * lensOn * s.dpr : 0);
    s.roomU.uScan.value.set(s.sphereScreen.x * s.dpr, (H - s.sphereScreen.y) * s.dpr, Math.hypot(W, H) * 0.92 * s.dpr);

    camera.layers.enable(BLOOM_LAYER);
    camera.layers.enable(OVERLAY_LAYER);

    // Warm-up. Graphics drivers put off real work until an object is first drawn: they finish compiling its shader for
    // that exact use, and its geometry and textures are sent to the chip. Left alone, that work lands on the frame where
    // a gate, the block, the skyline or the mechanism first appears, and the frame stalls. So once the models have
    // arrived, every object the story will ever show is drawn once, hidden ones included, into a single pixel of the
    // real frame, in the reflection pass and (Full) in the glow pass. The normal draw below then covers that pixel.
    // It runs again if objects are added later (a model that arrives after the stand-in was warmed).
    v.quiet = pending.count === 0 ? v.quiet + 1 : 0;
    v.warmedThisFrame = false;
    if (v.quiet > 8 && s.frames > 3 && (v.warmCount < 0 || (s.frames % 30 === 0 && s.frames < 1800)) && !(window as unknown as { __ktNoWarm?: boolean }).__ktNoWarm) { // the flag is for before-and-after measurement only
      let count = 0;
      state.scene.traverse((o) => { if ((o as THREE.Mesh).geometry || (o as THREE.Sprite).isSprite) count++; });
      if (count !== v.warmCount) {
        v.warmCount = count;
        v.warmed = true;
        v.warmedThisFrame = true;
        const hidden: THREE.Object3D[] = [], culled: THREE.Object3D[] = [], ranges: [THREE.BufferGeometry, number, number][] = [];
        state.scene.traverse((o) => {
          if (!o.visible) { hidden.push(o); o.visible = true; }
          if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
          const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
          if (g && (g.drawRange.start !== 0 || g.drawRange.count !== Infinity)) { ranges.push([g, g.drawRange.start, g.drawRange.count]); g.setDrawRange(0, Infinity); }
        });
        try {
          state.gl.setScissor(0, 0, 1, 1);
          state.gl.setScissorTest(true);
          state.gl.render(state.scene, camera);
          ball.visible = false; // the sphere reads the reflection, so it is never drawn into it
          s.roomU.uCube.value = 1;
          env.cam.position.copy(ball.position);
          env.cam.update(state.gl, state.scene);
          s.roomU.uCube.value = 0;
          ball.visible = true;
          if (s.tier === 'full' && !s.lowRes) {
            v.bloom ??= createBloom(state.gl, state.scene, camera);
            if (v.bloomW !== W || v.bloomH !== H) { v.bloom.setSize(W, H); v.bloomW = W; v.bloomH = H; }
            v.bloom.render();
          }
        } finally {
          state.gl.setScissorTest(false);
          for (const o of hidden) o.visible = false;
          for (const o of culled) o.frustumCulled = true;
          for (const [g, start, n] of ranges) g.setDrawRange(start, n);
        }
        v.cubeTick = 0; // the reflection just drawn held every object: redraw the true one now
        v.tierAt = s.time; // this one frame is long by design: keep it out of the statistics and the step-down watch
      }
    }

    // Reflections: the room as seen from where the sphere is, drawn into the six faces of a small cube.
    // Drawing all six in one frame made that frame six room-draws heavier than its neighbours, which is enough to miss
    // a screen refresh on a phone. So a refresh is spread out: one face a frame over six frames. The picture in the
    // chrome changes slowly, so a face that is a few frames old cannot be seen. A refresh starts only when the reflection
    // would change (the sphere has moved, the sweep has advanced, the lights have changed), on Light at most every 12th
    // frame, and once in a long while regardless. Captures and the first frame still draw all six at once.
    const changed = v.cubePos.distanceToSquared(ball.position) > 0.0009 || Math.abs(v.cubeSweep - s.sweep) > 0.01 || v.cubeFinale !== s.finale;
    v.cubeTick++;
    v.cubeDrawn = false;
    const drawFace = (face: number) => {
      const rt = env.rt, gl = state.gl;
      ball.visible = false;
      s.roomU.uCube.value = 1;
      s.roomU.uCubeBlend.value = s.sweep;
      if (face < 0) env.cam.update(gl, state.scene);
      else {
        rt.texture.generateMipmaps = face === 5; // the smaller copies are rebuilt once, after the last face
        gl.setRenderTarget(rt, face);
        gl.render(state.scene, env.cam.children[face] as THREE.Camera);
        gl.setRenderTarget(null);
        rt.texture.generateMipmaps = true;
      }
      s.roomU.uCube.value = 0;
      ball.visible = true;
      v.cubeDrawn = true;
    };
    if (s.forcedT !== null || v.cubeTick === 1) {
      v.cubePos.copy(ball.position); v.cubeSweep = s.sweep; v.cubeFinale = s.finale; v.cubeFace = -1; v.cubeAt = v.cubeTick;
      env.cam.position.copy(ball.position);
      drawFace(-1);
    } else {
      if (v.cubeFace < 0 && ((changed && v.cubeTick - v.cubeAt >= (s.tier === 'full' ? 6 : 12)) || (v.cubeTick - v.cubeAt >= 600 && !s.finale))) {
        v.cubePos.copy(ball.position); v.cubeSweep = s.sweep; v.cubeFinale = s.finale; v.cubeFace = 0; v.cubeAt = v.cubeTick;
        env.cam.position.copy(ball.position);
        env.cam.updateMatrixWorld();
      }
      // Light: one face every other frame, so two heavier frames never come back to back and the graphics chip gets a
      // light frame to catch up in. The whole reflection still refreshes as often as before (one refresh per 12 frames).
      // On any tier, a face waits a frame when the last frame ran late, so a slow frame is not followed by a heavier one.
      // ("Late" is judged against this device's own usual frame time, and a face is never held back more than 3 times.)
      v.ft = v.ft ? v.ft + (Math.min(delta, 0.1) - v.ft) * 0.05 : Math.min(delta, 0.1);
      const late = delta > v.ft * 1.4 && v.held < 3;
      const faceNow = (s.tier === 'full' || v.cubeTick % 2 === 0) && !late;
      if (v.cubeFace >= 0 && !faceNow && late) v.held++;
      if (v.cubeFace >= 0 && faceNow && s.stageOpacity > 0.001 && !document.hidden) { v.held = 0; drawFace(v.cubeFace); v.cubeFace = v.cubeFace === 5 ? -1 : v.cubeFace + 1; }
    }
    // Scene 7 at rest. Once the mark has formed and the scroll and pointer are still, every frame would draw exactly the
    // same picture. Skipping that draw leaves the last picture on screen (the browser keeps showing it) and frees the
    // graphics chip for the page itself, which on a phone was where the remaining slow frames came from.
    // A frame is drawn whenever anything that shapes the picture changes, and always when a reflection face or the warm-up
    // drew this frame (both need the full draw after them).
    let still = false;
    if (s.finale && s.forcedT === null && !s.capture && !v.warmedThisFrame && !v.cubeDrawn) {
      const k = v.stillKey;
      let i = 0, same = true;
      const put = (x: number) => { if (Math.abs(k[i] - x) > 1e-6) { same = false; k[i] = x; } i++; };
      for (const e of camera.matrixWorld.elements) put(e);
      for (const e of camera.projectionMatrix.elements) put(e);
      put(ball.position.x); put(ball.position.y); put(ball.position.z);
      put(s.tau); put(s.done); put(s.arriveP); put(s.hover); put(s.sweep); put(s.stageOpacity); put(s.q); put(W); put(H); put(s.dpr);
      still = same && v.stillDrawn;
      v.stillDrawn = true;
    } else v.stillDrawn = false;
    v.still = still;
    // Draw. Not while the tab is hidden, and not during scene 6, where the 3D rests.
    state.gl.info.autoReset = false;
    if (s.stageOpacity > 0.001 && !document.hidden && !still) {
      state.gl.render(state.scene, camera);
      if (s.tier === 'full' && !s.lowRes) {
        v.bloom ??= createBloom(state.gl, state.scene, camera);
        if (v.bloomW !== W || v.bloomH !== H) { v.bloom.setSize(W, H); v.bloomW = W; v.bloomH = H; }
        v.bloom.render();
      }
    }
    v.calls = state.gl.info.render.calls; // draw calls this frame: main view + reflections + bloom
    state.gl.info.reset();

    if (!s.live) { s.live = true; stage.classList.add('is-live'); document.documentElement.dataset.storyReady = '1'; }

    overlay.setCamera(camera);
    overlay.update();

    // ?fps=1 shows a frame-rate readout, so the 60 (Full) and 30 (Light) budgets can be checked on a real device
    if (v.fpsEl) {
      v.fpsT += dt; v.fpsN++;
      if (!v.gpu) {
        try { const c = state.gl.getContext(), x = c.getExtension('WEBGL_debug_renderer_info'); v.gpu = x ? String(c.getParameter(x.UNMASKED_RENDERER_WEBGL)).replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 60) : 'GPU unknown'; } catch { v.gpu = 'GPU unknown'; }
      }
      if (v.fpsT >= 0.5) {
        const fps = v.fpsN / v.fpsT;
        let line2 = 'measuring starts 4 s after load', line3 = '';
        if (v.statN > 30) {
          // 1% low: the average rate of the slowest 1% of frames
          let need = Math.max(1, Math.ceil(v.statN * 0.01)), n = 0, t = 0;
          for (let ms = 400; ms >= 0 && n < need; ms--) { const c = Math.min(v.hist[ms], need - n); n += c; t += (c * Math.max(ms, 1)) / 1000; }
          const by = Object.entries(v.hitchBy).filter(([, c]) => c > 0).map(([k, c]) => `${c} ${k}`).join(', ');
          line2 = `average ${Math.round(v.statN / v.statT)} · 1% low ${Math.round(n / t)} · ${v.statN} frames`;
          line3 = `\nstalls over 50 ms: ${v.hitch}${by ? ` (${by})` : ''}${v.hitch ? ` · by scene ${v.hitchScene.map((c, i) => (c ? `${i + 1}×${c}` : '')).filter(Boolean).join(' ')}` : ''}${v.lastHitch ? ` · last ${v.lastHitch}` : ''}`;
        }
        v.fpsEl.textContent = `TIER ${s.tier.toUpperCase()}${s.lowRes ? ' low-res' : ''} · scene ${s.sc + 1} · now ${Math.round(fps)} fps\n${line2}${line3}\n${v.still ? 'resting, no redraw' : `${v.calls} draws`} · ${state.size.width}x${state.size.height} @${s.dpr.toFixed(2)} · ${v.gpu}`;
        v.fpsT = 0; v.fpsN = 0;
      }
      // Statistics leave out the first 4 seconds after load and 2 seconds after a tier change, a resize or the warm-up frame,
      // and start afresh when the tier changes, so each tier is judged by itself.
      const rungNow = s.tier + (s.lowRes ? '-low' : '');
      if (rungNow !== v.statRung) { v.statRung = rungNow; v.hist.fill(0); v.statN = 0; v.statT = 0; v.hitch = 0; v.lastHitch = ''; v.hitchScene.fill(0); for (const k in v.hitchBy) v.hitchBy[k] = 0; if (s.frames > 5) v.tierAt = s.time; }
      if (s.time > 4 && s.time - v.tierAt > 2 && !document.hidden && s.stageOpacity > 0.5 && delta < 2) {
        v.hist[Math.min(400, Math.round(delta * 1000))]++; v.statN++; v.statT += delta;
        if (delta > 0.05) {
          // This frame arrived late because the frame BEFORE it ran long, so the cause is read from that frame's record:
          // a shader was compiled, a download was landing, an object was drawn for the first time, the canvas changed size,
          // the sphere's reflections were redrawn, or our own script took most of the time. "Other" is what is left: the
          // graphics chip finishing work it was handed, the browser's layout and painting, memory clean-up, or another program.
          const p = v.prev, ms = delta * 1000;
          const cause = p.compiled ? 'shader compile' : p.loading ? 'loading' : p.upload ? 'first draw' : p.resized ? 'resize' : p.cube ? 'reflections' : p.script > ms * 0.6 ? 'our code' : 'other';
          v.hitch++; v.hitchBy[cause] = (v.hitchBy[cause] || 0) + 1; v.hitchScene[p.scene - 1]++;
          v.lastHitch = `${Math.round(ms)} ms in scene ${p.scene}, ${cause} (script ${Math.round(p.script)} ms)`;
        }
      }
      // Record this frame's facts for the next frame to read
      const programs = state.gl.info.programs?.length ?? 0, uploads = state.gl.info.memory.geometries + state.gl.info.memory.textures, sizeKey = `${W}x${H}@${s.dpr}`;
      const p = v.prev;
      p.compiled = programs !== v.programs; p.loading = pending.count > 0; p.upload = uploads > v.uploads; p.resized = sizeKey !== v.sizeKey && v.sizeKey !== '';
      p.cube = v.cubeDrawn; p.warm = v.warmedThisFrame; p.scene = s.sc + 1; p.script = performance.now() - v.t0;
      v.programs = programs; v.uploads = uploads; v.sizeKey = sizeKey;
    }

    // Device tiers: step down quality before falling back. Full → Light → Light at lower resolution → brief mode.
    // (?simulate-slow=1, preview builds only, pretends every frame takes 200 ms so tests can walk the whole ladder.)
    // The frame rate is watched for the whole visit, in 1.5-second windows, not only at the start: a device can be
    // fine in scene 1 and struggle in a later scene. Two slow windows in a row step down one rung.
    // Targets: Full 50 (aiming at 60), Light 30, Light at lower resolution 20 (below that, brief mode).
    // A screen that itself refreshes slower than 60 Hz is allowed for, using the best rate seen so far.
    const raw = delta; // unclamped, so a long hitch (tab switch, download) can be told apart from steady slowness
    if ((!s.forced || s.simSlow) && s.forcedT === null && !document.hidden && s.stageOpacity > 0.5 && s.time > (s.simSlow ? 0 : 4) && s.time - v.tierAt > (s.simSlow ? 0 : 2)) {
      if (raw > 0.4 && !s.simSlow) { v.winT = 0; v.winN = 0; }
      else {
        v.winT += s.simSlow ? 0.2 : raw; v.winN++;
        if (v.winT >= (s.simSlow ? 1 : 1.5)) {
          const fps = v.winN / v.winT;
          v.best = Math.max(v.best, fps);
          const want = s.tier === 'full' ? 50 : s.lowRes ? 20 : 30;
          const target = Math.min(want, 0.82 * Math.max(v.best, 30));
          v.bad = fps < target ? v.bad + 1 : 0;
          v.winT = 0; v.winN = 0;
          if (v.bad >= 2) { v.bad = 0; v.tierAt = s.time; onStepDown(); }
        }
      }
    }
  }, 1);
  return null;
}

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// How sharply the scene is drawn. The limit is on the number of pixels drawn, not only on the ratio, because a large
// high-density laptop screen at ratio 2 is four times the work of the same scene at ratio 1.
// Full: up to 1.5x and about 2.2 million pixels. Light: 1x and about 1.3 million. Lower resolution: 0.75 of Light.
// Light on a touch screen: about 380,000 pixels, the size of an ordinary phone screen at 1x. An ordinary phone is drawn
// exactly as before; a bigger touch screen, such as the inner screen of a foldable phone or a small tablet, is drawn a
// little softer so that it costs the graphics chip about the same as an ordinary phone (never below 0.8 of the page's
// own pixel size). The page text is not part of the 3D picture, so it stays as sharp as ever.
function pixelRatio(tier: Tier, lowRes: boolean) {
  if (typeof window === 'undefined') return 1;
  const css = Math.max(1, window.innerWidth * window.innerHeight), device = window.devicePixelRatio || 1;
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const full = Math.min(device, 1.5, Math.sqrt(2.2e6 / css));
  const light = touch ? Math.min(device, 1, Math.max(0.8, Math.sqrt(3.8e5 / css))) : Math.min(device, 1, Math.sqrt(1.3e6 / css));
  const r = Math.max(0.5, tier === 'full' ? full : lowRes ? light * 0.75 : light);
  return Math.round(r * 100) / 100; // rounded, so a tiny change in window size does not resize the canvas
}

// The drawing ratio depends on the window's size, so it is worked out again once a resize has settled (for example
// when a foldable phone is opened), not on every one of the many resize events the opening sends.
function useSettledRatio(tier: Tier, lowRes: boolean) {
  const [ratio, setRatio] = useState(() => pixelRatio(tier, lowRes));
  useEffect(() => {
    setRatio(pixelRatio(tier, lowRes));
    let timer = 0;
    const onResize = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setRatio(pixelRatio(tier, lowRes)), 250); };
    window.addEventListener('resize', onResize);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', onResize); };
  }, [tier, lowRes]);
  return ratio;
}

export default function Story({ stage, hud, onFail }: Props) {
  const [tier, setTier] = useState<Tier>(() => (document.documentElement.dataset.tier === 'full' ? 'full' : 'light'));
  const [lowRes, setLowRes] = useState(false);
  const ratio = useSettledRatio(tier, lowRes);
  const rung = useRef({ tier, lowRes });
  rung.current = { tier, lowRes };
  const stepDown = () => {
    if (rung.current.tier === 'full') setTier('light');
    else if (!rung.current.lowRes) { setLowRes(true); s.lowRes = true; document.documentElement.dataset.lowRes = '1'; }
    else onFail('slow');
  };
  const s = useMemo(() => createDirector(tier), []); // eslint-disable-line react-hooks/exhaustive-deps
  const env = useMemo<Env>(() => {
    const rt = new THREE.WebGLCubeRenderTarget(tier === 'full' ? 128 : 64, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    return { rt, cam: new THREE.CubeCamera(0.2, 120, rt) };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scroll = useRef<ScrollTime | null>(null);
  const [els, setEls] = useState<{ stage: HTMLElement; hud: HTMLElement } | null>(null);

  useEffect(() => { if (stage.current && hud.current) setEls({ stage: stage.current, hud: hud.current }); }, [stage, hud]);
  useEffect(() => () => env.rt.dispose(), [env]);
  // One ScrollTrigger per scene. Rebuilt when the tier changes, because the scene heights change with it.
  useEffect(() => {
    const keepT = s.frames > 0 ? s.T : -1; // stepping down mid-visit changes scene heights: stay at the same moment of the story
    s.tier = tier;
    document.documentElement.dataset.tier = tier;
    if (keepT >= 0) {
      const i = Math.min(6, Math.floor(keepT)), el = document.querySelector<HTMLElement>(`[data-scene="${i + 1}"]`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + el.offsetHeight * (keepT - i) - window.innerHeight / 2, behavior: 'auto' });
    }
    const st = (scroll.current = createScrollTime(tier));
    let pageH = document.body.offsetHeight;
    // Only when the page height really changed, and once it has settled: opening a foldable phone reflows the text over
    // several frames, and re-measuring every scene on each of them would stall the story.
    let timer = 0;
    const ro = new ResizeObserver(() => { window.clearTimeout(timer); timer = window.setTimeout(() => { const h = document.body.offsetHeight; if (h !== pageH) { pageH = h; st.refresh(); } }, 200); });
    ro.observe(document.body);
    return () => { window.clearTimeout(timer); ro.disconnect(); st.kill(); scroll.current = null; };
  }, [s, tier]);

  return (
    <Boundary onError={() => onFail('no-webgl')}>
      <Canvas
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', touchAction: 'auto' }}
        dpr={ratio}
        resize={{ scroll: false, debounce: { scroll: 50, resize: 150 } }} // do not re-measure the canvas on every scroll event (it forces a layout pass), and resize it once a burst of resize events settles, such as a foldable phone opening
        gl={{ antialias: tier === 'full', alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: s.capture }}
        camera={{ fov: 40, near: 0.05, far: 220, position: [0, 1.55, 2.2] }}
        flat
        linear
        onCreated={({ gl }) => { gl.outputColorSpace = THREE.LinearSRGBColorSpace; gl.setClearColor(NIGHT); }}
      >
        <Corridor uniforms={s.roomU} />
        <GridFloor s={s} />
        <Lines s={s} />
        <Gates s={s} />
        <Sphere s={s} env={env} />
        <primitive object={env.cam} />
        {els ? <Loop s={s} env={env} scroll={scroll} stage={els.stage} hud={els.hud} onFail={onFail} onStepDown={stepDown} /> : null}
      </Canvas>
    </Boundary>
  );
}
