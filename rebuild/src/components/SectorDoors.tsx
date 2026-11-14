'use client';
import { useEffect, useState } from 'react';
import { sectors, type SectorKey } from '@/lib/site';
import { getSector, setSector, track, type Sector } from '@/lib/track';

// Scene 5: the visitor says which buyer they are. The choice is kept for the session, can arrive in the
// page address (?sector=public), and sets the proof shown, the form's sector field and the secondary button.
export function SectorDoors() {
  const [chosen, setChosen] = useState<Sector>(null);
  useEffect(() => {
    const sync = () => setChosen(getSector());
    sync();
    window.addEventListener('kt:sector', sync);
    return () => window.removeEventListener('kt:sector', sync);
  }, []);
  const choose = (key: SectorKey) => {
    const next = chosen === key ? null : key;
    setSector(next);
    if (next) track('sector_chosen', { sector: next });
  };
  return (
    <div className="doors" role="group" aria-label="Choose your sector">
      {(Object.keys(sectors) as SectorKey[]).map((key) => (
        <button key={key} type="button" className="door" aria-pressed={chosen === key} onClick={() => choose(key)} data-door={key}>
          <b>{sectors[key].name}</b>
          <span>{sectors[key].text}</span>
          <em>{chosen === key ? 'Selected' : `Choose ${sectors[key].door.toLowerCase()}`}</em>
        </button>
      ))}
    </div>
  );
}
