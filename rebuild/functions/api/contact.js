// Cloudflare Pages Function: POST /api/contact
// The only thing the site sends to a server is an enquiry. For each one this route:
//   1. applies a rate limit per visitor (ENQUIRIES KV namespace);
//   2. validates the fields (only the fields the form shows are accepted);
//   3. runs the invisible bot check (Cloudflare Turnstile, when TURNSTILE_SECRET_KEY is set);
//   4. stores the lead in the ENQUIRIES KV namespace, so no enquiry is lost if email fails;
//   5. emails Konnector (NOTIFY_TO) with Reply-To set to the visitor, and sends the visitor a confirmation (Resend);
//   6. pushes the lead to LEAD_WEBHOOK_URL when set (for Konnector CRM, once it has an inbound-lead interface).
// Submissions that fill the hidden spam trap are stored under a "suspect:" key and are not emailed.
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const SECTORS = ['Public sector', 'Private sector', 'Not sure yet'];
const RATE_LIMIT = 5;
const RATE_WINDOW = 600; // seconds (KV's minimum TTL is 60)
const DEFAULT_FROM = 'Konnector Tech Website <website@konnectortech.com>';
const REPLY_PROMISE = 'one business day'; // confirmed by the owner, 14 Nov 2026

/** Schema validation. Returns { value } or { errors } keyed by field, in plain words. */
export function validate(data) {
  const value = {
    name: clean(data.name, 120),
    email: clean(data.email, 254),
    organization: clean(data.organization, 160),
    sector: SECTORS.includes(data.sector) ? data.sector : 'Not sure yet',
    message: clean(data.message, 4000),
    deadline: clean(data.deadline, 120),
  };
  const errors = {};
  if (!value.name) errors.name = 'Please add your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = 'Please enter a valid email address.';
  if (!value.organization) errors.organization = 'Please add your organization.';
  if (value.message.length < 10) errors.message = 'Please tell us a little about what you need delivered.';
  return Object.keys(errors).length ? { errors } : { value };
}

// KV is eventually consistent, so this is a soft limit that stops floods, not an exact counter.
// Pair it with a Cloudflare rate-limiting rule on /api/contact (see README).
async function rateLimited(kv, ip) {
  if (!kv || !ip) return false;
  const key = `rl:${ip}`;
  const count = Number(await kv.get(key)) || 0;
  if (count >= RATE_LIMIT) return true;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
  return false;
}

async function botCheck(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured (preview): the spam trap and rate limit still apply
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return Boolean((await r.json()).success);
  } catch (err) {
    console.error('[contact] bot check failed to run', err);
    return true; // never lose a real enquiry because the check itself is down
  }
}

async function email(env, message) {
  const { RESEND_API_KEY, NOTIFY_FROM = DEFAULT_FROM } = env;
  if (!RESEND_API_KEY) return 'not_configured';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: NOTIFY_FROM, ...message }),
    });
    if (r.ok) return 'sent';
    console.error('[contact] Resend failed', r.status, await r.text());
  } catch (err) {
    console.error('[contact] Resend error', err);
  }
  return 'failed';
}

async function pushLead(env, lead) {
  if (!env.LEAD_WEBHOOK_URL) return;
  try {
    const body = JSON.stringify({ event: 'website.enquiry', stage: 'signal', source: 'inbound', lead });
    const headers = { 'Content-Type': 'application/json' };
    if (env.LEAD_WEBHOOK_SECRET) {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.LEAD_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
      headers['X-Konnector-Signature'] = 'sha256=' + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    const r = await fetch(env.LEAD_WEBHOOK_URL, { method: 'POST', headers, body });
    if (!r.ok) console.error('[contact] lead push failed', r.status);
  } catch (err) {
    console.error('[contact] lead push error', err); // the lead is already stored and emailed
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  const kv = env.ENQUIRIES;
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (await rateLimited(kv, ip)) return json({ error: 'Too many requests' }, 429, { 'Retry-After': String(RATE_WINDOW) });

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (!data || typeof data !== 'object') return json({ error: 'Invalid request' }, 400);

  const checked = validate(data);
  if (checked.errors) return json({ error: 'Please check the form', fields: checked.errors }, 400);
  const lead = { ...checked.value, receivedAt: new Date().toISOString(), page: clean(data.page, 200) };

  const suspect = Boolean(clean(data.kt_hp, 200)); // spam trap: real visitors never see this field
  if (!suspect && !(await botCheck(env, clean(data.turnstileToken, 4096), ip))) return json({ error: 'Could not verify the request' }, 403);

  console.log(`[contact]${suspect ? ' [suspect]' : ''} ${lead.name} <${lead.email}> · ${lead.organization} · ${lead.sector}`);

  let saved = false;
  if (kv) {
    try {
      await kv.put(`${suspect ? 'suspect' : 'enquiry'}:${lead.receivedAt}:${crypto.randomUUID()}`, JSON.stringify(lead));
      saved = true;
    } catch (err) {
      console.error('[contact] KV save failed', err);
    }
  }
  if (suspect) return json({ ok: true }); // likely a bot: stored for review (if KV is bound), not emailed

  const text = [`Name: ${lead.name}`, `Email: ${lead.email}`, `Organization: ${lead.organization}`, `Sector: ${lead.sector}`, `Needs to land: ${lead.deadline || '—'}`, `Received: ${lead.receivedAt}`, `Page: ${lead.page || '—'}`, '', lead.message].join('\n');
  let notified = 'not_configured';
  if (env.NOTIFY_TO) {
    notified = await email(env, { to: env.NOTIFY_TO.split(',').map((s) => s.trim()).filter(Boolean), reply_to: lead.email, subject: `New enquiry: ${lead.organization} (${lead.sector})`, text });
  }
  if (notified === 'not_configured') console.log('[contact] email not configured; enquiry body follows\n' + text);

  // Only report failure when the enquiry was neither emailed nor stored, so the visitor knows to email instead.
  if (notified !== 'sent' && !saved) return json({ error: 'Could not send enquiry' }, 502);

  // After the lead is safe: confirm to the visitor and push to the CRM. Neither can fail the request.
  const after = Promise.allSettled([
    email(env, {
      to: [lead.email],
      reply_to: env.CONFIRM_REPLY_TO || 'george@konnectortech.com',
      subject: 'We have your enquiry | Konnector Tech',
      text: `Hello ${lead.name.split(/\s+/)[0]},\n\nThank you for telling us what you need delivered. Your enquiry is with our delivery team, and we will reply within ${REPLY_PROMISE}.\n\nIf anything changes before then, reply to this email.\n\nKonnector Tech\nTechnology delivered. End2End\nhttps://www.konnectortech.com\n\nWhat you sent us:\n${lead.message}`,
    }),
    pushLead(env, lead),
  ]);
  if (typeof waitUntil === 'function') waitUntil(after);
  else await after;

  return json({ ok: true });
}

export const onRequest = () => json({ error: 'Method not allowed' }, 405);
