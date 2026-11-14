// The one number that drives everything: story time T.
// T runs from 0 to 7. The whole part is the scene (0 = scene 1), the fraction is progress through that scene.
// It is read from the browser's own scroll position (the viewport's midline). The mouse wheel is never taken over.
export const SCENE_COUNT = 7;

export function createScrollTimeline() {
  let ranges: { top: number; height: number; el: HTMLElement }[] = [];
  const measure = () => {
    const y = window.scrollY;
    ranges = Array.from(document.querySelectorAll<HTMLElement>('[data-scene]'))
      .sort((a, b) => Number(a.dataset.scene) - Number(b.dataset.scene))
      .map((el) => {
        // A scene can be led by an ordinary section (see scrollTime.ts): its range then runs from that section's top
        const lead = document.querySelector<HTMLElement>(`[data-scene-lead="${el.dataset.scene}"]`);
        const top = (lead ?? el).getBoundingClientRect().top + y, bottom = el.getBoundingClientRect().top + y + el.offsetHeight;
        return { el, top, height: Math.max(1, bottom - top) };
      });
  };
  const getT = () => {
    if (!ranges.length) measure();
    const mid = window.scrollY + window.innerHeight * 0.5;
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      if (mid < r.top) return i;
      if (mid < r.top + r.height) return i + (mid - r.top) / r.height;
    }
    return ranges.length;
  };
  const sceneEl = (i: number) => ranges[i]?.el;
  const sceneTop = (i: number) => ranges[i]?.top ?? 0;
  return { measure, getT, sceneEl, sceneTop };
}
export type ScrollTimeline = ReturnType<typeof createScrollTimeline>;
