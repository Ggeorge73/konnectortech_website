// Scroll timeline: GSAP ScrollTrigger scrubs one value per scene; their sum is story time T (0 to 7).
// The browser's own scrolling and the CSS sticky pins are left alone. Nothing here pins or takes over the wheel.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Tier } from './director';

export function createScrollTime(tier: Tier) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0); // on a slow frame the story still catches up with the scroll in real time
  const progress: Record<string, number> = {};
  const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]')).sort((a, b) => Number(a.dataset.scene) - Number(b.dataset.scene));
  const ctx = gsap.context(() => {
    scenes.forEach((el, i) => {
      progress[`p${i}`] = 0;
      gsap.to(progress, {
        [`p${i}`]: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          // A scene runs while it crosses the viewport's midline. Positions are measured from the element itself,
          // so they stay right whatever the page's scroll position or scroll-behavior is at refresh time.
          start: () => Math.max(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2),
          end: () => el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight / 2,
          scrub: tier === 'full' ? 0.35 : true, // Full: short smoothing for a heavy, mechanical feel. Light: direct.
          invalidateOnRefresh: true,
        },
      });
    });
  });
  return {
    getT: () => { let sum = 0; for (let i = 0; i < scenes.length; i++) sum += progress[`p${i}`]; return sum; },
    // Read the scroll position now. ScrollTrigger normally waits for the browser's scroll event; if one is dropped or
    // lands while it is re-measuring, the story would sit a step behind until the next scroll. Checked once a frame.
    sync: () => ScrollTrigger.update(),
    refresh: () => ScrollTrigger.refresh(),
    kill: () => ctx.revert(),
  };
}
export type ScrollTime = ReturnType<typeof createScrollTime>;
