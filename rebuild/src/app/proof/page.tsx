import type { Metadata } from 'next';
import { credentials, getProof } from '@/lib/content';
import { CtaBand, PageHead } from '@/components/Page';
import { CredStrip, DraftNote, RecordCard } from '@/components/Proof';

export const metadata: Metadata = {
  title: 'Proof',
  description: 'Delivery records from Konnector Tech: the client type, the gap, what was connected and the accepted result.',
  alternates: { canonical: '/proof/' },
};

export default function Proof() {
  const proof = getProof();
  return (
    <>
      <PageHead label="Proof" title="Delivered, not promised." lede="Each delivery record states the client type, the gap, what we connected and the result." />
      <section className="section">
        <div className="wrap">
          {proof.length ? <div className="records" style={{ marginTop: 0 }}>{proof.map((r) => <RecordCard key={r.slug} r={r} />)}</div> : <p className="lede">Ask us for delivery records that match your project. We share them on request.</p>}
          <CredStrip items={credentials} />
          <DraftNote show={proof.some((p) => p.draft) || credentials.some((c) => c.draft)}>Preview only: these are layout samples awaiting real content from Konnector. They are left out of the production build.</DraftNote>
        </div>
      </section>
      <CtaBand pos="proof" />
    </>
  );
}
