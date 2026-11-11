import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getService, getServices } from '@/lib/content';
import { site } from '@/lib/site';
import { CtaBand, PageHead } from '@/components/Page';

type Props = { params: Promise<{ slug: string }> };
export const generateStaticParams = () => getServices().map((s) => ({ slug: s.slug }));
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getService((await params).slug);
  return s ? { title: s.title, description: s.description, alternates: { canonical: `/services/${s.slug}/` } } : {};
}

export default async function ServicePage({ params }: Props) {
  const s = getService((await params).slug);
  if (!s) notFound();
  const others = getServices().filter((o) => o.slug !== s.slug);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Service', name: s.title, description: s.description, url: `${site.url}/services/${s.slug}/`, provider: { '@type': 'ProfessionalService', name: site.name, url: site.url }, areaServed: 'US' };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHead label={s.core ? 'Core service' : 'Service'} title={s.title} lede={s.summary}>
        <ul className="pills">{s.covers.map((c) => <li key={c}>{c}</li>)}</ul>
      </PageHead>
      <section className="section">
        <div className="wrap split">
          <div className="prose" dangerouslySetInnerHTML={{ __html: s.html }} />
          <aside className="aside" aria-label="Other services">
            <p className="hud">On the same line</p>
            {others.map((o) => (
              <Link key={o.slug} className="card" href={`/services/${o.slug}/`}>
                <h3>{o.short}</h3>
                <p className="muted" style={{ fontSize: '0.93rem' }}>{o.summary}</p>
              </Link>
            ))}
          </aside>
        </div>
      </section>
      <CtaBand pos={`service-${s.slug}`} />
    </>
  );
}
