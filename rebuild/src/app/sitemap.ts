import type { MetadataRoute } from 'next';
import { getProof, getServices } from '@/lib/content';
import { show, site } from '@/lib/site';

export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/services/', ...getServices().map((s) => `/services/${s.slug}/`), '/how-we-deliver/', '/public-sector/', '/private-sector/', ...(show.proof ? ['/proof/'] : []), ...getProof().filter((p) => !p.draft).map((p) => `/proof/${p.slug}/`), '/about/', '/contact/', '/privacy/'];
  return paths.map((p) => ({ url: `${site.url}${p}`, changeFrequency: 'monthly', priority: p === '/' ? 1 : 0.7 }));
}
