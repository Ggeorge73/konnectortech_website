// Unit tests for the form route: validation, spam trap, storage, email, bot check and failure behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, validate } from '../../functions/api/contact.js';

const good = { name: 'Ada Example', email: 'ada@example.org', organization: 'Example County', sector: 'Public sector', message: 'We need a records system delivered by June.', deadline: 'June' };
const kv = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v) }; };
const post = (body, env = {}, ip = '203.0.113.9') => onRequestPost({ request: new Request('https://x/api/contact', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env });
const stubFetch = (t, handler) => { const calls = []; const orig = globalThis.fetch; globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return handler(String(url), init); }; t.after(() => (globalThis.fetch = orig)); return calls; };
const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 });

test('validate: accepts a complete enquiry and trims it', () => {
  const r = validate({ ...good, name: '  Ada Example ' });
  assert.equal(r.value.name, 'Ada Example');
  assert.equal(r.errors, undefined);
});
test('validate: explains each problem in plain words', () => {
  const r = validate({ name: '', email: 'nope', organization: '', message: 'short' });
  assert.deepEqual(Object.keys(r.errors).sort(), ['email', 'message', 'name', 'organization']);
});
test('validate: unknown sector falls back, extra fields are dropped', () => {
  const r = validate({ ...good, sector: 'Other', extra: 'x' });
  assert.equal(r.value.sector, 'Not sure yet');
  assert.equal('extra' in r.value, false);
});
test('rejects invalid JSON and invalid fields with 400', async () => {
  assert.equal((await post('not json')).status, 400);
  const r = await post({ ...good, email: 'bad' });
  assert.equal(r.status, 400);
  assert.ok((await r.json()).fields.email);
});
test('stores the lead, notifies Konnector and confirms to the visitor', async (t) => {
  const calls = stubFetch(t, ok);
  const store = kv();
  const r = await post(good, { ENQUIRIES: store, RESEND_API_KEY: 'k', NOTIFY_TO: 'team@example.com' });
  assert.equal(r.status, 200);
  const saved = [...store.m.keys()].filter((k) => k.startsWith('enquiry:'));
  assert.equal(saved.length, 1);
  assert.equal(JSON.parse(store.m.get(saved[0])).deadline, 'June');
  const mails = calls.filter((c) => c.url.includes('resend.com')).map((c) => JSON.parse(c.init.body));
  assert.equal(mails.length, 2);
  assert.deepEqual(mails[0].to, ['team@example.com']);
  assert.equal(mails[0].reply_to, 'ada@example.org');
  assert.deepEqual(mails[1].to, ['ada@example.org']);
  assert.match(mails[1].text, /one business day/);
});
test('spam trap: stored as suspect, never emailed', async (t) => {
  const calls = stubFetch(t, ok);
  const store = kv();
  const r = await post({ ...good, kt_hp: 'http://spam' }, { ENQUIRIES: store, RESEND_API_KEY: 'k', NOTIFY_TO: 'team@example.com' });
  assert.equal(r.status, 200);
  assert.equal([...store.m.keys()].filter((k) => k.startsWith('suspect:')).length, 1);
  assert.equal(calls.length, 0);
});
test('reports failure only when the enquiry was neither stored nor emailed', async (t) => {
  stubFetch(t, () => new Response('down', { status: 500 }));
  assert.equal((await post(good, { RESEND_API_KEY: 'k', NOTIFY_TO: 'team@example.com' })).status, 502);
  assert.equal((await post(good, { ENQUIRIES: kv(), RESEND_API_KEY: 'k', NOTIFY_TO: 'team@example.com' })).status, 200);
});
test('bot check: rejects a missing or failed token when the secret is set', async (t) => {
  stubFetch(t, (url) => (url.includes('siteverify') ? new Response(JSON.stringify({ success: false })) : ok()));
  assert.equal((await post(good, { ENQUIRIES: kv(), TURNSTILE_SECRET_KEY: 's' })).status, 403);
  assert.equal((await post({ ...good, turnstileToken: 'bad' }, { ENQUIRIES: kv(), TURNSTILE_SECRET_KEY: 's' })).status, 403);
});
test('rate limit: the sixth enquiry in the window gets 429', async () => {
  const env = { ENQUIRIES: kv() };
  for (let i = 0; i < 5; i++) assert.equal((await post(good, env, '198.51.100.7')).status, 200);
  assert.equal((await post(good, env, '198.51.100.7')).status, 429);
});
test('lead push: signed webhook carries the Signal stage', async (t) => {
  const calls = stubFetch(t, ok);
  await post(good, { ENQUIRIES: kv(), LEAD_WEBHOOK_URL: 'https://crm.example/hook', LEAD_WEBHOOK_SECRET: 'shh' });
  const hook = calls.find((c) => c.url === 'https://crm.example/hook');
  assert.ok(hook);
  assert.match(hook.init.headers['X-Konnector-Signature'], /^sha256=[0-9a-f]{64}$/);
  assert.equal(JSON.parse(hook.init.body).stage, 'signal');
});
