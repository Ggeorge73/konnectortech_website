import type { Metadata } from 'next';
import { promises, stages } from '@/lib/site';
import { CtaBand, PageHead } from '@/components/Page';

export const metadata: Metadata = {
  title: 'How we deliver',
  description: 'Five stages from first plan to accepted handover: Discover, Plan, Build and integrate, Test and accept, Hand over. See what you receive at each.',
  alternates: { canonical: '/how-we-deliver/' },
};

// What the client receives at each stage, in the order the stages run.
const receives: Record<number, string[]> = {
  1: ['Your goals and constraints, written down and agreed', 'Acceptance criteria: what “done” will mean for this project'],
  2: ['An agreed scope, schedule and budget', 'A team, and one accountable partner'],
  3: ['Systems configured and connected', 'A plan that adapts as reality changes, with the milestones held'],
  4: ['Test results against the criteria you agreed at the start', 'Your formal acceptance, based on evidence'],
  5: ['A working system', 'Trained people', 'A clean close, with nothing left half-done'],
};

export default function HowWeDeliver() {
  return (
    <>
      <PageHead label="How we deliver" title="Real projects bend. Ours still arrive." lede="Every stage hands cleanly to the next, and we stay accountable the whole way. One unbroken line, from first plan to accepted handover." />
      <section className="section">
        <div className="wrap split">
          <div>
            <h2>Five stages, and what you receive at each</h2>
            <ol className="line-steps" style={{ marginTop: 28 }}>
              {stages.map((s) => (
                <li key={s.n} data-n={`0${s.n}`} className="card">
                  <p className="hud">Stage 0{s.n}</p>
                  <h3 style={{ fontSize: '1.3rem' }}>{s.name}</h3>
                  <p className="muted">{s.line}</p>
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>You receive</p>
                  <ul style={{ paddingLeft: '1.2em', display: 'grid', gap: 4 }}>{receives[s.n].map((r) => <li key={r}>{r}</li>)}</ul>
                </li>
              ))}
            </ol>
          </div>
          <aside className="aside" aria-labelledby="promises-title">
            <h2 id="promises-title" style={{ fontSize: '1.3rem' }}>Three promises, kept the whole way</h2>
            {promises.map((p) => (
              <div key={p.key} className="card">
                <h3 style={p.key === 'accepted' ? { color: 'var(--green)' } : undefined}>{p.name}</h3>
                <p className="muted" style={{ fontSize: '0.95rem' }}>{p.line}</p>
              </div>
            ))}
          </aside>
        </div>
      </section>
      <section className="section">
        <div className="wrap prose">
          <h2 style={{ marginTop: 0 }}>When the plan meets a surprise</h2>
          <p>No plan survives a real project untouched. A vendor ships late, a requirement changes, a legacy system holds data nobody expected.</p>
          <p>The plan adapts when reality changes, and the milestones hold. The acceptance criteria stay where you agreed them.</p>
          <h2>“Done” means accepted</h2>
          <p>We agree what “accepted” means in stage one, before any work starts. In stage four we test against exactly those criteria. A project is finished when you have accepted it, and not before.</p>
        </div>
      </section>
      <CtaBand pos="how-we-deliver" />
    </>
  );
}
