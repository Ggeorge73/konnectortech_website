// Runs before every build.
//  - Preview builds: nothing to check.
//  - Production builds (SITE_ENV=production): the launch gate. The build fails while anything the rebuild
//    script forbids at launch is still true: fewer than two real delivery records, no public + private record,
//    missing capability statement or booking link. Draft items never reach a production build.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const production = process.env.SITE_ENV === 'production';
const root = process.cwd();
const problems = [];

if (production) {
  const dir = path.join(root, 'content/proof');
  const records = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => matter(fs.readFileSync(path.join(dir, f), 'utf8')).data).filter((d) => !d.draft);
  if (records.length < 2) problems.push(`Proof: ${records.length} published delivery record(s). At least two are needed before launch (content/proof/*.md, remove "draft: true" once real).`);
  if (!records.some((r) => r.sector === 'public') || !records.some((r) => r.sector === 'private')) problems.push('Proof: at least one public and one private delivery record are needed.');
  const company = JSON.parse(fs.readFileSync(path.join(root, 'content/company.json'), 'utf8'));
  if (!company.credentials.some((c) => !c.draft)) problems.push('Credentials strip: no confirmed certifications, registrations or partner badges (content/company.json).');
  if (!process.env.NEXT_PUBLIC_CAPABILITY_STATEMENT_URL) problems.push('Capability statement: set NEXT_PUBLIC_CAPABILITY_STATEMENT_URL to the PDF (for example /konnector-capability-statement.pdf in /public).');
  if (!process.env.NEXT_PUBLIC_BOOKING_URL) problems.push('Booking link: set NEXT_PUBLIC_BOOKING_URL to the calendar booking page for the 30-minute call.');
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) problems.push('Bot check: set NEXT_PUBLIC_TURNSTILE_SITE_KEY (and TURNSTILE_SECRET_KEY on the server).');
}

if (problems.length) {
  console.error('\nLaunch check failed. The site is not ready for a production build:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('\nPreview builds (npm run build) are not affected.\n');
  process.exit(1);
}
console.log(production ? 'Launch check passed.' : 'Preview build: draft content is stamped, and the site is marked noindex.');
