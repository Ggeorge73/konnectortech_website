// Privacy-friendly analytics: custom events only, no advertising trackers.
// Events go to Plausible when NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set, and are always kept in window.__ktEvents
// so tests (and a later analytics tool) can read them.
export type TrackProps = Record<string, string | number | boolean>;
declare global {
  interface Window {
    __ktEvents?: { event: string; props?: TrackProps }[];
    plausible?: (event: string, opts?: { props?: TrackProps }) => void;
  }
}
export function track(event: string, props?: TrackProps) {
  if (typeof window === 'undefined') return;
  (window.__ktEvents ||= []).push({ event, props });
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the page */
  }
}

// Mode and sector live on <html> so CSS can react without waiting for React.
export type Mode = 'story' | 'brief';
export const getMode = (): Mode => (document.documentElement.dataset.mode === 'story' ? 'story' : 'brief');
export function setMode(mode: Mode, remember = true) {
  const d = document.documentElement;
  if (mode === 'story' && d.dataset.canStory !== '1') return false;
  d.dataset.mode = mode;
  if (remember) try { localStorage.setItem('kt-mode', mode); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('kt:mode', { detail: mode }));
  return true;
}
export type Sector = 'public' | 'private' | null;
export const getSector = (): Sector => {
  const s = document.documentElement.dataset.sector;
  return s === 'public' || s === 'private' ? s : null;
};
export function setSector(sector: Sector) {
  const d = document.documentElement;
  if (sector) d.dataset.sector = sector; else delete d.dataset.sector;
  try { if (sector) sessionStorage.setItem('kt-sector', sector); else sessionStorage.removeItem('kt-sector'); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('kt:sector', { detail: sector }));
}
