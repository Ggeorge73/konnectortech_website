// HUD layer and content-layer hooks. Both follow the same story state as the 3D scene:
// rings, the radar arm and labels pinned to points in the scene, plus step reveals, gates and dials in the page text.
import * as THREE from 'three';
import type { Director } from './director';
import { ACCEPTED_AT } from './timeline';
import { GATE_Z, SYSTEM_ANCHORS } from './world';
import { clamp, mix, smooth } from './shaders';

// Label heights are staggered so the five system labels stay apart when seen down the length of the room.
const TAG_Y = [2.25, 2.05, 2.55, 1.85, 2.85];

export function createOverlay(s: Director, stage: HTMLElement, hud: HTMLElement) {
  const el = (name: string) => hud.querySelector<HTMLElement>(`[data-hud="${name}"]`)!;
  const ringEl = el('ring'), armEl = el('arm');
  const sysEls = SYSTEM_ANCHORS.map((_, i) => el(`sys-${i}`));
  const gapU = [0, 1, 3].map((i) => mix(s.path.uAnchors[i], s.path.uAnchors[i + 1], 0.5));
  const gapPoints = gapU.map((u) => s.path.curve.getPointAt(u));
  const gapEls = gapPoints.map((_, i) => el(`gap-${i}`));
  const gateEls = GATE_Z.map((_, i) => el(`gate-${i}`));
  const place = (e: HTMLElement, x: number, y: number, opacity: number, extra = '') => {
    e.style.opacity = opacity.toFixed(3);
    if (opacity > 0.001) e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${extra}`;
  };

  const sceneEls = Array.from({ length: 7 }, (_, i) => document.querySelector<HTMLElement>(`[data-scene="${i + 1}"]`));
  const steps = sceneEls.map((sc) => (sc ? Array.from(sc.querySelectorAll<HTMLElement>('[data-at]')).map((e) => ({ e, at: parseFloat(e.dataset.at || '0'), on: null as boolean | null })) : []));
  const gateLis = Array.from(document.querySelectorAll<HTMLElement>('[data-lock-at]')).map((e, i) => ({ e, i, on: null as boolean | null }));
  const dials = Array.from(document.querySelectorAll<HTMLElement>('[data-dial]'));
  const setSteps = (i: number, p: number) => {
    const list = steps[i];
    let lastOn: HTMLElement | null = null;
    for (const st of list) {
      const on = p >= st.at;
      if (on) lastOn = st.e;
      if (on !== st.on) { st.on = on; st.e.classList.toggle('is-on', on); }
    }
    for (const st of list) st.e.classList.toggle('is-current', st.e === (lastOn ?? list[0]?.e));
  };

  // Hover, focus or tap a gap in the text to enlarge its label in the scene
  const gapLis = Array.from(document.querySelectorAll<HTMLElement>('[data-gap]'));
  const gapOn = (e: Event) => { s.hotGap = Number((e.currentTarget as HTMLElement).dataset.gap); };
  const gapOff = () => { s.hotGap = -1; };
  const gapEvents: [string, (e: Event) => void][] = [['pointerenter', gapOn], ['pointerleave', gapOff], ['focus', gapOn], ['blur', gapOff], ['click', gapOn]];
  gapLis.forEach((li) => gapEvents.forEach(([name, fn]) => li.addEventListener(name, fn)));

  const tmp = new THREE.Vector3(), scr = new THREE.Vector2();
  let camera: THREE.Camera | null = null;
  const project = (p: THREE.Vector3) => {
    tmp.copy(p).project(camera!);
    scr.set((tmp.x * 0.5 + 0.5) * s.W, (-tmp.y * 0.5 + 0.5) * s.H);
    return tmp.z < 1 && tmp.z > -1;
  };

  return {
    setCamera(c: THREE.Camera) { camera = c; },
    update() {
      const { T, p2, q, finale, tau, sweep, time, stageOpacity } = s;
      stage.style.setProperty('--stage-opacity', stageOpacity.toFixed(3));
      stage.style.setProperty('--fx', (1 - sweep).toFixed(3)); // film grain and darkened edges belong to the real world only

      if (camera) {
        const ringGrow = finale ? smooth((q - 0.74) / 0.16) * s.done : 0;
        const ringScale = (s.lens.r / 80) * (finale ? mix(1.15, 3.4, ringGrow) + smooth(tau) * 0.9 : 1);
        const ringOpacity = stageOpacity * smooth((s.tEnter - 0.75) / 0.25) * (finale ? mix(0.8, 0.28, ringGrow) : mix(0.9, 0.5, smooth((T - 1.9) / 0.3)));
        place(ringEl, s.lens.x, s.lens.y, ringOpacity, ` scale(${ringScale.toFixed(3)}) rotate(${(time * 4).toFixed(2)}deg)`);
        const armA = -(s.roomU.uArm0.value + ((sweep * 3) % 1) * Math.PI * 2);
        place(armEl, s.sphereScreen.x, s.sphereScreen.y, sweep > 0.002 && sweep < 0.998 ? 0.9 : 0, ` rotate(${armA.toFixed(4)}rad) scaleX(${(Math.hypot(s.W, s.H) * 0.46).toFixed(1)})`);

        const tagsOn = finale ? 0 : smooth((p2 - 0.3) / 0.1) * (1 - smooth((T - 3.02) / 0.15));
        SYSTEM_ANCHORS.forEach((a, i) => {
          tmp.set(a.x < 0 ? a.x * 0.8 : a.x * 1.6, TAG_Y[i], a.z); // left-side labels sit nearer the aisle, clear of the text panel
          const ok = project(tmp);
          place(sysEls[i], scr.x, scr.y, ok ? tagsOn : 0);
          sysEls[i].classList.toggle('is-lit', s.lit[i + 1] > 0.5);
        });
        gapPoints.forEach((g, i) => {
          const ok = project(g);
          const open = s.u < gapU[i] && T < 3 && !finale ? 1 : 0;
          place(gapEls[i], scr.x, scr.y, ok ? smooth((p2 - 0.34) / 0.08) * open : 0);
          gapEls[i].classList.toggle('is-hot', s.hotGap === i);
        });
        GATE_Z.forEach((z, i) => {
          tmp.set(0, 2.3, z);
          const ok = project(tmp);
          const near = clamp(1 - (s.spherePos.z - z - 14) / 10) * (s.spherePos.z > z - 1.5 ? 1 : 0);
          place(gateEls[i], scr.x, scr.y, ok && !finale && T > 2.95 && T < 4.2 ? near : 0);
          gateEls[i].classList.toggle('is-lit', s.gateLock[i] > 0.5);
        });
      }

      for (let i = 0; i < 7; i++) setSteps(i, i < s.sc ? 1 : i > s.sc ? 0 : s.p);
      for (const g of gateLis) { const on = s.gateOn[g.i]; if (on !== g.on) { g.on = on; g.e.classList.toggle('is-on', on); } }
      for (const d of dials) {
        const acc = d.dataset.dial === 'accepted';
        d.style.setProperty('--fill', (acc ? clamp(s.run / ACCEPTED_AT) : clamp(s.run / 0.86)).toFixed(3));
        if (acc) d.classList.toggle('is-accepted', s.run >= ACCEPTED_AT);
      }
    },
    dispose() {
      gapLis.forEach((li) => gapEvents.forEach(([name, fn]) => li.removeEventListener(name, fn)));
      Array.from(hud.children).forEach((c) => ((c as HTMLElement).style.opacity = '0'));
    },
  };
}
