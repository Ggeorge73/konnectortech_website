import type { Metadata } from 'next';
import Link from 'next/link';
import { getServices } from '@/lib/content';
import { CtaBand, PageHead } from '@/components/Page';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Project and program delivery, systems implementation and integration, flexible expert staffing and technology sourcing, from one accountable partner.',
  alternates: { canonical: '/services/' },
};

export default function Services() {
  const services = getServices();
  return (
    <>
      <PageHead label="Services" title="One accountable partner. One unbroken line." lede="Connection is the idea behind all four services. We take ownership of the whole delivery, so you manage one partner instead of many vendors." />
      <section className="section">
        <div className="wrap cols">
          {services.map((s) => (
            <Link key={s.slug} className="card" href={`/services/${s.slug}/`} data-cta="service" data-pos="services-index">
              {s.core ? <p className="hud"><b>Core service</b></p> : <p className="hud">Part of delivery</p>}
              <h2 style={{ fontSize: '1.3rem' }}>{s.title}</h2>
              <p className="muted">{s.summary}</p>
              <ul className="pills">{s.covers.map((c) => <li key={c}>{c}</li>)}</ul>
            </Link>
          ))}
        </div>
      </section>
      <CtaBand pos="services" />
    </>
  );
}
