// Collects "Notify Me" sign-ups. If RESEND_API_KEY and NOTIFY_TO are set, each sign-up is
// emailed to NOTIFY_TO; it is always written to the function log (Vercel → Logs) as a fallback.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email = '', company = '' } = req.body || {};
  if (company) return res.status(200).json({ ok: true }); // honeypot: silently drop bots
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  console.log(`[notify-signup] ${email}`);

  const { RESEND_API_KEY, NOTIFY_TO, NOTIFY_FROM = 'Konnector Tech <onboarding@resend.dev>' } = process.env;
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
      return res.status(502).json({ error: 'Could not save sign-up' });
    }
  }
  return res.status(200).json({ ok: true });
}
