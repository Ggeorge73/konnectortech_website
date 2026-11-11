import Link from 'next/link';
import { callHref, site, statementHref, statementLabel, callLabel } from '@/lib/site';
import { ScannerRing } from './Mark';

// Supporting pages use the blueprint style: a wireframe header, ring motifs and the cyan line.
// They carry no heavy 3D, only a small still of the sphere.
export function PageHead({ label, title, lede, children }: { label: string; title: string; lede?: string; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div className="wrap">
        <div>
          <p className="hud"><b>{label}</b></p>
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
          {children}
        </div>
        <div className="orb" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stills/sphere.jpg" alt="" width={440} height={440} />
          <ScannerRing />
        </div>
      </div>
    </header>
  );
}

export function CtaBand({ pos, sector }: { pos: string; sector?: 'public' | 'private' }) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="cta-band">
          <div>
            <h2>Have a project that has to land?</h2>
            <p>Tell us what you need delivered. We will come back with a plan. {site.replyPromise}</p>
          </div>
          <div className="ctas" style={{ marginTop: 0 }}>
            <Link className="btn btn-primary" href="/contact/" data-cta="plan" data-pos={pos}>{site.cta.main}</Link>
            {sector === 'public' ? (
              <a className="btn btn-ghost" href={statementHref} data-cta="statement" data-pos={pos}>{statementLabel}</a>
            ) : (
              <a className="btn btn-ghost" href={callHref} data-cta="call" data-pos={pos}>{callLabel}</a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
