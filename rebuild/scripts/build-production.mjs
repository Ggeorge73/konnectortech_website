// `npm run build:production`, the command Cloudflare Pages runs for every deployment.
// Cloudflare runs that same command for branch previews too. Only the main branch is the live site, so any other
// branch builds as a preview: marked noindex, preview helpers kept (?fps=1), and the launch gate skipped (the bot-check
// key is a Production-only setting, so a preview build would otherwise fail). Builds outside Cloudflare stay production.
import { spawnSync } from 'node:child_process';

const branch = process.env.CF_PAGES_BRANCH;
const live = !branch || branch === 'main';
const env = { ...process.env };
if (live) env.SITE_ENV = 'production';
else delete env.SITE_ENV;
console.log(live ? 'Production build.' : `Branch "${branch}" is not main: building a preview instead.`);
const r = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
