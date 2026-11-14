import type { Metadata } from 'next';
import Link from 'next/link';
import { frontier, getServices } from '@/lib/content';
import { FRONTIER_DISCLAIMER, FrontierCard } from '@/components/Frontier';
import { callHref, promises, sectors, site, callLabel } from '@/lib/site';
import { CtaBand, PageHead } from '@/components/Page';

export const metadata: Metadata = {
  title: 'Private sector',
  description: 'For small, mid-size and large organizations, up to enterprise scale, running technology programs that have to land: one accountable partner from first plan to accepted handover.',
  alternates: { canonical: '/private-sector/' },
};

export default function PrivateSector() {
  const services = getServices();
  return (
    <>
      <PageHead label="Private sector" title="Technology programs that have to land." lede={sectors.private.text}>
        <div className="ctas">
          <Link className="btn btn-primary" href="/contact/?sector=private" data-cta="plan" data-pos="private-head">{site.cta.main}</Link>
          <a className="btn btn-ghost" href={callHref} data-cta="call" data-pos="private-head">{callLabel}</a>
        </div>
      </PageHead>
      <section className="section" aria-labelledby="outcomes-title">
        <div className="wrap">
          <h2 id="outcomes-title">The outcomes you can hold us to</h2>
          <div className="cols" style={{ marginTop: 24 }}>
            {promises.map((p) => <div key={p.key} className="card"><h3>{p.name}</h3><p className="muted">{p.line}</p></div>)}
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="engage-title">
        <div className="wrap">
          <h2 id="engage-title">Ways of engaging</h2>
          <p className="lede">Start where your project is today. Every route runs on the same delivery method and has one accountable partner.</p>
          <div className="cols" style={{ marginTop: 24 }}>
            {services.map((s) => (
              <Link key={s.slug} className="card" href={`/services/${s.slug}/`}>
                <h3>{s.short}</h3>
                <p className="muted">{s.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {frontier.length ? (
        <section className="section" aria-labelledby="frontier-title">
          <div className="wrap">
            <h2 id="frontier-title">Frontier technology, landed</h2>
            <p className="lede">New technology only helps once it works inside your environment: your systems, security rules, compliance and people. We integrate it; we do not invent it.</p>
            <div className="frontier-grid">{frontier.map((f) => <FrontierCard key={f.key} item={f} pos="private-sector" compact side="private" />)}</div>
            <p className="frontier-note">{FRONTIER_DISCLAIMER}</p>
          </div>
        </section>
      ) : null}
      <CtaBand pos="private-sector" sector="private" />
    </>
  );
}
