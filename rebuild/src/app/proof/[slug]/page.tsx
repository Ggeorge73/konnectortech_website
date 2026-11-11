import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProof, getProofRecord } from '@/lib/content';
import { CtaBand, PageHead } from '@/components/Page';
import { RecordCard } from '@/components/Proof';

type Props = { params: Promise<{ slug: string }> };
// A static export needs at least one path; "none" renders the not-found page when no records are published.
export const generateStaticParams = () => { const p = getProof().map((r) => ({ slug: r.slug })); return p.length ? p : [{ slug: 'none' }]; };
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = getProofRecord((await params).slug);
  return r ? { title: r.title, description: r.result, alternates: { canonical: `/proof/${r.slug}/` }, robots: r.draft ? { index: false } : undefined } : {};
}

export default async function ProofRecordPage({ params }: Props) {
  const r = getProofRecord((await params).slug);
  if (!r) notFound();
  return (
    <>
      <PageHead label={`Delivery record · ${r.sector === 'public' ? 'Public sector' : 'Private sector'}`} title={r.title} lede={r.result} />
      <section className="section">
        <div className="wrap split">
          <div className="prose" dangerouslySetInnerHTML={{ __html: r.html }} />
          <aside className="aside"><RecordCard r={r} link={false} /><Link className="arrow-link" href="/proof/">All delivery records</Link></aside>
        </div>
      </section>
      <CtaBand pos={`proof-${r.slug}`} sector={r.sector} />
    </>
  );
}
