import Link from 'next/link';
import { callHref, site, statementHref, statementLabel, callLabel, statementAttrs } from '@/lib/site';
import { getServices } from '@/lib/content';
import { ModeSwitch } from './ModeSwitch';

export function Footer() {
  const services = getServices();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="cols-f">
          <div>
            <p style={{ font: '700 1.1rem var(--font-head)', margin: '0 0 6px' }}>{site.name}</p>
            <p className="muted" style={{ margin: 0 }}>{site.tagline}</p>
            <p style={{ marginTop: 14 }}>
              <Link className="btn btn-primary btn-sm" href="/#contact" data-cta="plan" data-pos="footer">{site.cta.main}</Link>
            </p>
          </div>
          <nav aria-label="Services">
            <h2>Services</h2>
            <ul>{services.map((s) => <li key={s.slug}><Link href={`/services/${s.slug}/`}>{s.short}</Link></li>)}</ul>
          </nav>
          <nav aria-label="Company">
            <h2>Company</h2>
            <ul>
              <li><Link href="/how-we-deliver/">How we deliver</Link></li>
              <li><Link href="/public-sector/">Public sector</Link></li>
              <li><Link href="/private-sector/">Private sector</Link></li>
              <li><Link href="/proof/">Proof</Link></li>
              <li><Link href="/about/">About</Link></li>
            </ul>
          </nav>
          <nav aria-label="Get in touch">
            <h2>Get in touch</h2>
            <ul>
              <li><Link href="/contact/">Contact</Link></li>
              <li><a href={callHref} data-cta="call" data-pos="footer">{callLabel}</a></li>
              <li><a href={statementHref} {...statementAttrs} data-cta="statement" data-pos="footer">{statementLabel}</a></li>
              <li><a href={`mailto:${site.email}`}>{site.email}</a></li>
              <li><ModeSwitch pos="footer" /></li>
            </ul>
          </nav>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} {site.legalName} · {site.location}</span>
          <span><Link href="/privacy/">Privacy notice</Link></span>
        </div>
      </div>
    </footer>
  );
}
