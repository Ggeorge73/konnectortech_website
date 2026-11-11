// HUD layer and content-layer hooks. Both follow the same story state as the 3D scene:
// rings, the radar arm and labels pinned to points in the scene, plus step reveals, gates and dials in the page text.
import * as THREE from 'three';
import type { Director } from './director';
import { ACCEPTED_AT } from './timeline';
import { GATE_Z, SYSTEM_ANCHORS } from './world';
import { clamp, inOut, mix, smooth } from './shaders';

// Label heights are staggered so the five system labels stay apart when seen down the length of the room.
const TAG_Y = [2.3, 2.0, 2.55, 1.75, 2.8];

export function createOverlay(s: Director, stage: HTMLElement, hud: HTMLElement) {
  const el = (name: string) => hud.querySelector<HTMLElement>(`[data-hud="${name}"]`)!;
  const ringEl = el('ring'), armEl = el('arm');
  const sysEls = SYSTEM_ANCHORS.map((_, i) => el(`sys-${i}`));
  const gapU = [0, 1, 3].map((i) => mix(s.path.uAnchors[i], s.path.uAnchors[i + 1], 0.5));
  const gapPoints = gapU.map((u) => s.path.curve.getPointAt(u));
  const gapEls = gapPoints.map((_, i) => el(`gap-${i}`));
  const gapHot = gapEls.map(() => false);
  const gateEls = GATE_Z.map((_, i) => el(`gate-${i}`));
  // Scene 3: each service panel docks onto the line. A leader runs from the panel to the point on the line it joined.
  const dockEls = [0, 1, 2, 3].map((i) => el(`dock-${i}`));
  const serviceLis = Array.from(document.querySelectorAll<HTMLElement>('[data-scene="3"] [data-at]'));
  const dockU = serviceLis.map((li) => clamp(s.path.uTrack * inOut((parseFloat(li.dataset.at || '0') - 0.1) / 0.8)));
  const sidePanel = document.querySelector<HTMLElement>('[data-scene="3"] .panel');
  // Measuring layout every frame forces the browser to recompute it every frame. Sizes are read at most twice a second.
  const cache = new Map<string, { at: number; v: number }>();
  const measured = (key: string, read: () => number) => {
    const hit = cache.get(key);
    if (hit && s.time - hit.at < 0.5) return hit.v;
    const v = read();
    cache.set(key, { at: s.time, v });
    return v;
  };
  const panelRight = () => (sidePanel ? measured('p3', () => sidePanel.getBoundingClientRect().right) : 0);
  const scanPanel = document.querySelector<HTMLElement>('[data-scene="2"] .panel');
  const scanPanelRight = () => (scanPanel && !s.mobile && s.T < 2.1 ? Math.max(0, measured('p2', () => scanPanel.getBoundingClientRect().right)) : 0);
  // Styles are written only when they change, so hidden labels cost nothing per frame
  const shown = new WeakMap<HTMLElement, string>();
  const place = (e: HTMLElement, x: number, y: number, opacity: number, extra = '') => {
    const o = opacity.toFixed(2);
    if (shown.get(e) !== o) { e.style.opacity = o; shown.set(e, o); }
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


  const tmp = new THREE.Vector3(), scr = new THREE.Vector2();
  let camera: THREE.Camera | null = null;
  let lastSo = '', lastFx = '';
  const project = (p: THREE.Vector3) => {
    tmp.copy(p).project(camera!);
    scr.set((tmp.x * 0.5 + 0.5) * s.W, (-tmp.y * 0.5 + 0.5) * s.H);
    return tmp.z < 1 && tmp.z > -1;
  };

  return {
    setCamera(c: THREE.Camera) { camera = c; },
    update() {
      const { T, p2, q, finale, tau, sweep, time, stageOpacity } = s;
      const so = stageOpacity.toFixed(2), fx = (1 - sweep).toFixed(2); // film grain and darkened edges belong to the real world only
      if (so !== lastSo) { stage.style.setProperty('--stage-opacity', so); lastSo = so; }
      if (fx !== lastFx) { stage.style.setProperty('--fx', fx); lastFx = fx; }

      if (camera) {
        const ringGrow = finale ? smooth((q - 0.74) / 0.16) * s.done : 0;
        const ringScale = (s.lens.r / 80) * (finale ? mix(1.15, 3.4, ringGrow) + smooth(tau) * 0.9 : 1);
        const ringOpacity = stageOpacity * smooth((s.tEnter - 0.75) / 0.25) * (finale ? mix(0.8, 0.28, ringGrow) : mix(0.9, 0.5, smooth((T - 1.9) / 0.3)));
        place(ringEl, s.lens.x, s.lens.y, ringOpacity, ` scale(${ringScale.toFixed(3)}) rotate(${(time * 4).toFixed(2)}deg)`);
        const armA = -(s.roomU.uArm0.value + ((sweep * 3) % 1) * Math.PI * 2);
        place(armEl, s.sphereScreen.x, s.sphereScreen.y, sweep > 0.002 && sweep < 0.998 ? 0.9 : 0, ` rotate(${armA.toFixed(4)}rad) scaleX(${(Math.hypot(s.W, s.H) * 0.46).toFixed(1)})`);

        // Scene 2's labels (systems and gaps) belong to scene 2 only: they are gone by the time scene 3 starts, on every tier
        // On the Light tier a scene plays to its end and rests there (T = 1.999) while the visitor reads, so its labels
        // must stay until scene 3 really begins. On Full the scroll drives T, and they fade over the last tenth of the scene.
        const scene2Out = s.tier === 'full' ? 1 - smooth((T - 1.9) / 0.08) : 1 - smooth((T - 1.9992) / 0.01);
        const tagsOn = finale ? 0 : smooth((p2 - 0.46) / 0.05) * scene2Out;
        // The five system labels never overlap: each is nudged up until it is clear of the ones already placed,
        // and kept inside the frame and clear of the text panel.
        const boxes: [number, number, number, number][] = [];
        const left = scanPanelRight() + 12;
        SYSTEM_ANCHORS.forEach((a, i) => {
          tmp.set(a.x < 0 ? a.x * 0.85 : a.x * 1.25, TAG_Y[i], a.z);
          const ok = project(tmp);
          const w = measured(`tag${i}`, () => sysEls[i].offsetWidth) || 110, h = 24;
          const x = clamp(scr.x, Math.min(left + w / 2, s.W - w / 2 - 8), s.W - w / 2 - 8);
          let y = clamp(scr.y, 96, s.H - 40);
          for (let n = 0; n < 30 && boxes.some(([x0, y0, x1, y1]) => x - w / 2 < x1 + 8 && x + w / 2 > x0 - 8 && y - h < y1 + 4 && y > y0 - 4); n++) y -= 10;
          if (ok && tagsOn > 0.001) boxes.push([x - w / 2, y - h, x + w / 2, y]);
          place(sysEls[i], x, y, ok ? tagsOn : 0);
          sysEls[i].classList.toggle('is-lit', s.lit[i + 1] > 0.5);
        });
        gapPoints.forEach((g, i) => {
          const ok = project(g);
          // The chosen gap's label grows and fills; the other two fade back. (The cards in the page text set s.gap.)
          const hot = s.gap === i, dim = s.gap >= 0 && !hot;
          place(gapEls[i], scr.x, scr.y, ok && !finale ? smooth((p2 - 0.48) / 0.05) * scene2Out * (dim ? 0.45 : 1) : 0);
          if (gapHot[i] !== hot) { gapHot[i] = hot; gapEls[i].classList.toggle('is-hot', hot); }
        });
        // Scene 3 (desktop): each service panel docks onto the line itself and rides it behind the sphere.
        // A panel joins at the point the sphere had reached, then keeps its place in the queue as the sphere moves on.
        const live = T >= 2 && T < 3.03 && !finale && !s.mobile;
        const onCount = live ? serviceLis.filter((li) => li.classList.contains('is-on')).length : 0;
        // Boxes already taken on screen: the sphere first, then each placed panel. A panel moves away from the line until it is clear.
        const taken: [number, number, number, number][] = [];
        const sr = s.lens.r / 2.25 + 10;
        if (live) taken.push([s.sphereScreen.x - sr, s.sphereScreen.y - sr, s.sphereScreen.x + sr, s.sphereScreen.y + sr]);
        serviceLis.forEach((li, i) => {
          const d = dockEls[i];
          const on = live && li.classList.contains('is-on');
          li.classList.toggle('is-docked', !!on);
          if (!on || !d) { if (d) d.style.opacity = '0'; return; }
          const slot = onCount - 1 - i; // newest panel rides closest to the sphere
          const u = Math.min(s.u - 0.007, Math.max(dockU[i], s.u - (0.009 + 0.0095 * slot)));
          project(s.path.curve.getPointAt(clamp(u)));
          const px = scr.x, py = scr.y, above = i % 2 === 0, w = 280, h = measured(`li${i}`, () => li.offsetHeight) || 80;
          // Find the nearest free place: first on the panel's own side of the line, then the other side, then further along.
          const minX = panelRight() + 14, maxX = s.W - w - 14, minY = 78, maxY = s.H - h - 12;
          const free = (xx: number, yy: number) => yy >= minY && yy <= maxY && !taken.some(([x0, y0, x1, y1]) => xx < x1 + 10 && xx + w > x0 - 10 && yy < y1 + 10 && yy + h > y0 - 10);
          let x = clamp(px - w / 2 + (above ? -30 : 30), minX, maxX), y = clamp(above ? py - 40 - h : py + 40, minY, maxY), found = false;
          search: for (const shift of [0, -(w + 20), w + 20, -2 * (w + 20), 2 * (w + 20)]) {
            const xx = clamp(px - w / 2 + shift, minX, maxX);
            for (const dir of above ? [-1, 1] : [1, -1]) for (let n = 0; n < 50; n++) {
              const yy = (dir < 0 ? py - 40 - h : py + 40) + dir * n * 12;
              if (free(xx, yy)) { x = xx; y = yy; found = true; break search; }
            }
          }
          void found;
          taken.push([x, y, x + w, y + h]);
          li.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
          const ex = clamp(px, x + 16, x + w - 16), ey = y + h < py ? y + h : y > py ? y : clamp(py, y, y + h), dx = ex - px, dy = ey - py;
          place(d, px, py, 0.9, ` rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${Math.hypot(dx, dy).toFixed(1)})`);
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
        const fill = (acc ? clamp(s.run / ACCEPTED_AT) : clamp(s.run / 0.86)).toFixed(2);
        if (d.dataset.fill !== fill) { d.dataset.fill = fill; d.style.setProperty('--fill', fill); }
        if (acc) d.classList.toggle('is-accepted', s.run >= ACCEPTED_AT);
      }
    },
    dispose() {
      Array.from(hud.children).forEach((c) => ((c as HTMLElement).style.opacity = '0'));
      serviceLis.forEach((li) => { li.classList.remove('is-docked'); li.style.transform = ''; });
    },
  };
}
