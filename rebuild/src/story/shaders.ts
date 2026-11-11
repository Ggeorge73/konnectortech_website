// Shared maths, colours and shaders for the story scene.
// One room shader draws both worlds; a mask chooses, per pixel, the "real" look or the "blueprint" look.
import * as THREE from 'three';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
export const inOut = (x: number) => { const t = clamp(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// All colours here are the brand tokens exactly as written, so colour management is off for this scene.
THREE.ColorManagement.enabled = false;
export const CYAN = new THREE.Color('#00C2FF');
export const WIRE = new THREE.Color('#D9DEE3');
export const AMBER = new THREE.Color('#FFB020');
export const NIGHT = new THREE.Color('#05080F');

export const ROOM_VERT = /* glsl */ `
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
// The mask that chooses, per pixel, the "real" look (0) or the "blueprint" look (1).
// Three inputs: the scanner lens, the radar sweep and an overall blend (used for the sphere's reflections).
export const MASK_GLSL = /* glsl */ `
uniform vec3 uLens; uniform vec3 uScan; uniform float uSweep; uniform float uArm0; uniform float uCube; uniform float uCubeBlend;
float storyMask() {
  if (uCube > 0.5) return uCubeBlend;
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
  return max(sw, lens);
}`;

export const ROOM_FRAG = /* glsl */ `
uniform vec3 uLights[5]; uniform float uLightI[5]; uniform float uStatus; uniform float uLit[8];
uniform vec3 uCyan; uniform vec3 uWire; uniform vec3 uNight;
varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vShade; varying float vSys; varying float vGlow; varying float vDepth;
${MASK_GLSL}
void main() {
  float mask = storyMask();
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

export const CHROME_VERT = /* glsl */ `
varying vec3 vWN; varying vec3 vWP;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; vWN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
// Mirror chrome: reflects an environment rendered live from wherever the sphere is.
export const CHROME_FRAG = /* glsl */ `
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

export const LINK_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const LINK_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uDashes; uniform float uOpacity; uniform float uCut; varying vec2 vUv;
void main() { if (vUv.x < uCut || fract(vUv.x * uDashes) > 0.55) discard; gl_FragColor = vec4(uColor, uOpacity); }`;

export const GRID_FRAG = /* glsl */ `
uniform float uOpacity; uniform vec3 uWire; varying vec3 vW; varying float vDepth;
void main() {
  vec2 c = vW.xz * 0.5; vec2 g = (0.5 - abs(fract(c) - 0.5)) / (fwidth(c) + 1e-6);
  float line = 1.0 - smoothstep(0.0, 1.3, min(g.x, g.y));
  float a = line * 0.2 * uOpacity * (1.0 - smoothstep(10.0, 70.0, vDepth));
  if (a < 0.004) discard;
  gl_FragColor = vec4(uWire, a);
}`;
export const GRID_VERT = /* glsl */ `varying vec3 vW; varying float vDepth; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;

export function glowTexture() {
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

