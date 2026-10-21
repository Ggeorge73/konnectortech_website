// Cloudflare Pages Function: POST /api/contact
// Receives website enquiries. Each enquiry is:
//   1. saved to the ENQUIRIES KV namespace (if bound), so no lead is lost even when email fails;
//   2. emailed to NOTIFY_TO via Resend (if RESEND_API_KEY and NOTIFY_TO are set), with Reply-To set to the sender;
//   3. written to the function log (Pages → Functions → Real-time logs).
// The same KV namespace also limits each visitor to RATE_LIMIT enquiries per RATE_WINDOW seconds.
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const SECTORS = ['Public sector', 'Private sector', 'Not sure yet'];
const RATE_LIMIT = 5;
const RATE_WINDOW = 600; // seconds (KV's minimum TTL is 60)
const DEFAULT_FROM = 'Konnector Tech Website <website@konnectortech.com>';

// Returns true when this visitor has used up their allowance. KV is eventually consistent, so this is a soft
// limit that stops floods, not an exact counter; pair it with a Cloudflare rate-limiting rule (see README).
async function rateLimited(kv, ip) {
  if (!kv || !ip) return false;
  const key = `rl:${ip}`;
  const count = Number(await kv.get(key)) || 0;
  if (count >= RATE_LIMIT) return true;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
  return false;
}

async function sendEmail(env, { name, email, organization, sector, text }) {
  const { RESEND_API_KEY, NOTIFY_TO, NOTIFY_FROM = DEFAULT_FROM } = env;
  if (!RESEND_API_KEY || !NOTIFY_TO) return 'not_configured';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: NOTIFY_TO.split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: email,
      subject: `New enquiry: ${organization || name} (${sector})`,
      text,
    }),
  });
  if (r.ok) return 'sent';
  console.error('[contact] Resend failed', r.status, await r.text());
  return 'failed';
}

export async function onRequestPost({ request, env }) {
  const kv = env.ENQUIRIES;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (await rateLimited(kv, ip)) {
    return json({ error: 'Too many requests' }, 429, { 'Retry-After': String(RATE_WINDOW) });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (!data || typeof data !== 'object') return json({ error: 'Invalid request' }, 400);
  if (data.company_site) return json({ ok: true }); // honeypot: silently drop bots

  const name = clean(data.name, 120);
  const email = clean(data.email, 254);
  const organization = clean(data.organization, 160);
  const message = clean(data.message, 4000);
  const sector = SECTORS.includes(data.sector) ? data.sector : 'Not sure yet';

  if (!name) return json({ error: 'Name is required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);
  if (message.length < 10) return json({ error: 'Message is too short' }, 400);

  const receivedAt = new Date().toISOString();
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Organization: ${organization || '—'}`,
    `Sector: ${sector}`,
    `Received: ${receivedAt}`,
    '',
    message,
  ].join('\n');

  console.log(`[contact] ${name} <${email}> · ${organization || '—'} · ${sector}`);

  let saved = false;
  if (kv) {
    try {
      const record = { receivedAt, name, email, organization, sector, message };
      await kv.put(`enquiry:${receivedAt}:${crypto.randomUUID()}`, JSON.stringify(record));
      saved = true;
    } catch (err) {
      console.error('[contact] KV save failed', err);
    }
  }

  const emailed = await sendEmail(env, { name, email, organization, sector, text });
  if (emailed === 'not_configured') console.log('[contact] email not configured; enquiry body follows\n' + text);

  // Only report failure when the enquiry was neither emailed nor saved, so the visitor knows to email us instead.
  if (emailed !== 'sent' && !saved) return json({ error: 'Could not send enquiry' }, 502);
  return json({ ok: true });
}

export const onRequest = () => json({ error: 'Method not allowed' }, 405);
