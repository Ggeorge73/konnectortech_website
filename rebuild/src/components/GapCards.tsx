'use client';
import { useEffect, useRef, useState } from 'react';
import { gaps } from '@/lib/site';
import { gapFocus } from '@/lib/gapFocus';
import { GAP_AT } from '@/story/timeline';

// Scene 2: the three gap cards. Choosing a card points to its gap: Gap 01, 02 or 03 in the 3D room (story mode)
// or on the still frame (brief mode). Choosing it again, or another card, switches it.
// The state is a data attribute, not a class: the story engine owns the class list of these items (is-on, is-current).
export function GapCards() {
  const [pinned, setPinned] = useState(-1);
  const [hover, setHover] = useState(-1);
  const list = useRef<HTMLUListElement>(null);
  const active = hover >= 0 ? hover : pinned;
  useEffect(() => {
    gapFocus.pinned = pinned;
    gapFocus.hover = hover;
    const scene = list.current?.closest<HTMLElement>('[data-scene]');
    if (!scene) return;
    if (active >= 0) scene.dataset.gapActive = String(active);
    else delete scene.dataset.gapActive;
  }, [pinned, hover, active]);
  useEffect(() => () => { gapFocus.pinned = -1; gapFocus.hover = -1; }, []);

  return (
    <ul className="gap-list" data-stack ref={list}>
      {gaps.map((g, i) => (
        <li key={g.key} data-at={GAP_AT[i]} data-gap={i} data-focus={active === i ? 'hot' : active >= 0 ? 'dim' : undefined}>
          <button
            type="button"
            aria-pressed={pinned === i}
            onClick={() => { setPinned(pinned === i ? -1 : i); setHover(-1); }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(i); }}
            onPointerLeave={() => setHover(-1)}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setHover(i); }}
            onBlur={() => setHover(-1)}
          >
            <span className="gap-no">Gap 0{i + 1}</span>
            <b>{g.title}</b><span className="gap-text">{g.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
