'use client';
import { useEffect } from 'react';
import { track } from '@/lib/track';

// Records "each button by position": any element with data-cta reports its kind and where it sits.
export function Analytics() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-cta]') as HTMLElement | null;
      if (el) track('cta_click', { cta: el.dataset.cta || '', position: el.dataset.pos || '' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
