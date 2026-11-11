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
    loadRoom(gl, tier, uniforms as unknown as Record<string, THREE.IUniform>)
      .then((a) => { if (cancelled) a.dispose(); else { loaded = a; setAssets(a); } })
      .catch((err) => console.warn('Blender room not loaded; using the stand-in', err));
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
  const line = useRef<THREE.Mesh>(null);
  const branchRefs = useRef<(THREE.Mesh | null)[]>([]);
  const built = useMemo(() => {
    const { curve, uAnchors } = s.path;
    const hasGap = [true, true, false, true]; // three of the four links stop short with a visible gap
    const links: { geometry: THREE.TubeGeometry; material: THREE.ShaderMaterial; u0: number; u1: number; mesh: THREE.Mesh | null }[] = [];
    for (let i = 0; i < 4; i++) {
      const a = uAnchors[i], b = uAnchors[i + 1];
      for (const [u0, u1] of hasGap[i] ? [[a, mix(a, b, 0.36)], [mix(a, b, 0.64), b]] : [[a, b]]) {
        links.push({
          u0, u1, mesh: null,
          geometry: new THREE.TubeGeometry(subCurve(curve, u0, u1), 48, 0.014, 5),
          material: new THREE.ShaderMaterial({ vertexShader: LINK_VERT, fragmentShader: LINK_FRAG, transparent: true, uniforms: { uColor: { value: AMBER }, uDashes: { value: Math.max(3, Math.round((u1 - u0) * 260)) }, uOpacity: { value: 0 }, uCut: { value: 0 } } }),
        });
      }
    }
    const main = new THREE.TubeGeometry(curve, TUBULAR, 0.016, RADIAL);
    const branches = [-1, 1].map((side) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([FORK.clone(), new THREE.Vector3(side * 1.2, 1.5, -84), new THREE.Vector3(side * 4.2, 1.2, -92), new THREE.Vector3(side * 5.4, 0.6, -104)]), 120, 0.03, RADIAL));
    return { links, main, branches };
  }, [s]);
  useEffect(() => () => { built.main.dispose(); built.branches.forEach((g) => g.dispose()); built.links.forEach((l) => { l.geometry.dispose(); l.material.dispose(); }); }, [built]);

  useFrame(() => {
    if (line.current) {
      line.current.visible = !s.finale && s.T >= 2;
      built.main.setDrawRange(0, Math.floor(clamp(s.u) * TUBULAR) * RADIAL * 6);
    }
    for (const l of built.links) {
      if (l.mesh) l.mesh.visible = s.linkOpacity > 0.001 && s.u < l.u1;
      l.material.uniforms.uOpacity.value = s.linkOpacity;
      l.material.uniforms.uCut.value = clamp((s.u - l.u0) / (l.u1 - l.u0));
    }
    built.branches.forEach((g, i) => {
      const m = branchRefs.current[i];
      if (m) m.visible = s.branchP > 0.001;
      g.setDrawRange(0, Math.floor(s.branchP * 120) * RADIAL * 6);
    });
  });
  return (
    <>
      <mesh ref={line} geometry={built.main} frustumCulled={false}><meshBasicMaterial color={CYAN} toneMapped={false} /></mesh>
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

  useFrame(() => {
    const ball = s.ball;
    if (!ball) return;
    const { tau, q, finale, done, time } = s;
    ball.position.copy(s.spherePos);
    ball.position.y += Math.sin(time * 0.9) * 0.022 * s.hover; // at rest it hovers and turns slowly
    if (turn.current) turn.current.rotation.y = Math.sin(time * 0.22) * 0.4 * s.hover;
    b.plates.update(tau);
    b.mech.update(tau);
    core.current?.scale.setScalar(Math.max(0.001, 1 - smooth((tau - 0.08) / 0.2)));
    b.chromeU.uRough.value = mix(0.02, 0.3, smooth((tau - 0.75) / 0.25)); // mirror chrome becomes brushed chrome
    b.chromeU.uEdge.value = done * 0.55;
    // Triangle seams: pulse once on arrival, rest faint, open again before the transformation
    b.seamMat.opacity = tau > 0.25 ? 0 : Math.max(0.5, s.pulse, finale ? smooth((q - 0.1) / 0.1) : 0) * (1 - smooth((tau - 0.1) / 0.15));
    b.nodes.forEach((n, i) => {
      const on = smooth((done - i * 0.2) / 0.5);
      n.sprite.opacity = on * 0.85;
      n.ring.opacity = on;
    });
    if (arrive.current) arrive.current.visible = s.arriveP > 0.001;
    b.arriveGeo.setDrawRange(0, Math.floor(s.arriveP * 80) * RADIAL * 6);
  });

  return (
    <group ref={(g) => { s.ball = g; }}>
      <group ref={turn}>
        <mesh geometry={b.plates.geo} material={b.chrome} frustumCulled={false} />
        <mesh ref={core}><sphereGeometry args={[R * 0.975, 32, 20]} /><meshBasicMaterial color="#03060b" /></mesh>
        <primitive object={b.seams} />
      </group>
      <primitive object={b.mech.group} />
      {NODES.map((n, i) => (
        <group key={i} position={[n.x, n.y, 0]}>
          <sprite material={b.nodes[i].sprite} position={[0, 0, 0.02]} scale={MARK_RING * 5.2} />
          <mesh geometry={b.nodeRing} material={b.nodes[i].ring} position={[0, 0, MARK_TUBE + 0.002]} />
        </group>
      ))}
      {/* The line arrives from the edge of the screen and joins the mark's first node */}
      <mesh ref={arrive} geometry={b.arriveGeo} frustumCulled={false}><meshBasicMaterial color={CYAN} toneMapped={false} /></mesh>
    </group>
  );
}

const C_REST = new THREE.Vector3(0, 1.55, 2.2), L_REST = new THREE.Vector3(0.35, 1.4, -6);
const C_SCAN = new THREE.Vector3(1.25, 2.25, 1.9), L_SCAN = new THREE.Vector3(-0.9, 1.25, -9.5); // still inside the room, a little higher and closer
const C_DOORS = new THREE.Vector3(0, 2.3, -74.4), L_DOORS = new THREE.Vector3(0, 3.6, -112);

/** Runs the frame: director, camera, mask inputs, reflections, the draw itself, then the HUD and content layer. */
function Loop({ s, env, scroll, stage, hud, onFail, onStepDown }: { s: Director; env: Env; scroll: RefObject<ScrollTime | null>; stage: HTMLElement; hud: HTMLElement; onFail: (r: string) => void; onStepDown: () => void }) {
  const overlay = useMemo(() => createOverlay(s, stage, hud), [s, stage, hud]);
  const sound = useMemo(createSound, []);
  const v = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), a: new THREE.Vector3(), top: new THREE.Vector2(), slow: 0, measured: 0, cubeTick: 0, locked: 0, tau: 0, aspect: 0 }), []);
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
    (window as unknown as { __ktStory?: unknown }).__ktStory = { setT: (t: number | null) => { s.forcedT = t; }, ready: () => s.live, time: () => s.T };
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
    s.step(performance.now(), dt, scroll.current?.getT() ?? 0);
    const locked = s.gateOn.filter(Boolean).length;
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
    if (v.aspect !== W / H) {
      v.aspect = W / H;
      // Keep the horizontal field of view usable on tall phone screens
      camera.fov = Math.max(40, THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(20)) / v.aspect) * 0.92)));
      camera.updateProjectionMatrix();
    }
    const { T, q, finale, spherePos: sp } = s;
    s.pointerEase.lerp(s.pointer, 1 - Math.exp(-dt * 3));
    if (finale) { v.pos.copy(C_REST); v.look.copy(CENTRE); }
    else if (T < 2) { const k = smooth((s.p2 - 0.05) / 0.6); v.pos.copy(C_REST).lerp(C_SCAN, k); v.look.copy(L_REST).lerp(L_SCAN, k); }
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
    const shiftY = s.capture ? 0 : s.mobile ? -0.2 : mix(0, 0.1, centred) - 0.2 * (finale ? smooth((q - 0.72) / 0.25) : 0);
    camera.setViewOffset(W, H, -shiftX * W, -shiftY * H, W, H);
    camera.updateMatrixWorld();

    // Mask inputs in screen pixels: the lens, and the centre of the radar sweep
    const ball = s.ball;
    if (!ball) return;
    const project = (p: THREE.Vector3, out: THREE.Vector2) => { v.a.copy(p).project(camera); out.set((v.a.x * 0.5 + 0.5) * W, (-v.a.y * 0.5 + 0.5) * H); };
    project(ball.position, s.sphereScreen);
    project(v.look.copy(ball.position).setY(ball.position.y + R), v.top);
    const rPx = Math.max(8, Math.abs(s.sphereScreen.y - v.top.y));
    if (!s.dragging && (performance.now() - s.lastDrag > 1600 || T > 0.95)) s.lensTarget.multiplyScalar(Math.exp(-dt * 4));
    s.lensOffset.lerp(s.lensTarget, 1 - Math.exp(-dt * 12));
    const lensOn = finale ? 0 : (1 - smooth((T - 0.98) / 0.12)) * smooth((s.tEnter - 0.75) / 0.25);
    s.lens.x = s.sphereScreen.x + s.lensOffset.x;
    s.lens.y = s.sphereScreen.y + s.lensOffset.y;
    s.lens.r = rPx * 2.25;
    s.roomU.uLens.value.set(s.lens.x * s.dpr, (H - s.lens.y) * s.dpr, lensOn > 0.01 ? s.lens.r * lensOn * s.dpr : 0);
    s.roomU.uScan.value.set(s.sphereScreen.x * s.dpr, (H - s.sphereScreen.y) * s.dpr, Math.hypot(W, H) * 0.92 * s.dpr);

    // Reflections: render the room from where the sphere is
    if (v.cubeTick++ % (s.tier === 'full' ? 2 : 8) === 0 || s.forcedT !== null) {
      ball.visible = false;
      s.roomU.uCube.value = 1;
      s.roomU.uCubeBlend.value = s.sweep;
      env.cam.position.copy(ball.position);
      env.cam.update(state.gl, state.scene);
      s.roomU.uCube.value = 0;
      ball.visible = true;
    }
    // Draw. Not while the tab is hidden, and not during scene 6, where the 3D rests.
    if (s.stageOpacity > 0.001 && !document.hidden) state.gl.render(state.scene, camera);
    if (!s.live) { s.live = true; stage.classList.add('is-live'); document.documentElement.dataset.storyReady = '1'; }

    overlay.setCamera(camera);
    overlay.update();

    // Device tiers: step down quality before falling back. Full → Light → Light at lower resolution → brief mode.
    if (!s.forced && s.forcedT === null && !document.hidden && v.measured < 120 && s.frames > 20) {
      v.slow += dt;
      if (++v.measured === 120) {
        const avg = v.slow / 120;
        // Too slow for this tier: step down one rung and measure again (the last rung is brief mode)
        if (avg > (s.tier === 'full' ? 1 / 36 : 1 / 24)) { v.slow = 0; v.measured = 0; onStepDown(); }
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

export default function Story({ stage, hud, onFail }: Props) {
  const [tier, setTier] = useState<Tier>(() => (document.documentElement.dataset.tier === 'full' ? 'full' : 'light'));
  const [lowRes, setLowRes] = useState(false);
  const rung = useRef({ tier, lowRes });
  rung.current = { tier, lowRes };
  const stepDown = () => {
    if (rung.current.tier === 'full') setTier('light');
    else if (!rung.current.lowRes) { setLowRes(true); document.documentElement.dataset.lowRes = '1'; }
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
    s.tier = tier;
    document.documentElement.dataset.tier = tier;
    const st = (scroll.current = createScrollTime(tier));
    const ro = new ResizeObserver(() => st.refresh());
    ro.observe(document.body);
    return () => { ro.disconnect(); st.kill(); scroll.current = null; };
  }, [s, tier]);

  return (
    <Boundary onError={() => onFail('no-webgl')}>
      <Canvas
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', touchAction: 'auto' }}
        dpr={lowRes ? 0.75 : Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, tier === 'full' ? 2 : 1.25)}
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
