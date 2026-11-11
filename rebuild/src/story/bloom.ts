// Selective bloom for the Full tier: glow on the cyan line, seams, rings and the mark's three nodes only.
// The white strip lights and everything else stay unbloomed, because only objects on BLOOM_LAYER feed the bloom.
// How: draw the whole scene in black (so nearer things still hide the glow), draw the bloom-layer objects in
// their own colours on top, blur that at half resolution, and add the result over the finished frame.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

export const BLOOM_LAYER = 1; // objects that glow (they are also on layer 0)
export const OVERLAY_LAYER = 2; // sprites, halo and grid: drawn in the main view, left out of the black pass

class GlowSourcePass extends Pass {
  private black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private saved = new THREE.Color();
  constructor(private scene: THREE.Scene, private camera: THREE.Camera) { super(); this.needsSwap = false; }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const auto = renderer.autoClear, mask = this.camera.layers.mask, alpha = renderer.getClearAlpha();
    renderer.getClearColor(this.saved);
    renderer.autoClear = false;
    renderer.setRenderTarget(read);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    this.scene.overrideMaterial = this.black;
    this.camera.layers.set(0);
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    this.camera.layers.set(BLOOM_LAYER);
    renderer.render(this.scene, this.camera);
    this.camera.layers.mask = mask;
    renderer.setClearColor(this.saved, alpha);
    renderer.autoClear = auto;
  }
  dispose() { this.black.dispose(); }
}

export function createBloom(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer);
  composer.renderToScreen = false;
  composer.setPixelRatio(1);
  const source = new GlowSourcePass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.0);
  composer.addPass(source);
  composer.addPass(bloom);
  const quad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }',
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  }));
  return {
    setSize(w: number, h: number) { composer.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2))); },
    /** Call right after the normal frame has been drawn to the screen. */
    render() {
      composer.render();
      (quad.material as THREE.ShaderMaterial).uniforms.tDiffuse.value = composer.readBuffer.texture;
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      quad.render(renderer);
      renderer.autoClear = auto;
    },
    dispose() { source.dispose(); bloom.dispose(); composer.dispose(); quad.dispose(); (quad.material as THREE.Material).dispose(); },
  };
}
export type Bloom = ReturnType<typeof createBloom>;
