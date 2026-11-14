'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { scenes, site, stages, systems } from '@/lib/site';
import { GATE_AT } from '@/story/timeline';
import { createScrollTimeline, SCENE_COUNT } from '@/story/scroll';
import { getMode, setMode, track } from '@/lib/track';
import { ScannerRing } from './Mark';

// The 3D story (React Three Fiber + GSAP ScrollTrigger) is a separate download, fetched only when it is going to play.
const Story = dynamic(() => import('@/story/Story'), { ssr: false });

// Home page only. Holds the three fixed pieces around the content layer:
//   the scene layer (one fixed 3D canvas, decoration, hidden from screen readers),
//   the HUD layer (rings, radar arm, labels pinned to points in the 3D scene),
//   and the progress rail + phone action bar.
// The 3D code is loaded after first paint, and only in story mode.
export function StoryShell() {
  const [playing, setPlaying] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  // 3D unavailable or too slow on this device: fall back to brief mode without losing the visitor's place.
  const onFail = useRef((reason: string) => { track('brief_mode_opened', { reason }); setMode('brief'); }).current;

  useEffect(() => {
    const d = document.documentElement;
    d.setAttribute('data-home', '');
    (window as unknown as { __ktBoot?: () => void }).__ktBoot?.(); // re-run tier choice after in-site navigation
    document.body.classList.add('has-action-bar');

    const tl = createScrollTimeline();
    let cancelled = false;
    let reached = 0;
    let raf = 0;

    const start = () => { if (!cancelled && getMode() === 'story') setPlaying(true); };
    const stop = () => { setPlaying(false); delete d.dataset.storyReady; };

    const update = () => {
      raf = 0;
      const T = tl.getT();
      d.style.setProperty('--progress', String(Math.min(1, T / SCENE_COUNT)));
      const current = Math.min(SCENE_COUNT - 1, Math.floor(T));
      rail.current?.querySelectorAll('a').forEach((a, i) => {
        a.classList.toggle('is-passed', i < current);
        a.classList.toggle('is-current', i === current);
        if (i === current) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      });
      bar.current?.classList.toggle('is-on', T >= 1);
      while (reached < current + 1) track('scene_reached', { scene: ++reached });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onResize = () => { tl.measure(); onScroll(); };
    const onMode = () => {
      const keep = Math.min(SCENE_COUNT - 1, Math.floor(tl.getT()));
      if (getMode() === 'story') start(); else stop();
      requestAnimationFrame(() => { tl.measure(); window.scrollTo({ top: tl.sceneTop(keep), behavior: 'auto' }); onScroll(); });
    };

    tl.measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('kt:mode', onMode);
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    if (getMode() === 'brief') track('brief_mode_opened', { reason: d.dataset.briefWhy || 'auto' });
    // Load the 3D code after first paint so the headline and buttons are never blocked by it.
    const idle = window.setTimeout(start, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(idle);
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('kt:mode', onMode);
      ro.disconnect();
      stop();
      d.removeAttribute('data-home');
      d.dataset.mode = 'brief';
      d.dataset.tier = 'brief';
      document.body.classList.remove('has-action-bar');
    };
  }, []);

  // In story mode a gate tick scrolls to the moment that gate locks; in brief mode it goes to the stage list.
  const jumpToGate = (i: number) => {
    const el = document.querySelector<HTMLElement>('[data-scene="4"]');
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const story = document.documentElement.dataset.mode === 'story';
    window.scrollTo({ top: story ? top + el.offsetHeight * (GATE_AT[i] + 0.02) - window.innerHeight / 2 : top, behavior: 'smooth' });
  };

  return (
    <>
      <div className="stage" ref={stage} aria-hidden="true">
        {/* A still of the same frame shows first; the live scene fades in over it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="stage-poster" src="/stills/poster.jpg" alt="" width={1600} height={900} decoding="async" />
        {playing ? <Story stage={stage} hud={hud} onFail={onFail} /> : null}
        <div className="stage-fx" />
      </div>
      <div className="hud-layer" ref={hud} aria-hidden="true">
        <div className="hud-arm" data-hud="arm" />
        <div className="hud-ring" data-hud="ring">
          <ScannerRing width="200" height="200" />
          <svg viewBox="-100 -100 200 200" width="200" height="200" style={{ position: 'absolute', inset: 0 }}>
            <circle className="grab" r="80" fill="none" stroke="transparent" strokeWidth="26" />
          </svg>
        </div>
        {systems.map((s, i) => <span key={s} className="hud-tag" data-hud={`sys-${i}`}>{s}</span>)}
        {[1, 2, 3].map((n) => <span key={n} className="hud-tag is-gap" data-hud={`gap-${n - 1}`}>Gap 0{n}</span>)}
        {stages.map((st) => <span key={st.n} className="hud-tag" data-hud={`gate-${st.n - 1}`}>{`0${st.n} · ${st.name}`}</span>)}
        {[0, 1, 2, 3].map((i) => <div key={i} className="hud-dock" data-hud={`dock-${i}`} />)}
      </div>
      <nav className="rail" aria-label="Story progress" ref={rail}>
        <div className="rail-track" />
        <div className="rail-fill" />
        <ol>
          {scenes.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-label={`Scene ${s.n}: ${s.name}`}><span>{`0${s.n} · ${s.name}`}</span></a>
              {s.n === 4 ? (
                // Jump between the five gates of scene 4
                <span className="rail-gates">
                  {stages.map((st, i) => (
                    <button key={st.n} type="button" aria-label={`Stage ${st.n}: ${st.name}`} onClick={() => jumpToGate(i)}><span>{`Stage 0${st.n} · ${st.name}`}</span></button>
                  ))}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
      <div className="action-bar" ref={bar}>
        <a className="btn btn-primary" href="#contact" data-cta="plan" data-pos="phone-action-bar">{site.cta.main}</a>
      </div>
    </>
  );
}
