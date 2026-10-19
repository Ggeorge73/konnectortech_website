// Cloudflare Pages Function: POST /api/contact
// Receives website enquiries. If RESEND_API_KEY and NOTIFY_TO are set (Pages → Settings → Variables and Secrets),
// each enquiry is emailed to NOTIFY_TO with Reply-To set to the sender. Every enquiry is also written to the
// function log (Pages → Functions → Real-time logs) so nothing is lost if email is not configured yet.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const SECTORS = ['Public sector', 'Private sector', 'Not sure yet'];

export async function onRequestPost({ request, env }) {
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

  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Organization: ${organization || '—'}`,
    `Sector: ${sector}`,
    '',
    message,
  ].join('\n');

  console.log(`[contact] ${name} <${email}> · ${organization || '—'} · ${sector}`);

  const { RESEND_API_KEY, NOTIFY_TO, NOTIFY_FROM = 'Konnector Tech <onboarding@resend.dev>' } = env;
  if (RESEND_API_KEY && NOTIFY_TO) {
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
    if (!r.ok) {
      console.error('[contact] Resend failed', r.status, await r.text());
      return json({ error: 'Could not send enquiry' }, 502);
    }
  } else {
    console.log('[contact] email not configured; enquiry body follows\n' + text);
  }
  return json({ ok: true });
}
