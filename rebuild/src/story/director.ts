// The director: turns one number (story time T, 0 to 7, from the scroll) into the state of every part of the scene.
// Components read this state each frame; nothing else decides what the story shows.
import * as THREE from 'three';
import { BLOCK_AT, GATE_AT } from './timeline';
import { buildPath, FORK, GATE_Z, LIGHT_Z, SKY_SYS, SPHERE_REST } from './world';
import { clamp, CYAN, inOut, mix, NIGHT, smooth, WIRE } from './shaders';

export type Tier = 'full' | 'light';
export const CENTRE = new THREE.Vector3(0, 1.55, -3);
const SCENE_SECONDS = [2, 3, 4, 5.5, 2.5, 1, 6]; // Light tier: how long each scene takes to play once

export function createDirector(tier: Tier) {
  const params = new URLSearchParams(window.location.search);
  let entered = false;
  try { entered = sessionStorage.getItem('kt-entered') === '1'; } catch { /* private mode */ }
  const lightI = new Float32Array(5);
  const lit = new Float32Array(8);

  const s = {
    tier,
    capture: params.has('capture'),
    forced: params.get('mode') === 'story' || navigator.webdriver, // testers and scripts: never step down
    simSlow: process.env.NEXT_PUBLIC_PREVIEW === '1' && params.has('simulate-slow'),
    lowRes: false,
    pending: 0, // model and texture downloads still in flight
    forcedT: null as number | null,
    path: buildPath(),
    // Mask and light inputs for the corridor (both worlds). The corridor component only reads these.
    roomU: {
      uLights: { value: LIGHT_Z.map((z) => new THREE.Vector3(0, 2.8, z)) }, uLightI: { value: lightI }, uStatus: { value: 0 }, uLit: { value: lit },
      uLens: { value: new THREE.Vector3() }, uScan: { value: new THREE.Vector3(0, 0, 1) }, uSweep: { value: 0 }, uArm0: { value: Math.PI * 0.5 },
      uCube: { value: 0 }, uCubeBlend: { value: 0 }, uSky: { value: 0 }, uCyan: { value: CYAN }, uWire: { value: WIRE }, uNight: { value: NIGHT },
    },
    lit,
    // Per-frame story state
    t0: performance.now(), time: 0, dt: 0, frames: 0, live: false,
    Td: 0, T: 0, sc: 0, p: 0, p2: 0, p3: 0, p4: 0, p5: 0, q: 0,
    finale: false, stageOpacity: 1, sweep: 0, tEnter: entered ? 1 : 0, entered,
    u: 0, tau: 0, autoTau: 0, done: 0, hover: 1, pulse: 0, arriveP: 0,
    linkOpacity: 0, rise: 0, branchP: 0, run: 0,
    gateOn: [false, false, false, false, false], gateLock: [0, 0, 0, 0, 0],
    spherePos: SPHERE_REST.clone(), ball: null as THREE.Group | null,
    // Screen-space values written by the camera rig
    W: 1, H: 1, dpr: 1, mobile: false,
    sphereScreen: new THREE.Vector2(), lens: { x: 0, y: 0, r: 0 },
    // Inputs
    pointer: new THREE.Vector2(), pointerEase: new THREE.Vector2(),
    lensOffset: new THREE.Vector2(), lensTarget: new THREE.Vector2(), dragging: false, lastDrag: 0,
    sector: document.documentElement.dataset.sector || '', hotGap: -1,

    /** Advance the story by one frame. Ts is the story time read from the scroll. */
    step(now: number, dt: number, scrollT: number) {
      s.dt = dt;
      s.time = (now - s.t0) / 1000;
      const Ts = s.forcedT ?? scrollT;
      // Full tier: the scroll plays the film (ScrollTrigger already smooths it). Light tier: each scene plays once on entering view.
      if (s.forcedT !== null || s.frames === 0 || s.tier === 'full') s.Td = Ts;
      else {
        const sc = Math.floor(Ts), p = Ts - sc;
        const target = Math.min(7, sc >= 5 ? Ts : sc + (p > 0.12 ? 0.999 : 0));
        const rate = 1 / SCENE_SECONDS[Math.min(6, Math.floor(s.Td))];
        s.Td = Math.abs(target - s.Td) > 1.5 ? target : s.Td + clamp(target - s.Td, -dt * rate * 2, dt * rate);
      }
      if (s.frames === 0 && s.Td > 0.9) { s.entered = true; s.tEnter = 1; }
      const T = (s.T = clamp(s.Td, 0, 7));
      s.sc = Math.min(6, Math.floor(T));
      s.p = T - s.sc;
      const p2 = (s.p2 = clamp(T - 1)), p3 = (s.p3 = clamp(T - 2)), p4 = (s.p4 = clamp(T - 3)), p5 = (s.p5 = clamp(T - 4)), q = (s.q = clamp(T - 6));

      // Scene 6: the 3D rests. The canvas dims out and drawing stops.
      s.stageOpacity = T < 5 ? 1 : T < 5.3 ? 1 - smooth((T - 5) / 0.25) : T < 5.8 ? 0 : smooth((T - 5.8) / 0.2);
      const finale = (s.finale = T >= 5.55); // back in the corridor for scene 7

      // Worlds: the sweep converts the room to blueprint in scene 2 and restores it, now lit, in scene 7
      const sweep = (s.sweep = T < 1 ? 0 : T < 2 ? smooth((p2 - 0.28) / 0.2) : !finale ? 1 : 1 - smooth(q / 0.16));
      s.roomU.uSweep.value = sweep;
      s.roomU.uSky.value = finale ? 0 : smooth((T - 3.9) / 0.2);
      const x = s.time * 2.3, i0 = Math.floor(x);
      const h = (n: number) => { const v = Math.sin(n * 91.7) * 43758.5; return v - Math.floor(v); };
      const flick = mix(h(i0), h(i0 + 1), smooth(x - i0)); // gentle flicker, well under 3 flashes a second
      for (let i = 0; i < 5; i++) lightI[i] = finale ? 1.25 : (0.74 - i * 0.07) * (i === 0 ? 0.78 + 0.22 * flick : 1);
      s.roomU.uStatus.value = finale ? 1 : 0;

      // Sphere: entrance (once per session), then along the line, then to the centre for the transformation
      if (!s.entered) {
        s.tEnter = s.forcedT !== null ? 1 : clamp((now - s.t0 - 250) / 2000);
        if (s.tEnter >= 1) { s.entered = true; try { sessionStorage.setItem('kt-entered', '1'); } catch { /* private mode */ } }
      }
      let u = 0;
      if (!finale) {
        if (T < 2) s.spherePos.copy(SPHERE_REST);
        else {
          if (T < 3) u = s.path.uTrack * inOut((p3 - 0.1) / 0.8);
          else if (T < 4) {
            // The sphere passes each gate exactly when its stage locks in the text
            const keys = [0, ...GATE_AT, 0.92], zs = [-19, ...GATE_Z, FORK.z + 6];
            let i = 0;
            while (i < keys.length - 2 && p4 > keys[i + 1]) i++;
            u = s.path.uAtZ(mix(zs[i], zs[i + 1], clamp((p4 - keys[i]) / (keys[i + 1] - keys[i]))));
          } else u = mix(s.path.uAtZ(FORK.z + 6), 1, smooth(p5 / 0.25));
          s.path.curve.getPointAt(clamp(u), s.spherePos);
        }
        s.spherePos.z = mix(-17, s.spherePos.z, inOut(s.tEnter));
      } else s.spherePos.copy(SPHERE_REST).lerp(CENTRE, smooth((q - 0.02) / 0.18));
      s.u = u;

      // Transformation: scroll-played on Full, plays once by itself on Light
      const tauScroll = clamp((q - 0.22) / 0.4);
      const self = s.tier === 'light' && s.forcedT === null;
      if (self) s.autoTau = clamp(s.autoTau + (tauScroll > 0.02 ? dt / 4 : -dt / 2));
      const tau = (s.tau = !finale ? 0 : self ? s.autoTau : tauScroll);
      s.hover = 1 - smooth(tau * 6);
      s.done = finale ? (self ? smooth((tau - 0.97) / 0.03) * smooth((q - 0.3) / 0.1) : smooth((q - 0.66) / 0.1)) : 0;
      s.pulse = !finale && T < 1.5 ? Math.exp(-Math.pow((s.time - 2.9) / 0.5, 2)) : 0;
      s.arriveP = finale ? Math.min(smooth((q - 0.58) / 0.12), smooth((tau - 0.9) / 0.1)) : 0;

      // The line, links, systems, gates, block, branches
      s.linkOpacity = finale ? 0 : T < 2 ? smooth((p2 - 0.46) / 0.05) : 1;
      for (let i = 0; i < 5; i++) lit[i + 1] = finale ? 0 : T >= 3 ? 1 : T < 2 ? 0 : smooth((u - s.path.uAnchors[i] + 0.004) / 0.008);
      const pub = s.sector === 'public' ? 1 : s.sector === 'private' ? 0.12 : 0.45, prv = s.sector === 'private' ? 1 : s.sector === 'public' ? 0.12 : 0.45;
      const k = 1 - Math.exp(-dt * 5);
      lit[SKY_SYS.public] += (pub - lit[SKY_SYS.public]) * k;
      lit[SKY_SYS.private] += (prv - lit[SKY_SYS.private]) * k;
      for (let i = 0; i < 5; i++) {
        const on = (s.gateOn[i] = !finale && (T >= 4 || (T >= 3 && p4 >= GATE_AT[i])));
        s.gateLock[i] += ((on ? 1 : 0) - s.gateLock[i]) * (1 - Math.exp(-dt * 6));
      }
      s.rise = finale || T < 3 ? 0 : T >= 4 ? 1 : inOut((p4 - (BLOCK_AT - 0.27)) / 0.1); // rises in the path while the sphere is still approaching
      s.branchP = !finale && T >= 4 ? smooth((p5 - 0.2) / 0.35) : 0;
      s.run = T >= 4 ? 1 : T < 3 ? 0 : p4;
      s.frames++;
    },
  };
  return s;
}
export type Director = ReturnType<typeof createDirector>;
