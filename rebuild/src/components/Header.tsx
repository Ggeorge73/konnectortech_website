'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { nav, site } from '@/lib/site';
import { Mark } from './Mark';

export function Header() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  useEffect(() => setOpen(false), [path]);

  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    window.dispatchEvent(new CustomEvent('kt:sound', { detail: on }));
  };

  return (
    <header className={`site-header${solid ? ' is-solid' : ''}${open ? ' is-open' : ''}`}>
      <div className="wrap">
        <Link className="brand" href="/" aria-label={`${site.name} home`}>
          <Mark />
          <span>{site.name}</span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav-links" id="nav-links">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={path.startsWith(item.href) && !item.href.includes('#') ? 'page' : undefined} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Sound is optional and off by default. Shown only while the 3D story is running. */}
        <button type="button" className="icon-btn sound-toggle" aria-pressed={sound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'} title={sound ? 'Turn sound off' : 'Turn sound on'} onClick={toggleSound}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" />
            {sound ? <path d="M13 7a4 4 0 0 1 0 6M15.5 4.5a7.5 7.5 0 0 1 0 11" /> : <path d="M13.5 7.5l4 5M17.5 7.5l-4 5" />}
          </svg>
        </button>
        <Link className="btn btn-primary btn-sm" href="/#contact" data-cta="plan" data-pos="top-bar">
          {site.cta.main}
        </Link>
        <button type="button" className="icon-btn nav-toggle" aria-expanded={open} aria-controls="nav-links" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 6h16M3 11h16M3 16h16" />}
          </svg>
        </button>
      </div>
    </header>
  );
}
