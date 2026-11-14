'use client';
import { useEffect, useState } from 'react';
import { getMode, setMode, track, type Mode } from '@/lib/track';

// The home page always opens with the story (owner decision, 14 Nov 2026), so there is no "Skip the story".
// Only when the plain version opened by itself (reduced motion or data saver) is "Play the story" offered,
// and only on a device that can run it.
export function ModeSwitch({ pos, className = 'link-quiet' }: { pos: string; className?: string }) {
  const [mode, setM] = useState<Mode>('brief');
  const [can, setCan] = useState(false);
  useEffect(() => {
    const sync = () => setM(getMode());
    sync();
    setCan(document.documentElement.dataset.canStory === '1' && document.documentElement.hasAttribute('data-home'));
    window.addEventListener('kt:mode', sync);
    return () => window.removeEventListener('kt:mode', sync);
  }, []);
  if (mode !== 'brief' || !can) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        track('story_opened', { position: pos });
        setMode('story');
        window.scrollTo({ top: 0, behavior: 'auto' });
      }}
    >
      Play the story
    </button>
  );
}
