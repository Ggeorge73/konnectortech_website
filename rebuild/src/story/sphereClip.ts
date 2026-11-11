// Loads the sphere-to-mark transformation animated in Blender (art/build_sphere.py): 36 plates, a hub and three
// pistons, exported as one clip named "Transform". The story sets the clip's time from the scroll.
// If the file cannot load, the coded plates keep running, so the story never depends on it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type SphereClip = { scene: THREE.Group; setProgress: (tau: number) => void; dispose: () => void };

export async function loadSphereClip(materials: { plate: THREE.Material; mechanism: THREE.Material; rod: THREE.Material }): Promise<SphereClip> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/sphere.glb');
  const clip = gltf.animations.find((a) => a.name === 'Transform') ?? gltf.animations[0];
  if (!clip) throw new Error('sphere model has no animation clip');
  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes.push(m);
    m.frustumCulled = false;
    m.material = /^plate_/.test(m.name) || /^plate_/.test(m.parent?.name || '') ? materials.plate : /^rod_/.test(m.name) ? materials.rod : materials.mechanism;
  });
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.play();
  action.paused = true;
  let last = -1;
  return {
    scene: gltf.scene,
    setProgress(tau) {
      if (Math.abs(tau - last) < 1e-4) return;
      last = tau;
      action.time = Math.min(clip.duration - 1e-4, Math.max(0, tau) * clip.duration);
      mixer.update(0);
    },
    dispose() { mixer.stopAllAction(); meshes.forEach((m) => m.geometry.dispose()); },
  };
}
