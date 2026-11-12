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
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ file: f, ...matter(fs.readFileSync(path.join(dir, f), 'utf8')).data }));
  const records = all.filter((d) => !d.draft);
  // Any draft item at all stops a production build: nothing invented or unfinished can go live.
  for (const d of all.filter((x) => x.draft)) problems.push(`Draft item: content/proof/${d.file} is still marked draft. Replace it with a real record or delete it.`);
  if (records.length < 2) problems.push(`Proof: ${records.length} published delivery record(s). At least two are needed before launch (content/proof/*.md, remove "draft: true" once real).`);
  if (!records.some((r) => r.sector === 'public') || !records.some((r) => r.sector === 'private')) problems.push('Proof: at least one public and one private delivery record are needed.');
  const company = JSON.parse(fs.readFileSync(path.join(root, 'content/company.json'), 'utf8'));
  for (const [group, items] of Object.entries(company)) if (Array.isArray(items)) for (const it of items.filter((x) => x.draft)) problems.push(`Draft item: content/company.json → ${group} → "${it.label || it.name}" is still marked draft. Confirm it or delete it.`);
  const frontier = JSON.parse(fs.readFileSync(path.join(root, 'content/frontier.json'), 'utf8'));
  for (const it of frontier.items.filter((x) => x.draft)) problems.push(`Draft item: content/frontier.json → "${it.company}" is still marked draft. Check the wording against the company's site, confirm it agrees to be named, then remove "draft": true (or delete the entry).`);
  if (!company.credentials.some((c) => !c.draft)) problems.push('Credentials strip: no confirmed certifications, registrations or partner badges (content/company.json).');
  const pdf = process.env.NEXT_PUBLIC_CAPABILITY_STATEMENT_URL;
  if (!pdf) problems.push('Capability statement: set NEXT_PUBLIC_CAPABILITY_STATEMENT_URL to the PDF (for example /konnector-capability-statement.pdf in /public).');
  else if (pdf.startsWith('/') && !fs.existsSync(path.join(root, 'public', pdf))) problems.push(`Capability statement: ${pdf} is set but the file is not in /public.`);
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
