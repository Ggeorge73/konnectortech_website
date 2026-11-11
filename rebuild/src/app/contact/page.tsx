import type { Metadata } from 'next';
import { callHref, site, statementHref, statementLabel, callLabel, statementAttrs } from '@/lib/site';
import { PageHead } from '@/components/Page';
import { EnquiryForm } from '@/components/EnquiryForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Tell us what you need delivered and we will come back with a plan. Or book a 30-minute call, or email us.',
  alternates: { canonical: '/contact/' },
};

export default function Contact() {
  return (
    <>
      <PageHead label="Contact" title="Have a project that has to land?" lede={`Tell us what you need delivered. We will come back with a plan. ${site.replyPromise}`} />
      <section className="section">
        <div className="wrap split">
          <div className="form-frame" style={{ margin: 0, maxWidth: 'none' }} id="contact">
            <h2 style={{ fontSize: '1.4rem' }}>Get a delivery plan</h2>
            <EnquiryForm pos="contact" />
          </div>
          <aside className="aside" aria-label="Other ways to reach us">
            <div className="card"><h3>Prefer to talk first?</h3><p className="muted">Thirty minutes, no preparation needed.</p><a className="btn btn-ghost" href={callHref} data-cta="call" data-pos="contact">{callLabel}</a></div>
            <div className="card"><h3>Shortlisting suppliers?</h3><p className="muted">For buyers who need a supplier summary on file.</p><a className="btn btn-ghost" href={statementHref} {...statementAttrs} data-cta="statement" data-pos="contact">{statementLabel}</a></div>
            <div className="card"><h3>Email</h3><p style={{ margin: 0 }}><a href={`mailto:${site.email}`}>{site.email}</a></p><p className="muted" style={{ margin: '8px 0 0' }}>{site.legalName} · {site.location}</p></div>
          </aside>
        </div>
      </section>
    </>
  );
}
