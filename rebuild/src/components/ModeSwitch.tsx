'use client';
import { useEffect, useState } from 'react';
import { getMode, setMode, track, type Mode } from '@/lib/track';

// "Skip the story" opens brief mode: the same copy and buttons, still images, normal scrolling.
// Anyone can switch at any time and the choice is remembered.
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
  if (mode === 'brief' && !can) return null;
  const toStory = mode === 'brief';
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (toStory) {
          track('story_opened', { position: pos });
          setMode('story');
        } else {
          track('story_skipped', { position: pos });
          track('brief_mode_opened', { reason: 'choice' });
          setMode('brief');
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
      }}
    >
      {toStory ? 'Play the story' : 'Skip the story'}
    </button>
  );
}
