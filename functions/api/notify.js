// Cloudflare Pages Function: POST /api/notify
// Collects "Notify Me" sign-ups. If RESEND_API_KEY and NOTIFY_TO are set (Pages → Settings → Variables and Secrets),
// each sign-up is emailed to NOTIFY_TO; it is always written to the function log (Pages → Functions → Real-time logs).
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let data = {};
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const { email = '', company = '' } = data || {};
  if (company) return json({ ok: true }); // honeypot: silently drop bots
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email' }, 400);
  }

  console.log(`[notify-signup] ${email}`);

  const { RESEND_API_KEY, NOTIFY_TO, NOTIFY_FROM = 'Konnector Tech <onboarding@resend.dev>' } = env;
  if (RESEND_API_KEY && NOTIFY_TO) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: NOTIFY_TO.split(',').map((s) => s.trim()),
        subject: 'New launch sign-up',
        text: `${email} asked to be notified when konnectortech.com launches.`,
      }),
    });
    if (!r.ok) {
      console.error('[notify-signup] Resend failed', r.status, await r.text());
      return json({ error: 'Could not save sign-up' }, 502);
    }
  }
  return json({ ok: true });
}

export const onRequest = () => json({ error: 'Method not allowed' }, 405);
