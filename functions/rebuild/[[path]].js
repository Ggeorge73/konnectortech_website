// Cloudflare Pages Function: every address under /rebuild/ answers "404 Not found".
// While this project still serves the repository root (the old site), the new site's source files sit in
// rebuild/ and would otherwise be downloadable from the live domain, e.g. /rebuild/package.json.
// Functions run before static files, so nothing in that folder is ever served from here.
// Once the project's root directory is set to `rebuild` (see rebuild/README.md, "Going live"), this file is
// outside the deployed folder and has no effect.
export const onRequest = () =>
  new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
