// The story engine: scene layer + HUD layer, both driven by one number (story time T, from the scroll).
// Loaded after first paint, only in story mode. The content layer never depends on it.
import * as THREE from 'three';
import type { ScrollTimeline } from './scroll';
import { ACCEPTED_AT, BLOCK_AT, GATE_AT } from './timeline';
import { BLOCK_Z, buildPath, buildWorld, FORK, GATE_Z, LIGHT_Z, SKY_SYS, SPHERE_REST, subCurve, SYSTEM_ANCHORS } from './world';
import { buildMechanism, buildPlates, buildSeamTriangle, MARK_RING, MARK_TUBE, NODES, R } from './sphere';
import { createSound } from './sound';

type Opts = { canvas: HTMLCanvasElement; stage: HTMLElement; hud: HTMLElement; timeline: ScrollTimeline; onFail: (reason: string) => void };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const inOut = (x: number) => { const t = clamp(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// All colours here are the brand tokens exactly as written, so colour management is off for this scene.
THREE.ColorManagement.enabled = false;
const CYAN = new THREE.Color('#00C2FF');
const WIRE = new THREE.Color('#D9DEE3');
const AMBER = new THREE.Color('#FFB020');
const NIGHT = new THREE.Color('#05080F');

const ROOM_VERT = /* glsl */ `
attribute float aShade; attribute float aSys; attribute float aGlow;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vShade; varying float vSys; varying float vGlow; varying float vDepth;
void main() {
  vUv = uv; vN = normal; vShade = aShade; vSys = aSys; vGlow = aGlow;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mv = viewMatrix * w; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

// One shader draws both worlds. A mask chooses, per pixel, the "real" look or the "blueprint" look.
// The mask has three inputs: the scanner lens, the radar sweep and an overall blend.
const ROOM_FRAG = /* glsl */ `
uniform vec3 uLights[5]; uniform float uLightI[5]; uniform float uStatus; uniform float uLit[8];
uniform vec3 uLens; uniform vec3 uScan; uniform float uSweep; uniform float uArm0; uniform float uCube; uniform float uCubeBlend;
uniform vec3 uCyan; uniform vec3 uWire; uniform vec3 uNight;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vShade; varying float vSys; varying float vGlow; varying float vDepth;
void main() {
  float mask;
  if (uCube > 0.5) { mask = uCubeBlend; } else {
    vec2 f = gl_FragCoord.xy;
    vec2 d = f - uScan.xy;
    float r = clamp(length(d) / uScan.z, 0.0, 0.9999);
    float a = fract((atan(d.y, d.x) - uArm0) / 6.2831853 + 2.0);
    float th = uSweep * 3.0; float k = floor(th); float fr = th - k;
    float ring = floor(r * 3.0);
    float sw = ring < k ? 1.0 : (ring == k ? 1.0 - smoothstep(fr - 0.003, fr + 0.003, a) : 0.0);
    if (uSweep >= 0.999) sw = 1.0;
    if (uSweep <= 0.001) sw = 0.0;
    float lens = uLens.z > 0.5 ? 1.0 - smoothstep(uLens.z - 1.5, uLens.z + 1.5, length(f - uLens.xy)) : 0.0;
    mask = max(sw, lens);
  }
  vec3 N = normalize(vN);
  int sys = int(vSys + 0.5);
  float lit = uLit[sys];

  // Real world: near black-and-white, lit by the strip lights
  vec3 real = vec3(0.0);
  if (mask < 0.999) {
    float L = 0.03;
    for (int i = 0; i < 5; i++) {
      vec3 l = uLights[i] - vW; float d2 = dot(l, l);
      L += uLightI[i] * (max(dot(N, normalize(l)), 0.0) * 2.6 + 0.35) / (1.0 + 0.42 * d2);
    }
    real = vec3(vShade) * vec3(0.93, 0.97, 1.06) * L;
    if (vGlow > 1.5) real = vec3(0.86, 0.93, 1.0) * (0.25 + uLightI[int(vGlow - 1.5)] * 0.9);
    else if (vGlow > 0.5) real = mix(vec3(0.035), uCyan * 1.25, uStatus);
    real = mix(real, uNight, smoothstep(4.0, 22.0, vDepth));
  }

  // Blueprint world: black, thin silver outlines, fine mesh, faint grid. Cyan on anything connected.
  vec3 bp = vec3(0.0);
  if (mask > 0.001) {
    vec2 fw = fwidth(vUv) + 1e-6;
    vec2 e = min(vUv, 1.0 - vUv) / fw;
    float edge = 1.0 - smoothstep(0.7, 1.8, min(e.x, e.y));
    float diag = 1.0 - smoothstep(0.4, 1.4, abs(vUv.x - vUv.y) / length(fw));
    vec2 c = abs(N.y) > 0.5 ? vW.xz : (abs(N.x) > 0.5 ? vW.zy : vW.xy);
    c *= 2.0;
    vec2 g = (0.5 - abs(fract(c) - 0.5)) / (fwidth(c) + 1e-6);
    float grid = 1.0 - smoothstep(0.0, 1.4, min(g.x, g.y));
    float line = vGlow > 0.5 && vGlow < 1.5 ? 0.0 : edge * 0.62 + diag * 0.09 + grid * 0.06;
    // The corridor's shell is see-through in the blueprint: X-ray glasses, so the camera can look in from outside
    if (vGlow < -0.5 && mask > 0.999 && line < 0.03) discard;
    float fade = 1.0 - 0.72 * smoothstep(14.0, 60.0, vDepth);
    if (sys >= 6) fade = 0.85;
    bp = uNight * 0.7 + mix(uWire, uCyan, lit) * line * fade * (0.55 + 0.6 * lit);
    if (vGlow > 0.5 && vGlow < 1.5) bp += uCyan * lit * 0.9;
  }
  gl_FragColor = vec4(mix(real, bp, mask), 1.0);
}`;

const CHROME_VERT = /* glsl */ `
varying vec3 vWN; varying vec3 vWP;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; vWN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
// Mirror chrome: reflects an environment rendered live from wherever the sphere is.
const CHROME_FRAG = /* glsl */ `
uniform samplerCube uEnv; uniform float uRough; uniform float uGain; uniform float uEdge; uniform vec3 uTint; uniform vec3 uCyan;
varying vec3 vWN; varying vec3 vWP;
void main() {
  vec3 N = normalize(vWN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWP);
  vec3 Rf = reflect(-V, N);
  vec3 env = textureLod(uEnv, Rf, uRough * 5.0).rgb;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 col = env * uGain + vec3(0.085, 0.1, 0.125) * (0.3 + 0.7 * smoothstep(-0.5, 1.0, Rf.y));
  col += fr * vec3(0.42, 0.47, 0.53);
  col *= uTint;
  col += uEdge * uCyan * (fr * 1.1 + 0.05);
  gl_FragColor = vec4(col, 1.0);
}`;

const LINK_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LINK_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uDashes; uniform float uOpacity; uniform float uCut; varying vec2 vUv;
void main() { if (vUv.x < uCut || fract(vUv.x * uDashes) > 0.55) discard; gl_FragColor = vec4(uColor, uOpacity); }`;

const GRID_FRAG = /* glsl */ `
uniform float uOpacity; uniform vec3 uWire; varying vec3 vW; varying float vDepth;
void main() {
  vec2 c = vW.xz * 0.5; vec2 g = (0.5 - abs(fract(c) - 0.5)) / (fwidth(c) + 1e-6);
  float line = 1.0 - smoothstep(0.0, 1.3, min(g.x, g.y));
  float a = line * 0.2 * uOpacity * (1.0 - smoothstep(10.0, 70.0, vDepth));
  if (a < 0.004) discard;
  gl_FragColor = vec4(uWire, a);
}`;
const GRID_VERT = /* glsl */ `varying vec3 vW; varying float vDepth; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(127,219,255,0.9)');
  grad.addColorStop(0.25, 'rgba(0,194,255,0.45)');
  grad.addColorStop(1, 'rgba(0,194,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function startStory({ canvas, stage, hud, timeline, onFail }: Opts) {
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const capture = params.has('capture');
  const forced = params.get('mode') === 'story' || navigator.webdriver;
  let tier: 'full' | 'light' = root.dataset.tier === 'full' ? 'full' : 'light';

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'full', alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
  } catch {
    onFail('no-webgl');
    return { dispose() {} };
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // colours are authored in display space (see ColorManagement below)
  renderer.setClearColor(NIGHT);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 220);

  // ── Room (both worlds) ──
  const lightI = new Float32Array(5);
  const lit = new Float32Array(8);
  const roomU = {
    uLights: { value: LIGHT_Z.map((z) => new THREE.Vector3(0, 2.8, z)) }, uLightI: { value: lightI }, uStatus: { value: 0 }, uLit: { value: lit },
    uLens: { value: new THREE.Vector3() }, uScan: { value: new THREE.Vector3(0, 0, 1) }, uSweep: { value: 0 }, uArm0: { value: Math.PI * 0.5 },
    uCube: { value: 0 }, uCubeBlend: { value: 0 }, uCyan: { value: CYAN }, uWire: { value: WIRE }, uNight: { value: NIGHT },
  };
  const room = new THREE.Mesh(buildWorld(), new THREE.ShaderMaterial({ vertexShader: ROOM_VERT, fragmentShader: ROOM_FRAG, uniforms: roomU }));
  room.frustumCulled = false;
  scene.add(room);

  const gridU = { uOpacity: { value: 0 }, uWire: { value: WIRE } };
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(160, 150), new THREE.ShaderMaterial({ vertexShader: GRID_VERT, fragmentShader: GRID_FRAG, uniforms: gridU, transparent: true, depthWrite: false }));
  grid.rotation.x = -Math.PI / 2;
  grid.position.set(0, -0.02, -95);
  scene.add(grid);

  // ── The line ──
  const path = buildPath();
  const TUBULAR = 900, RADIAL = 6;
  const lineMat = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
  const line = new THREE.Mesh(new THREE.TubeGeometry(path.curve, TUBULAR, 0.022, RADIAL), lineMat);
  line.frustumCulled = false;
  scene.add(line);
  // Amber dashed links between the five systems. Three stop short with a visible gap.
  const links: { mesh: THREE.Mesh; u0: number; u1: number; mat: THREE.ShaderMaterial }[] = [];
  const gapPoints: THREE.Vector3[] = [];
  const hasGap = [true, true, false, true];
  for (let i = 0; i < 4; i++) {
    const a = path.uAnchors[i], b = path.uAnchors[i + 1];
    const parts = hasGap[i] ? [[a, mix(a, b, 0.36)], [mix(a, b, 0.64), b]] : [[a, b]];
    if (hasGap[i]) gapPoints.push(path.curve.getPointAt(mix(a, b, 0.5)));
    for (const [u0, u1] of parts) {
      const mat = new THREE.ShaderMaterial({ vertexShader: LINK_VERT, fragmentShader: LINK_FRAG, transparent: true, uniforms: { uColor: { value: AMBER }, uDashes: { value: Math.max(3, Math.round((u1 - u0) * 260)) }, uOpacity: { value: 0 }, uCut: { value: 0 } } });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(subCurve(path.curve, u0, u1), 48, 0.014, 5), mat);
      scene.add(mesh);
      links.push({ mesh, u0, u1, mat });
    }
  }
  // Two branches at the fork (scene 5)
  const branchMat = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
  const branches = [-1, 1].map((side) => {
    const c = new THREE.CatmullRomCurve3([FORK.clone(), new THREE.Vector3(side * 1.2, 1.5, -84), new THREE.Vector3(side * 4.2, 1.2, -92), new THREE.Vector3(side * 5.4, 0.6, -104)]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 120, 0.03, RADIAL), branchMat);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });

  // ── Gates and the block (scene 4) ──
  const gateGeo = new THREE.TorusGeometry(0.95, 0.03, 8, 64);
  const tickGeo = new THREE.BoxGeometry(0.05, 0.22, 0.05);
  const gates = GATE_Z.map((z) => {
    const mat = new THREE.MeshBasicMaterial({ color: WIRE.clone(), toneMapped: false, transparent: true, opacity: 0.55 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(gateGeo, mat));
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(tickGeo, mat);
      t.position.set(Math.cos((i * Math.PI) / 2) * 0.95, Math.sin((i * Math.PI) / 2) * 0.95, 0);
      t.rotation.z = (i * Math.PI) / 2 + Math.PI / 2;
      g.add(t);
    }
    g.position.set(0, 1.2, z);
    scene.add(g);
    return { g, mat, lock: 0 };
  });
  const blockGeo = new THREE.BoxGeometry(1.3, 1.9, 1.5);
  const block = new THREE.Group();
  block.add(new THREE.Mesh(blockGeo, new THREE.MeshBasicMaterial({ color: '#070503' })));
  block.add(new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), new THREE.LineBasicMaterial({ color: AMBER, toneMapped: false })));
  block.position.set(0, 0, BLOCK_Z);
  scene.add(block);

  // ── The sphere ──
  const envSize = tier === 'full' ? 128 : 64;
  const cubeRT = new THREE.WebGLCubeRenderTarget(envSize, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(0.2, 120, cubeRT);
  scene.add(cubeCam);
  const chromeU = { uEnv: { value: cubeRT.texture }, uRough: { value: 0.02 }, uGain: { value: 2.4 }, uEdge: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uCyan: { value: CYAN } };
  const chrome = new THREE.ShaderMaterial({ vertexShader: CHROME_VERT, fragmentShader: CHROME_FRAG, uniforms: chromeU, side: THREE.DoubleSide });
  const darkU = { ...chromeU, uTint: { value: new THREE.Color(0.32, 0.36, 0.42) }, uRough: { value: 0.35 }, uEdge: { value: 0.0 } };
  const darkMetal = new THREE.ShaderMaterial({ vertexShader: CHROME_VERT, fragmentShader: CHROME_FRAG, uniforms: darkU });
  const rodU = { ...chromeU, uTint: { value: new THREE.Color(1.1, 1.15, 1.2) }, uRough: { value: 0.1 }, uEdge: { value: 0.0 } };
  const rodMetal = new THREE.ShaderMaterial({ vertexShader: CHROME_VERT, fragmentShader: CHROME_FRAG, uniforms: rodU });

  const ball = new THREE.Group();
  scene.add(ball);
  const plates = buildPlates(tier === 'full' ? 1 : 0);
  const plateMesh = new THREE.Mesh(plates.geo, chrome);
  plateMesh.frustumCulled = false;
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.975, 32, 20), new THREE.MeshBasicMaterial({ color: '#03060b' }));
  const seamMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, toneMapped: false });
  const seams = buildSeamTriangle(seamMat);
  const mech = buildMechanism(darkMetal, rodMetal);
  const turn = new THREE.Group(); // the parts that turn slowly at rest
  turn.add(plateMesh, core, seams);
  ball.add(turn, mech.group);
  // The finished mark: cyan edge light on the three nodes, and the line arriving at the first node
  const glowTex = glowTexture();
  const nodeGlow = NODES.map((n) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.set(n.x, n.y, 0.02);
    s.scale.setScalar(MARK_RING * 5.2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(MARK_RING, 0.0045, 6, 48), seamMat.clone());
    ring.position.set(n.x, n.y, MARK_TUBE + 0.002);
    ball.add(s, ring);
    return { s, ring };
  });
  const arriveCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.5, NODES[1].y - 0.1, 0), new THREE.Vector3(-2, NODES[1].y - 0.02, 0), new THREE.Vector3(NODES[1].x - MARK_RING, NODES[1].y, 0)]);
  const arrive = new THREE.Mesh(new THREE.TubeGeometry(arriveCurve, 80, 0.012, RADIAL), lineMat);
  arrive.frustumCulled = false;
  ball.add(arrive);

  // ── HUD elements ──
  const el = (name: string) => hud.querySelector<HTMLElement>(`[data-hud="${name}"]`)!;
  const ringEl = el('ring'), armEl = el('arm');
  const sysEls = SYSTEM_ANCHORS.map((_, i) => el(`sys-${i}`));
  const gapEls = gapPoints.map((_, i) => el(`gap-${i}`));
  const gateEls = GATE_Z.map((_, i) => el(`gate-${i}`));
  const place = (e: HTMLElement, x: number, y: number, opacity: number, extra = '') => {
    e.style.opacity = opacity.toFixed(3);
    if (opacity > 0.001) e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${extra}`;
  };

  // ── Content-layer hooks: step reveals, gates, dials ──
  const sceneEls = Array.from({ length: 7 }, (_, i) => document.querySelector<HTMLElement>(`[data-scene="${i + 1}"]`));
  const steps = sceneEls.map((s) => (s ? Array.from(s.querySelectorAll<HTMLElement>('[data-at]')).map((e) => ({ e, at: parseFloat(e.dataset.at || '0'), on: null as boolean | null })) : []));
  const gateLis = Array.from(document.querySelectorAll<HTMLElement>('[data-lock-at]')).map((e) => ({ e, at: parseFloat(e.dataset.lockAt || '0'), on: null as boolean | null }));
  const dials = Array.from(document.querySelectorAll<HTMLElement>('[data-dial]'));
  const setSteps = (i: number, p: number) => {
    const list = steps[i];
    let lastOn: HTMLElement | null = null;
    for (const s of list) {
      const on = p >= s.at;
      if (on) lastOn = s.e;
      if (on !== s.on) { s.on = on; s.e.classList.toggle('is-on', on); }
    }
    for (const s of list) s.e.classList.toggle('is-current', s.e === (lastOn ?? list[0]?.e));
  };
  const gapLis = Array.from(document.querySelectorAll<HTMLElement>('[data-gap]'));
  let hotGap = -1;
  const gapOn = (e: Event) => { hotGap = Number((e.currentTarget as HTMLElement).dataset.gap); };
  const gapOff = () => { hotGap = -1; };
  gapLis.forEach((li) => { li.addEventListener('pointerenter', gapOn); li.addEventListener('pointerleave', gapOff); li.addEventListener('focus', gapOn); li.addEventListener('blur', gapOff); li.addEventListener('click', gapOn); });

  // ── Pointer: reflections shift with the pointer; the lens can be dragged on desktop ──
  const pointer = new THREE.Vector2(), pointerEase = new THREE.Vector2();
  const lensOffset = new THREE.Vector2(), lensTarget = new THREE.Vector2();
  let dragging = false, lastDrag = 0;
  const sphereScreen = new THREE.Vector2();
  const onMove = (e: PointerEvent) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    if (dragging) { lensTarget.set(e.clientX - sphereScreen.x, e.clientY - sphereScreen.y); lastDrag = performance.now(); }
  };
  const grab = ringEl.querySelector<SVGElement>('.grab');
  const onDown = (e: PointerEvent) => { if (tier !== 'full') return; dragging = true; ringEl.classList.add('is-dragging'); (e.target as Element).setPointerCapture?.(e.pointerId); e.preventDefault(); };
  const onUp = () => { dragging = false; ringEl.classList.remove('is-dragging'); };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  grab?.addEventListener('pointerdown', onDown as EventListener);

  // ── Sector choice brightens one side of the skyline ──
  let sector = root.dataset.sector || '';
  const onSector = () => { sector = root.dataset.sector || ''; };
  window.addEventListener('kt:sector', onSector);

  const sound = createSound();
  const onSound = (e: Event) => sound.set(Boolean((e as CustomEvent).detail));
  window.addEventListener('kt:sound', onSound);

  // ── Sizing ──
  let W = 1, H = 1, dpr = 1, mobile = false;
  const resize = () => {
    W = stage.clientWidth || window.innerWidth;
    H = stage.clientHeight || window.innerHeight;
    mobile = W <= 860;
    dpr = Math.min(window.devicePixelRatio || 1, tier === 'full' ? 2 : 1.25);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // Keep the horizontal field of view usable on tall phone screens
    camera.fov = Math.max(40, THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(20)) / camera.aspect) * 0.92)));
    camera.updateProjectionMatrix();
    timeline.measure();
  };
  resize();
  window.addEventListener('resize', resize);

  // ── State ──
  const t0 = performance.now();
  let entered = false;
  try { entered = sessionStorage.getItem('kt-entered') === '1'; } catch { /* private mode */ }
  let Td = timeline.getT(); // displayed story time
  if (Td > 0.9) entered = true;
  let forcedT: number | null = null;
  let autoTau = 0; // Light tier: the transformation plays once by itself
  let raf = 0, last = t0, frames = 0, slow = 0, disposed = false, live = false, cubeTick = 0;
  let prevLocked = 0, prevTau = 0;
  const SCENE_SECONDS = [2, 3, 4, 5.5, 2.5, 1, 6];
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const spherePos = new THREE.Vector3();
  const C_REST = new THREE.Vector3(0, 1.55, 2.2), L_REST = new THREE.Vector3(0.35, 1.4, -6);
  const C_SCAN = new THREE.Vector3(3.6, 6.4, 3.2), L_SCAN = new THREE.Vector3(-0.3, 1.0, -9.5); // lifted outside the corridor, looking in through the blueprint
  const C_DOORS = new THREE.Vector3(0, 2.3, -74.4), L_DOORS = new THREE.Vector3(0, 3.6, -112);
  const CENTRE = new THREE.Vector3(0, 1.55, -3);

  const project = (v: THREE.Vector3, out: THREE.Vector2) => {
    tmp2.copy(v).project(camera);
    out.set((tmp2.x * 0.5 + 0.5) * W, (-tmp2.y * 0.5 + 0.5) * H);
    return tmp2.z < 1 && tmp2.z > -1;
  };
  const scr = new THREE.Vector2();

  const frame = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = (now - t0) / 1000;

    // 1. Story time. Full tier: the scroll plays the film. Light tier: each scene plays once on entering view.
    const Ts = forcedT ?? timeline.getT();
    if (forcedT !== null || frames === 0) Td = Ts;
    else if (tier === 'full') Td += (Ts - Td) * (1 - Math.exp(-dt * 7));
    else {
      const s = Math.floor(Ts), p = Ts - s;
      const target = Math.min(7, s >= 5 ? Ts : s + (p > 0.12 ? 0.999 : 0));
      const rate = 1 / SCENE_SECONDS[Math.min(6, Math.floor(Td))];
      Td = Math.abs(target - Td) > 1.5 ? target : Td + clamp(target - Td, -dt * rate * 2, dt * rate);
    }
    const T = clamp(Td, 0, 7);
    const sc = Math.min(6, Math.floor(T)), p = T - sc;
    const p2 = clamp(T - 1), p3 = clamp(T - 2), p4 = clamp(T - 3), p5 = clamp(T - 4), q = clamp(T - 6);

    // Scene 6: the 3D rests. The canvas dims out and drawing stops.
    const stageOpacity = T < 5 ? 1 : T < 5.3 ? 1 - smooth((T - 5) / 0.25) : T < 5.8 ? 0 : smooth((T - 5.8) / 0.2);
    stage.style.setProperty('--stage-opacity', stageOpacity.toFixed(3));
    const finale = T >= 5.55; // teleported back to the corridor for scene 7

    // 2. Worlds: sweep, lens, lights
    const sweep = T < 1 ? 0 : T < 2 ? smooth((p2 - 0.02) / 0.42) : !finale ? 1 : 1 - smooth((q - 0.0) / 0.16);
    roomU.uSweep.value = sweep;
    const flick = (() => { const x = time * 2.3, i = Math.floor(x), f = x - i; const h = (n: number) => { const s = Math.sin(n * 91.7) * 43758.5; return s - Math.floor(s); }; return mix(h(i), h(i + 1), smooth(f)); })();
    for (let i = 0; i < 5; i++) lightI[i] = finale ? 1.25 : (0.74 - i * 0.07) * (i === 0 ? 0.78 + 0.22 * flick : 1); // gentle flicker, well under 3 flashes a second
    roomU.uStatus.value = finale ? 1 : 0;
    stage.style.setProperty('--fx', (1 - sweep).toFixed(3));

    // 3. Sphere position
    const tEnter = entered || forcedT !== null ? 1 : clamp((now - t0 - 250) / 2000);
    if (!entered && tEnter >= 1) { entered = true; try { sessionStorage.setItem('kt-entered', '1'); } catch { /* private mode */ } }
    let u = 0;
    if (!finale) {
      if (T < 2) spherePos.copy(SPHERE_REST);
      else {
        if (T < 3) u = path.uTrack * inOut((p3 - 0.04) / 0.9);
        else if (T < 4) {
          // The sphere passes each gate exactly when its stage locks in the text
          const keys = [0, ...GATE_AT, 0.96], zs = [-19, ...GATE_Z, FORK.z + 6];
          let i = 0;
          while (i < keys.length - 2 && p4 > keys[i + 1]) i++;
          u = path.uAtZ(mix(zs[i], zs[i + 1], clamp((p4 - keys[i]) / (keys[i + 1] - keys[i]))));
        } else u = mix(path.uAtZ(FORK.z + 6), 1, smooth(p5 / 0.3));
        path.curve.getPointAt(clamp(u), spherePos);
      }
      spherePos.z = mix(-17, spherePos.z, inOut(tEnter));
    } else {
      spherePos.copy(SPHERE_REST).lerp(CENTRE, smooth((q - 0.02) / 0.18));
    }
    const tauScroll = clamp((q - 0.22) / 0.4);
    if (tier === 'light' && forcedT === null) autoTau = clamp(autoTau + (tauScroll > 0.02 ? dt / 4 : -dt / 2));
    const tau = !finale ? 0 : tier === 'light' && forcedT === null ? autoTau : tauScroll;
    const hover = (1 - smooth(tau * 6)) * (finale ? 1 - smooth((q - 0.2) / 0.1) * 0 : 1);
    ball.position.copy(spherePos);
    ball.position.y += Math.sin(time * 0.9) * 0.022 * hover;
    turn.rotation.y = Math.sin(time * 0.22) * 0.4 * hover;
    plates.update(tau);
    mech.update(tau);
    core.scale.setScalar(Math.max(0.001, 1 - smooth((tau - 0.08) / 0.2)));
    chromeU.uRough.value = mix(0.02, 0.3, smooth((tau - 0.75) / 0.25)); // mirror chrome becomes brushed chrome
    const done = finale ? (tier === 'light' && forcedT === null ? smooth((tau - 0.97) / 0.03) * smooth((q - 0.3) / 0.1) : smooth((q - 0.66) / 0.1)) : 0;
    chromeU.uEdge.value = done * 0.55;
    // Triangle seams: pulse once on arrival, rest faint, open again before the transformation
    const pulse = !finale && T < 1.5 ? Math.exp(-Math.pow((time - 2.9) / 0.5, 2)) : 0;
    seamMat.opacity = tau > 0.25 ? 0 : Math.max(0.16, pulse, finale ? smooth((q - 0.1) / 0.1) : 0) * (1 - smooth((tau - 0.1) / 0.15));
    nodeGlow.forEach(({ s, ring }, i) => {
      const on = smooth((done - i * 0.2) / 0.5);
      s.material.opacity = on * 0.85;
      (ring.material as THREE.MeshBasicMaterial).opacity = on;
    });
    const arriveP = finale ? Math.min(smooth((q - 0.58) / 0.12), smooth((tau - 0.9) / 0.1)) : 0;
    arrive.visible = arriveP > 0.001;
    arrive.geometry.setDrawRange(0, Math.floor(arriveP * 80) * RADIAL * 6);

    // 4. The line, links, systems, gates, block, branches
    line.visible = !finale && T >= 2;
    line.geometry.setDrawRange(0, Math.floor(clamp(u) * TUBULAR) * RADIAL * 6);
    const linkOpacity = finale ? 0 : T < 2 ? smooth((p2 - 0.3) / 0.15) : 1;
    for (const l of links) {
      l.mesh.visible = linkOpacity > 0.001 && u < l.u1;
      l.mat.uniforms.uOpacity.value = linkOpacity;
      l.mat.uniforms.uCut.value = clamp((u - l.u0) / (l.u1 - l.u0));
    }
    for (let i = 0; i < 5; i++) lit[i + 1] = finale ? 0 : T >= 3 ? 1 : T < 2 ? 0 : smooth((u - path.uAnchors[i] + 0.004) / 0.008);
    const pub = sector === 'public' ? 1 : sector === 'private' ? 0.12 : 0.45, prv = sector === 'private' ? 1 : sector === 'public' ? 0.12 : 0.45;
    lit[SKY_SYS.public] += (pub - lit[SKY_SYS.public]) * (1 - Math.exp(-dt * 5));
    lit[SKY_SYS.private] += (prv - lit[SKY_SYS.private]) * (1 - Math.exp(-dt * 5));
    let locked = 0;
    gates.forEach((g, i) => {
      const on = !finale && (T >= 4 || (T >= 3 && p4 >= GATE_AT[i]));
      if (on) locked++;
      g.lock += ((on ? 1 : 0) - g.lock) * (1 - Math.exp(-dt * 6));
      const k = g.lock;
      g.g.rotation.z = (Math.PI / 2) * (k + 0.05 * Math.sin(Math.PI * clamp((k - 0.7) / 0.3))); // quarter turn, small overshoot, settle
      g.mat.color.copy(WIRE).lerp(CYAN, k);
      g.mat.opacity = 0.5 + 0.5 * k;
      g.g.visible = !finale && T > 2.6;
    });
    if (locked > prevLocked && frames > 5) sound.click();
    prevLocked = locked;
    const rise = T < 3 ? 0 : T >= 4 ? 1 : inOut((p4 - (BLOCK_AT - 0.14)) / 0.1);
    block.visible = !finale && rise > 0.001;
    block.scale.set(1, Math.max(0.001, rise), 1);
    block.position.y = 0.95 * rise;
    const branchP = !finale && T >= 4 ? smooth((p5 - 0.25) / 0.5) : 0;
    branches.forEach((b) => { b.visible = branchP > 0.001; b.geometry.setDrawRange(0, Math.floor(branchP * 120) * RADIAL * 6); });
    gridU.uOpacity.value = finale ? 0 : sweep;
    grid.visible = gridU.uOpacity.value > 0.01;
    sound.tone(Math.abs(tau - prevTau) > 1e-4 ? tau : -1);
    if (prevTau < 0.98 && tau >= 0.98) sound.click();
    prevTau = tau;

    // 5. Camera
    pointerEase.lerp(pointer, 1 - Math.exp(-dt * 3));
    if (finale) { camPos.copy(C_REST); camLook.copy(CENTRE); }
    else if (T < 2) { const k = inOut((p2 - 0.36) / 0.4); camPos.copy(C_REST).lerp(C_SCAN, k); camLook.copy(L_REST).lerp(L_SCAN, k); }
    else {
      // Follow the sphere along the line; in scene 4 drop lower to look along the track
      const k4 = smooth((T - 2.9) / 0.3);
      camPos.set(spherePos.x * mix(0.3, 0.6, k4) + mix(2.5, 1.5, k4), spherePos.y + mix(3.5, 1.0, k4), spherePos.z + mix(5.2, 5.4, k4));
      camLook.set(spherePos.x * 0.5, spherePos.y - mix(0.3, 0.1, k4), spherePos.z - mix(2.2, 8, k4));
      const kIn = smooth((T - 2) / 0.22);
      if (kIn < 1) { camPos.lerpVectors(C_SCAN, camPos, kIn); camLook.lerpVectors(L_SCAN, camLook, kIn); }
      const k5 = smooth((p5 - 0.05) / 0.45);
      if (T >= 4) { camPos.lerp(C_DOORS, k5); camLook.lerp(L_DOORS, k5); }
    }
    camPos.x += pointerEase.x * 0.1;
    camPos.y -= pointerEase.y * 0.05;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // Keep the subject clear of the text panel: right of centre on desktop, upper part of the screen on phones
    const centred = finale ? smooth(q / 0.18) : 0;
    const shiftX = capture ? 0 : mobile ? 0 : mix(0.15, 0, centred);
    const shiftY = capture ? 0 : mobile ? -0.2 : mix(0, 0.1, centred);
    camera.setViewOffset(W, H, -shiftX * W, -shiftY * H, W, H);

    // 6. Mask inputs in screen pixels
    project(ball.position, sphereScreen);
    tmp.copy(ball.position).add(tmp2.set(0, R, 0));
    const top = new THREE.Vector2();
    project(tmp, top);
    const rPx = Math.max(8, Math.abs(sphereScreen.y - top.y));
    if (!dragging && (now - lastDrag > 1600 || T > 0.95)) lensTarget.multiplyScalar(Math.exp(-dt * 4));
    lensOffset.lerp(lensTarget, 1 - Math.exp(-dt * 12));
    const lensR = rPx * 2.25;
    const lensOn = finale ? 0 : (1 - smooth((T - 0.98) / 0.12)) * smooth((tEnter - 0.75) / 0.25);
    const lx = sphereScreen.x + lensOffset.x, ly = sphereScreen.y + lensOffset.y;
    roomU.uLens.value.set(lx * dpr, (H - ly) * dpr, lensOn > 0.01 ? lensR * lensOn * dpr : 0);
    roomU.uScan.value.set(sphereScreen.x * dpr, (H - sphereScreen.y) * dpr, Math.hypot(W, H) * 0.92 * dpr);

    // 7. Reflections: render the room from the sphere's position
    const cubeEvery = tier === 'full' ? 2 : 8;
    if (cubeTick++ % cubeEvery === 0 || forcedT !== null) {
      ball.visible = false;
      roomU.uCube.value = 1;
      roomU.uCubeBlend.value = sweep;
      cubeCam.position.copy(ball.position);
      cubeCam.update(renderer, scene);
      roomU.uCube.value = 0;
      ball.visible = true;
    }

    // 8. Draw (not while the tab is hidden, and not during scene 6)
    if (stageOpacity > 0.001 && !document.hidden) renderer.render(scene, camera);
    if (!live) { live = true; stage.classList.add('is-live'); root.dataset.storyReady = '1'; }

    // 9. HUD layer
    const ringGrow = finale ? smooth((q - 0.74) / 0.16) * done : 0;
    const ringScale = (lensR / 80) * (finale ? mix(1.15, 3.4, ringGrow) + smooth(tau) * 0.9 : 1);
    place(ringEl, lx, ly, stageOpacity * smooth((tEnter - 0.75) / 0.25) * (finale ? mix(0.8, 0.28, ringGrow) : mix(0.9, 0.5, smooth((T - 1.9) / 0.3))), ` scale(${ringScale.toFixed(3)}) rotate(${(time * 4).toFixed(2)}deg)`);
    const sweeping = sweep > 0.002 && sweep < 0.998;
    const armA = -(roomU.uArm0.value + ((sweep * 3) % 1) * Math.PI * 2);
    place(armEl, sphereScreen.x, sphereScreen.y, sweeping ? 0.9 : 0, ` rotate(${armA.toFixed(4)}rad) scaleX(${(Math.hypot(W, H) * 0.46).toFixed(1)})`);
    const tagsOn = finale ? 0 : smooth((p2 - 0.42) / 0.15) * (1 - smooth((T - 3.05) / 0.2));
    SYSTEM_ANCHORS.forEach((a, i) => {
      tmp.copy(a); tmp.x *= 1.7; tmp.y += 1.0;
      const ok = project(tmp, scr);
      place(sysEls[i], scr.x, scr.y, ok ? tagsOn : 0);
      sysEls[i].classList.toggle('is-lit', lit[i + 1] > 0.5);
    });
    const gapU = [0, 1, 3].map((i) => mix(path.uAnchors[i], path.uAnchors[i + 1], 0.5));
    gapPoints.forEach((g, i) => {
      const ok = project(g, scr);
      const open = u < gapU[i] ? 1 : 0;
      place(gapEls[i], scr.x, scr.y, ok ? smooth((p2 - 0.46) / 0.12) * open * (finale ? 0 : 1) * (T < 3 ? 1 : 0) : 0);
      gapEls[i].classList.toggle('is-hot', hotGap === i);
    });
    GATE_Z.forEach((z, i) => {
      tmp.set(0, 2.3, z);
      const ok = project(tmp, scr);
      const near = clamp(1 - (spherePos.z - z - 14) / 10) * (spherePos.z > z - 1.5 ? 1 : 0);
      place(gateEls[i], scr.x, scr.y, ok && !finale && T > 2.95 && T < 4.2 ? near : 0);
      gateEls[i].classList.toggle('is-lit', gates[i].lock > 0.5);
    });

    // 10. Content layer: reveals, gates and dials follow the same number
    for (let i = 0; i < 7; i++) setSteps(i, i < sc ? 1 : i > sc ? 0 : p);
    for (const g of gateLis) { const on = T >= 4 || (T >= 3 && p4 >= g.at); if (on !== g.on) { g.on = on; g.e.classList.toggle('is-on', on); } }
    const run = T >= 4 ? 1 : T < 3 ? 0 : p4;
    for (const d of dials) {
      const acc = d.dataset.dial === 'accepted';
      d.style.setProperty('--fill', (acc ? clamp(run / ACCEPTED_AT) : clamp(run / 0.92)).toFixed(3));
      if (acc) d.classList.toggle('is-accepted', run >= ACCEPTED_AT);
    }

    // 11. Device tiers: step down if this device cannot hold the frame rate
    frames++;
    if (!forced && forcedT === null && frames > 20 && frames <= 140) {
      slow += dt;
      if (frames === 140) {
        const avg = slow / 120;
        if (tier === 'full' && avg > 1 / 36) { tier = 'light'; root.dataset.tier = 'light'; resize(); frames = 0; slow = 0; }
        else if (tier === 'light' && avg > 1 / 22) { onFail('slow'); }
      }
    }
  };

  const onVisibility = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVisibility);
  const onLost = (e: Event) => { e.preventDefault(); onFail('context-lost'); };
  canvas.addEventListener('webglcontextlost', onLost);
  raf = requestAnimationFrame(frame);

  // Used by scripts/capture-stills.mjs to render one still per scene.
  (window as unknown as { __ktStory?: unknown }).__ktStory = { setT: (t: number | null) => { forcedT = t; }, ready: () => live };

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('kt:sector', onSector);
      window.removeEventListener('kt:sound', onSound);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      grab?.removeEventListener('pointerdown', onDown as EventListener);
      gapLis.forEach((li) => { li.removeEventListener('pointerenter', gapOn); li.removeEventListener('pointerleave', gapOff); li.removeEventListener('focus', gapOn); li.removeEventListener('blur', gapOff); li.removeEventListener('click', gapOn); });
      sound.set(false);
      stage.classList.remove('is-live');
      delete root.dataset.storyReady;
      Array.from(hud.children).forEach((c) => ((c as HTMLElement).style.opacity = '0'));
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      glowTex.dispose();
      cubeRT.dispose();
      renderer.dispose();
      delete (window as unknown as { __ktStory?: unknown }).__ktStory;
    },
  };
}
