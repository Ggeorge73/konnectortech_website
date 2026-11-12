import type { Metadata } from 'next';
import { contractRoutes, frontier, naicsCodes, registrations } from '@/lib/content';
import { FRONTIER_DISCLAIMER, FrontierCard } from '@/components/Frontier';
import { sectors, site, statementHref, statementLabel, statementAttrs } from '@/lib/site';
import { CtaBand, PageHead } from '@/components/Page';
import { DraftNote } from '@/components/Proof';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Public sector',
  description: 'Technology delivery for state agencies, cities, counties, schools and public authorities: one accountable partner, on time, on budget, to agreed acceptance criteria.',
  alternates: { canonical: '/public-sector/' },
};

export default function PublicSector() {
  const facts = [...registrations, ...naicsCodes, ...contractRoutes];
  return (
    <>
      <PageHead label="Public sector" title="One accountable partner for public sector delivery." lede={sectors.public.text}>
        <div className="ctas">
          <Link className="btn btn-primary" href="/contact/?sector=public" data-cta="plan" data-pos="public-head">{site.cta.main}</Link>
          <a className="btn btn-ghost" href={statementHref} {...statementAttrs} data-cta="statement" data-pos="public-head">{statementLabel}</a>
        </div>
      </PageHead>
      <section className="section">
        <div className="wrap cols">
          <div className="card"><h2 style={{ fontSize: '1.2rem' }}>A choice you can justify</h2><p className="muted">Public buyers must show why they chose a supplier. We agree acceptance criteria at the start and test against them at the end, so the record shows what was promised and what was delivered.</p></div>
          <div className="card"><h2 style={{ fontSize: '1.2rem' }}>One partner, not many vendors</h2><p className="muted">When several vendors share a project, the gaps between them belong to no one. We take ownership of the whole delivery, including the handoffs.</p></div>
          <div className="card"><h2 style={{ fontSize: '1.2rem' }}>Capacity without permanent headcount</h2><p className="muted">Skilled consultants join your team for the stages that need them and step back after handover.</p></div>
        </div>
      </section>
      {facts.length ? (
        <section className="section" aria-labelledby="facts-title">
          <div className="wrap">
            <h2 id="facts-title">Procurement facts</h2>
            <p className="lede">Company data for buyers and contracting officers.</p>
            <table className="facts" style={{ marginTop: 20, maxWidth: 820 }}>
              <tbody>
                <tr><th scope="row">Legal entity</th><td>{site.legalName}, {site.location}</td></tr>
                {facts.map((f) => (
                  <tr key={f.label}><th scope="row">{f.label}</th><td>{f.value} {f.draft ? <span className="stamp draft">Draft</span> : null}</td></tr>
                ))}
                <tr><th scope="row">Contact</th><td><a href={`mailto:${site.email}`}>{site.email}</a></td></tr>
              </tbody>
            </table>
            <DraftNote show={facts.some((f) => f.draft)}>Preview only: registrations, codes and contract routes are awaiting confirmed values from Konnector. Draft rows are left out of the production build, so only what is current is ever listed.</DraftNote>
          </div>
        </section>
      ) : null}
      {frontier.some((f) => f.sector === 'public') ? (
        <section className="section" aria-labelledby="frontier-title">
          <div className="wrap">
            <h2 id="frontier-title">Frontier technology, landed</h2>
            <p className="lede">New detection technology only helps once it works inside your environment. We integrate it; we do not invent it.</p>
            <div className="frontier-grid">{frontier.filter((f) => f.sector === 'public').map((f) => <FrontierCard key={f.key} item={f} pos="public-sector" compact />)}</div>
            <p className="frontier-note">{FRONTIER_DISCLAIMER}</p>
          </div>
        </section>
      ) : null}
      <CtaBand pos="public-sector" sector="public" />
    </>
  );
}
