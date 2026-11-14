import type { Metadata } from 'next';
import { people } from '@/lib/content';
import { site } from '@/lib/site';
import { CtaBand, PageHead } from '@/components/Page';
import { DraftNote } from '@/components/Proof';
import { Mark } from '@/components/Mark';

export const metadata: Metadata = {
  title: 'About',
  description: 'Konnector Tech is a technology integration and delivery partner based in Atlanta, Georgia. The people, the story of the mark and where to find us.',
  alternates: { canonical: '/about/' },
};

export default function About() {
  return (
    <>
      <PageHead label="About" title="We own the gaps where projects fail." lede="Konnector Tech is the technology integration and delivery partner that owns the gaps between systems, vendors and teams, from first plan to accepted handover." />
      <section className="section">
        <div className="wrap prose">
          <h2 style={{ marginTop: 0 }}>Why “Konnector”</h2>
          <p>Most technology projects have good parts: a capable vendor, a sound system, a willing team. They fail at the joins, where no one is responsible.</p>
          <p>A connector is the piece that makes separate parts work as one. That is our name, and it is our job. You manage one accountable partner, and we connect the systems, vendors and people behind your project so they work together from day one.</p>
        </div>
      </section>
      <section className="section" aria-labelledby="mark-title">
        <div className="wrap split" style={{ alignItems: 'center' }}>
          <div className="prose">
            <p className="hud"><b>Our mark</b></p>
            <h2 id="mark-title" style={{ marginTop: 0, fontSize: 'clamp(1.6rem, 3.4vw, 2.4rem)' }}>Every line reaches its point.</h2>
            <p>The Konnector mark is three points joined into one unbroken triangle. Each line runs from end to end. Some run straight, like the plan. Some bend, like the real world, with its turns and surprises. Every one still reaches its point.</p>
            <p>That is how we work: we take ownership from first plan to final handover, connect the people and technology in between, and deliver, end to end.</p>
          </div>
          <Mark strokeWidth={3.5} style={{ width: '100%', maxWidth: 300, justifySelf: 'center' }} />
        </div>
      </section>
      {people.length ? (
        <section className="section" aria-labelledby="people-title">
          <div className="wrap">
            <h2 id="people-title">The people</h2>
            <div className="cols" style={{ marginTop: 24 }}>
              {people.map((p) => (
                <div key={p.name} className="card">
                  {p.draft ? <span className="stamp draft">Draft</span> : null}
                  <h3 style={{ marginTop: p.draft ? 12 : 0 }}>{p.name}</h3>
                  <p className="hud">{p.role}</p>
                  <p className="muted">{p.bio}</p>
                </div>
              ))}
            </div>
            <DraftNote show={people.some((p) => p.draft)}>Preview only: photos and short profiles of the principals are supplied by Konnector. Draft profiles are left out of the production build.</DraftNote>
          </div>
        </section>
      ) : null}
      <section className="section" aria-labelledby="where-title">
        <div className="wrap prose">
          <h2 id="where-title" style={{ marginTop: 0 }}>Where we are</h2>
          <p>{site.legalName} is based in {site.location}, and works with public and private sector organizations.</p>
          <p>Email <a href={`mailto:${site.email}`}>{site.email}</a>.</p>
        </div>
      </section>
      <CtaBand pos="about" />
    </>
  );
}
