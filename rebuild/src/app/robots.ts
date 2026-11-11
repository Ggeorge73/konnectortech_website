import type { MetadataRoute } from 'next';
import { IS_PRODUCTION, site } from '@/lib/site';

export const dynamic = 'force-static';
// Preview builds are never indexed; only the production build opens the site to search engines.
export default function robots(): MetadataRoute.Robots {
  return IS_PRODUCTION ? { rules: { userAgent: '*', allow: '/' }, sitemap: `${site.url}/sitemap.xml` } : { rules: { userAgent: '*', disallow: '/' } };
}
