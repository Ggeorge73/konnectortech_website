// Loads the Blender-built corridor: Meshopt geometry, baked lighting as KTX2 textures (dim and lit),
// and the blueprint line set. Built by the scripts in /art. If anything fails to load, the story keeps
// the coded stand-in room, so the page never depends on these files.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MASK_GLSL } from './shaders';

export type RoomAssets = { mesh: THREE.Mesh; lines: THREE.LineSegments; dispose: () => void };

const VERT = /* glsl */ `
attribute float _sys; attribute float _glow;
varying vec2 vUv; varying vec3 vW; varying float vSys; varying float vGlow; varying float vDepth;
void main() {
  vUv = uv; vSys = _sys; vGlow = _glow;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mv = viewMatrix * w; vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
// Real world: the baked lighting, straight from the texture. Blueprint: solid black, so the lines read cleanly.
const FRAG = /* glsl */ `
uniform sampler2D uDim; uniform sampler2D uLitTex; uniform vec3 uLights[5]; uniform float uLightI[5]; uniform float uStatus;
uniform vec3 uCyan; uniform vec3 uNight;
varying vec2 vUv; varying vec3 vW; varying float vSys; varying float vGlow; varying float vDepth;
${MASK_GLSL}
void main() {
  float mask = storyMask();
  vec3 real = mix(texture2D(uDim, vUv).rgb, texture2D(uLitTex, vUv).rgb, uStatus);
  // The first strip light flickers gently in scene 1 (the bake is steady; this dims its pool of light)
  vec3 toLight = uLights[0] - vW;
  real *= mix(1.0, uLightI[0] / 0.74, exp(-dot(toLight, toLight) / 14.0) * (1.0 - uStatus));
  if (vGlow > 0.5 && vGlow < 1.5) real = mix(vec3(0.03), uCyan * 1.2, uStatus);
  real = mix(real, uNight, smoothstep(7.0, 26.0, vDepth));
  gl_FragColor = vec4(mix(real, uNight * 0.7, mask), 1.0);
}`;
const LINE_VERT = /* glsl */ `
attribute float _sys; varying float vSys; varying float vDepth;
void main() { vSys = _sys; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const LINE_FRAG = /* glsl */ `
uniform float uLit[8]; uniform vec3 uCyan; uniform vec3 uWire; uniform vec3 uNight;
varying float vSys; varying float vDepth;
${MASK_GLSL}
void main() {
  float mask = storyMask();
  if (mask < 0.5) discard;
  float lit = uLit[int(vSys + 0.5)];
  float fade = 1.0 - 0.7 * smoothstep(8.0, 40.0, vDepth);
  gl_FragColor = vec4(uNight * 0.7 + mix(uWire, uCyan, lit) * fade * (0.5 + 0.6 * lit), 1.0);
}`;

export async function loadRoom(renderer: THREE.WebGLRenderer, tier: 'full' | 'light', uniforms: Record<string, THREE.IUniform>): Promise<RoomAssets> {
  // Full: KTX2 textures (2048 px). Light: small JPG textures (640 px), so phones do not download the KTX2 decoder.
  const ktx2 = tier === 'full' ? new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer) : null;
  const plain = new THREE.TextureLoader();
  const bake = (name: string): Promise<THREE.Texture> => (ktx2 ? ktx2.loadAsync(`/models/${name}.full.ktx2`) : plain.loadAsync(`/models/${name}.light.jpg`));
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  try {
    const [room, lineSet, dim, lit] = await Promise.all([gltf.loadAsync('/models/room.glb'), gltf.loadAsync('/models/room_lines.glb'), bake('room_dim'), bake('room_lit')]);
    for (const t of [dim, lit]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = tier === 'full' ? 4 : 1; t.flipY = false; t.needsUpdate = true; }
    let mesh: THREE.Mesh | null = null, lines: THREE.LineSegments | null = null;
    room.scene.updateMatrixWorld(true);
    lineSet.scene.updateMatrixWorld(true);
    room.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    lineSet.scene.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) lines = o as THREE.LineSegments; });
    if (!mesh || !lines) throw new Error('room model is missing its mesh or line set');
    const m = mesh as THREE.Mesh, l = lines as THREE.LineSegments;
    m.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...uniforms, uDim: { value: dim }, uLitTex: { value: lit } }, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    l.material = new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms });
    for (const o of [m, l]) { o.matrixAutoUpdate = false; o.matrix.copy(o.matrixWorld); o.frustumCulled = false; }
    return {
      mesh: m, lines: l,
      dispose() { dim.dispose(); lit.dispose(); m.geometry.dispose(); l.geometry.dispose(); (m.material as THREE.Material).dispose(); (l.material as THREE.Material).dispose(); },
    };
  } finally {
    ktx2?.dispose();
  }
}
