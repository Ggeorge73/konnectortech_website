import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { IS_PRODUCTION, site } from '@/lib/site';
import { bootScript } from '@/lib/boot';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Analytics } from '@/components/Analytics';
import { getServices } from '@/lib/content';

// Sora for headings, Manrope for body (both already the brand faces), JetBrains Mono for HUD labels only.
// Fonts are self-hosted, so no request leaves the site and the headline paints fast.
const sora = localFont({ src: '../../node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2', variable: '--font-sora', weight: '400 800', display: 'swap' });
const manrope = localFont({ src: '../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', variable: '--font-manrope', weight: '400 800', display: 'swap' });
const mono = localFont({ src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', variable: '--font-mono-jb', weight: '400 700', display: 'swap', preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { type: 'website', siteName: site.name, images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'A chrome sphere inside a blueprint of connected systems' }] },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.svg' },
  robots: IS_PRODUCTION ? undefined : { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#070C18', colorScheme: 'dark' };

const PLAUSIBLE = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Structured data for the organization and its services.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    email: site.email,
    slogan: site.tagline,
    description: site.description,
    logo: `${site.url}/favicon.svg`,
    image: `${site.url}/og.jpg`,
    address: { '@type': 'PostalAddress', addressLocality: 'Atlanta', addressRegion: 'GA', addressCountry: 'US' },
    areaServed: 'US',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: getServices().map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.title, description: s.summary, url: `${site.url}/services/${s.slug}/` } })),
    },
  };
  return (
    <html lang="en" className={`${sora.variable} ${manrope.variable} ${mono.variable}`} data-mode="brief" data-tier="brief" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {PLAUSIBLE ? <script defer data-domain={PLAUSIBLE} src="https://plausible.io/js/script.js" /> : null}
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {IS_PRODUCTION ? null : <p className="preview-banner" role="note">Preview build · not indexed</p>}
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
