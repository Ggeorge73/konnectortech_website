// Runs before every build.
//  - Preview builds: nothing to check.
//  - Production builds (SITE_ENV=production): the launch gate. The build fails while anything the rebuild
//    script forbids at launch is still true, for every section that is switched on: fewer than two real delivery
//    records, no public + private record, a missing capability statement, or no bot-check key.
//    Draft items never reach a production build.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const production = process.env.SITE_ENV === 'production';
const root = process.cwd();
const problems = [];

// Sections switched off until Konnector has the content (see `show` in src/lib/site.ts). A switched-off section
// is left out of every build, so its launch checks are skipped too. Turn one back on with its variable set to 1.
const on = (v) => v === '1' || v === 'true';
const show = {
  proof: on(process.env.NEXT_PUBLIC_SHOW_PROOF),
  credentials: on(process.env.NEXT_PUBLIC_SHOW_CREDENTIALS),
  capabilityStatement: on(process.env.NEXT_PUBLIC_SHOW_CAPABILITY_STATEMENT),
  people: on(process.env.NEXT_PUBLIC_SHOW_PEOPLE),
};

if (production) {
  const company = JSON.parse(fs.readFileSync(path.join(root, 'content/company.json'), 'utf8'));
  if (show.proof) {
    const dir = path.join(root, 'content/proof');
    const all = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ file: f, ...matter(fs.readFileSync(path.join(dir, f), 'utf8')).data }));
    const records = all.filter((d) => !d.draft);
    // Any draft item at all stops a production build: nothing invented or unfinished can go live.
    for (const d of all.filter((x) => x.draft)) problems.push(`Draft item: content/proof/${d.file} is still marked draft. Replace it with a real record or delete it.`);
    if (records.length < 2) problems.push(`Proof: ${records.length} published delivery record(s). At least two are needed before launch (content/proof/*.md, remove "draft: true" once real).`);
    if (!records.some((r) => r.sector === 'public') || !records.some((r) => r.sector === 'private')) problems.push('Proof: at least one public and one private delivery record are needed.');
  }
  const groups = [...(show.credentials ? ['credentials', 'registrations', 'naicsCodes', 'contractRoutes'] : []), ...(show.people ? ['people'] : [])];
  for (const group of groups) for (const it of (company[group] || []).filter((x) => x.draft)) problems.push(`Draft item: content/company.json → ${group} → "${it.label || it.name}" is still marked draft. Confirm it or delete it.`);
  if (show.credentials && !company.credentials.some((c) => !c.draft)) problems.push('Credentials strip: no confirmed certifications, registrations or partner badges (content/company.json).');
  const frontier = JSON.parse(fs.readFileSync(path.join(root, 'content/frontier.json'), 'utf8'));
  for (const it of frontier.items.filter((x) => x.draft)) problems.push(`Draft item: content/frontier.json → "${it.company}" is still marked draft. Check the wording against the company's site, confirm it agrees to be named, then remove "draft": true (or delete the entry).`);
  if (show.capabilityStatement) {
    const pdf = process.env.NEXT_PUBLIC_CAPABILITY_STATEMENT_URL;
    if (!pdf) problems.push('Capability statement: set NEXT_PUBLIC_CAPABILITY_STATEMENT_URL to the PDF (for example /konnector-capability-statement.pdf in /public).');
    else if (pdf.startsWith('/') && !fs.existsSync(path.join(root, 'public', pdf))) problems.push(`Capability statement: ${pdf} is set but the file is not in /public.`);
  }
  // Booking link: optional. Without it, every "Book a 30-minute call" button opens the contact form (owner decision, 14 Nov 2026).
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) problems.push('Bot check: set NEXT_PUBLIC_TURNSTILE_SITE_KEY (and TURNSTILE_SECRET_KEY on the server).');
}

if (problems.length) {
  console.error('\nLaunch check failed. The site is not ready for a production build:\n');
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('\nPreview builds (npm run build) are not affected.\n');
  process.exit(1);
}
console.log(production ? 'Launch check passed.' : 'Preview build: draft content is stamped, and the site is marked noindex.');
