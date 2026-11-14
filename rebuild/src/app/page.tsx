import type { Metadata } from 'next';
import Link from 'next/link';
import { callHref, heroHeadline, promises, sectors, show, site, stages, statementHref, statementLabel, callLabel, statementAttrs } from '@/lib/site';
import { credentials, frontier, getProof, getServices } from '@/lib/content';
import { FRONTIER_DISCLAIMER, FrontierCard } from '@/components/Frontier';
import { ACCEPTED_AT, GATE_AT, SERVICE_AT } from '@/story/timeline';
import { GapCards } from '@/components/GapCards';
import { StoryShell } from '@/components/StoryShell';
import { SectorDoors } from '@/components/SectorDoors';
import { EnquiryForm } from '@/components/EnquiryForm';
import { ModeSwitch } from '@/components/ModeSwitch';
import { CredStrip, DraftNote, RecordCard } from '@/components/Proof';
import { Mark } from '@/components/Mark';

export const metadata: Metadata = {
  title: { absolute: `${site.name} | One accountable partner for technology delivery` },
  description: site.description,
  alternates: { canonical: '/' },
};

// One still per scene: shown in brief mode and reused for share previews.
function Still({ n, alt, eager, children }: { n: number; alt: string; eager?: boolean; children?: React.ReactNode }) {
  return (
    <figure className="still">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/stills/scene-${n}.jpg`} alt={alt} width={1200} height={900} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" />
      {children}
    </figure>
  );
}
const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
);

export default function Home() {
  const services = getServices();
  const proof = getProof();
  const hasDraft = proof.some((p) => p.draft) || credentials.some((c) => c.draft);
  // Scene 6 shows delivery records and credentials. While both are switched off (see `show` in lib/site.ts),
  // the frontier section takes scene 6's place in the story, so there is no empty section and the 3D still rests there.
  const proofScene = proof.length > 0 || credentials.length > 0 || !frontier.length;

  return (
    <>
      <StoryShell />

      {/* Scene 1: Arrival (the hook) */}
      <section className="scene scene--pinned" data-scene="1" id="top" aria-labelledby="s1-title">
        <div className="scene-pin">
          <div className="wrap scene-grid">
            <div className="panel">
              <p className="hud"><b>Technology delivered. End2End</b></p>
              <h1 id="s1-title">{heroHeadline}</h1>
              <p className="lede">{site.hero.support}</p>
              <div className="ctas">
                <a className="btn btn-primary" href="#contact" data-cta="plan" data-pos="hero">{site.cta.main} <Arrow /></a>
                <a className="btn btn-ghost" href="#scan" data-cta="see-how" data-pos="hero">See how it connects</a>
                <ModeSwitch pos="hero" />
              </div>
            </div>
            <Still n={1} eager alt="A chrome sphere hovering in a dim equipment corridor lined with server racks." />
          </div>
        </div>
      </section>

      {/* Scene 2: The scan (the problem) */}
      <section className="scene scene--pinned" data-scene="2" id="scan" aria-labelledby="s2-title">
        <div className="scene-pin">
          <div className="wrap scene-grid">
            <div className="panel">
              <p className="hud">Scene 02 · <b>The scan</b></p>
              <h2 id="s2-title">Most projects do not fail in the systems. They fail in the gaps between them.</h2>
              <GapCards />
              <p style={{ margin: '16px 0 0' }}><a className="arrow-link" href="#services" data-cta="see-fix" data-pos="scene-2">See who closes the gaps</a></p>
            </div>
            <Still n={2} alt="The corridor drawn as a blueprint: five systems in silver outline, joined by dashed amber links with three visible gaps.">
              {/* Brief mode: the three gaps marked on the still. The cards beside it highlight one. */}
              {[0, 1, 2].map((i) => <span key={i} className="gap-pin" data-pin={i} aria-hidden="true">0{i + 1}</span>)}
            </Still>
          </div>
        </div>
      </section>

      {/* Scene 3: The line (the promise and the services) */}
      <section className="scene scene--pinned" data-scene="3" id="services" aria-labelledby="s3-title">
        <div className="scene-pin">
          <div className="wrap scene-grid">
            <div className="panel">
              <p className="hud">Scene 03 · <b>The line</b></p>
              <h2 id="s3-title">One accountable partner. One unbroken line.</h2>
              <p className="lede">We take ownership of the whole delivery, so you manage one partner instead of many vendors.</p>
              <ul className="service-list" data-stack>
                {services.map((s, i) => (
                  <li key={s.slug} data-at={SERVICE_AT[i]}>
                    <Link href={`/services/${s.slug}/`} data-cta="service" data-pos={s.slug}>
                      {s.core ? <small>Core service</small> : null}
                      <b>{s.short}</b>
                      <span>{s.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Still n={3} alt="One solid cyan line runs through all five systems, replacing the broken amber links." />
          </div>
        </div>
      </section>

      {/* Scene 4: The run (the method and the three promises) */}
      <section className="scene scene--pinned" data-scene="4" id="how" aria-labelledby="s4-title">
        <div className="scene-pin">
          <div className="wrap scene-grid">
            <div className="panel">
              <p className="hud">Scene 04 · <b>The run</b></p>
              <h2 id="s4-title">Real projects bend. Ours still arrive.</h2>
              <ol className="gate-list">
                {stages.map((st, i) => (
                  <li key={st.n} data-gate={i} data-lock-at={GATE_AT[i]}>
                    <span className="ring" aria-hidden="true"><i>0{st.n}</i></span>
                    <div><b>{st.name}</b><span>{st.line}</span></div>
                  </li>
                ))}
              </ol>
              <ul className="dials" aria-label="Our three promises">
                {promises.map((p) => (
                  <li key={p.key} className="dial" data-dial={p.key} data-accept-at={p.key === 'accepted' ? ACCEPTED_AT : undefined}>
                    <svg viewBox="0 0 40 40" aria-hidden="true"><circle className="bg" cx="20" cy="20" r="15.9" /><circle className="fg" cx="20" cy="20" r="15.9" pathLength="100" /></svg>
                    <div><b>{p.name}</b><span>{p.line}</span></div>
                  </li>
                ))}
              </ul>
              <p style={{ margin: '14px 0 0' }}><Link className="arrow-link" href="/how-we-deliver/" data-cta="how" data-pos="scene-4">What you receive at each stage</Link></p>
            </div>
            <Still n={4} alt="The line runs into the distance like a track through five ring gates, bending around an amber block and carrying on." />
          </div>
        </div>
      </section>

      {/* Scene 5: Two doors (who it is for) */}
      <section className="scene scene--pinned" data-scene="5" id="sectors" aria-labelledby="s5-title">
        <div className="scene-pin">
          <div className="wrap scene-grid">
            <div className="panel">
              <p className="hud">Scene 05 · <b>Two doors</b></p>
              <h2 id="s5-title">Public mission or private enterprise?</h2>
              <SectorDoors />
              <div className="ctas">
                <a className="btn btn-primary" href="#contact" data-cta="plan" data-pos="scene-5">{site.cta.main}</a>
                {show.capabilityStatement ? (
                  <>
                    <a className="btn btn-ghost" href={statementHref} {...statementAttrs} data-for="public" data-cta="statement" data-pos="scene-5">{statementLabel}</a>
                    <a className="btn btn-ghost" href={callHref} data-for="private" data-cta="call" data-pos="scene-5">{callLabel}</a>
                  </>
                ) : (
                  <a className="btn btn-ghost" href={callHref} data-cta="call" data-pos="scene-5">{callLabel}</a>
                )}
              </div>
              <p className="muted" style={{ margin: '14px 0 0', fontSize: '0.92rem' }}>
                <Link href={sectors.public.href} data-for="public" style={{ display: 'block', padding: '4px 0' }}>More for public sector buyers</Link>
                <Link href={sectors.private.href} data-for="private" style={{ display: 'block', padding: '4px 0' }}>More for private sector teams</Link>
              </p>
            </div>
            <Still n={5} alt="The line splits in two before a blueprint skyline: a city hall, school and courthouse on the left, office towers and a plant on the right." />
          </div>
        </div>
      </section>

      {/* Frontier technology: an ordinary section between scenes 5 and 6. It leads scene 6, so the 3D rests from here on. */}
      {frontier.length ? (
        <section className="frontier" id="frontier" {...(proofScene ? { 'data-scene-lead': '6' } : { 'data-scene': '6' })} aria-labelledby="frontier-title">
          <div className="wrap">
            <p className="hud">Frontier technology</p>
            <h2 id="frontier-title">Frontier technology, landed.</h2>
            <p className="lede">
              Breakthrough technology only matters once it works inside your environment. We do not invent these devices. We close the gaps
              between the maker&apos;s device and your systems, security, compliance, people and rollout: the same gaps every project fails in.
            </p>
            <div className="frontier-grid">{frontier.map((f) => <FrontierCard key={f.key} item={f} pos="home" />)}</div>
            <p className="frontier-note">{FRONTIER_DISCLAIMER}</p>
            <DraftNote show={frontier.some((f) => f.draft)}>
              Preview only: these three cards wait on two things from Konnector. The wording must be checked against each company&apos;s site, and each
              company must agree to be named. Until then they are stamped as drafts and are left out of the production build.
            </DraftNote>
            <div className="ctas">
              <a className="btn btn-primary" href="#contact" data-cta="plan" data-pos="frontier">{site.cta.main}</a>
            </div>
          </div>
        </section>
      ) : null}

      {/* Scene 6: Proof (the evidence). Normal scrolling; the 3D rests here. */}
      {proofScene ? (
      <section className="scene scene--proof" data-scene="6" id="proof" aria-labelledby="s6-title">
        <div className="wrap">
          <p className="hud">Scene 06 · <b>Proof</b></p>
          <h2 id="s6-title">Delivered, not promised.</h2>
          {proof.length ? (
            <div className="records">{proof.map((r) => <RecordCard key={r.slug} r={r} />)}</div>
          ) : (
            <p className="lede">Ask us for delivery records that match your project. We share them on request.</p>
          )}
          <CredStrip items={credentials} />
          <DraftNote show={hasDraft}>
            Preview only: the records and credentials above are layout samples awaiting real content from Konnector. They are stamped as drafts and are left out of the production build.
          </DraftNote>
          <div className="ctas">
            <a className="btn btn-primary" href="#contact" data-cta="plan" data-pos="scene-6">{site.cta.main}</a>
            {proof.length ? <Link className="arrow-link" href="/proof/" data-cta="proof" data-pos="scene-6">All delivery records</Link> : null}
          </div>
        </div>
      </section>
      ) : null}

      {/* Scene 7: The transformation (logo reveal and the ask) */}
      <section className="scene scene--pinned scene--finale" data-scene="7" id="about" aria-labelledby="s7-title">
        <div className="scene-pin">
          <div className="wrap">
            <div className="panel finale-copy">
              <Mark className="mark-still" strokeWidth={3.5} />
              <p className="hud">Scene 07 · <b>Our mark</b></p>
              <h2 id="s7-title">Every line reaches its point.</h2>
              <p className="lede">Have a project that has to land? Tell us what you need delivered. We will come back with a plan.</p>
              <div className="ctas" style={{ justifyContent: 'center' }}>
                <a className="btn btn-primary" href="#contact" data-cta="plan" data-pos="scene-7">{site.cta.main}</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="scene--form" aria-labelledby="contact-title">
        <div className="wrap">
          <div className="form-frame" id="contact">
            <h2 id="contact-title">Get a delivery plan</h2>
            <p className="lede" style={{ marginBottom: 24 }}>Tell us what you need delivered. We will come back with a plan.</p>
            <EnquiryForm pos="home" />
          </div>
          <div className="other-asks">
            <a className="btn btn-ghost" href={callHref} data-cta="call" data-pos="scene-7">{callLabel}</a>
            <a className="btn btn-ghost" href={`mailto:${site.email}`} data-cta="email" data-pos="scene-7">Email {site.email}</a>
          </div>
        </div>
      </section>
    </>
  );
}
