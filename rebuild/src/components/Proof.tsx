import Link from 'next/link';
import type { Fact, ProofRecord } from '@/lib/content';

export function RecordCard({ r, link = true }: { r: ProofRecord; link?: boolean }) {
  const body = (
    <>
      <div className="stamp-row">
        <span className="stamp">{r.sector === 'public' ? 'Public sector' : 'Private sector'}</span>
        {r.individualExperience ? <span className="stamp">Individual experience</span> : null}
        {r.draft ? <span className="stamp draft">Draft · sample layout</span> : null}
      </div>
      <h3>{r.title}</h3>
      <dl>
        <div><dt>Client</dt><dd>{r.clientType}</dd></div>
        <div><dt>The gap</dt><dd>{r.gap}</dd></div>
        <div><dt>What we connected</dt><dd>{r.connected}</dd></div>
        <div><dt>Result</dt><dd>{r.result}</dd></div>
      </dl>
      <p className="num" style={{ margin: 'auto 0 0' }}>{r.number}<small>{r.numberLabel}</small></p>
    </>
  );
  return link ? (
    <Link className="record" href={`/proof/${r.slug}/`} data-for={r.sector} data-cta="record" data-pos={r.slug} aria-label={`${r.title}: read the full delivery record`}>{body}</Link>
  ) : (
    <article className="record">{body}</article>
  );
}

export function CredStrip({ items }: { items: Fact[] }) {
  if (!items.length) return null;
  return (
    <ul className="cred-strip" aria-label="Credentials">
      {items.map((c, i) => (
        <li key={i} className={c.draft ? 'draft' : undefined}><small>{c.label}</small>{c.value}{c.draft ? <span className="stamp draft">Draft</span> : null}</li>
      ))}
    </ul>
  );
}

export function DraftNote({ show, children }: { show: boolean; children: React.ReactNode }) {
  return show ? <p className="draft-note" role="note">{children}</p> : null;
}
