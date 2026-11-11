'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { callHref, site, statementHref, statementLabel } from '@/lib/site';
import { getSector, track } from '@/lib/track';

const SECTORS = ['Public sector', 'Private sector', 'Not sure yet'] as const;
type Values = { name: string; email: string; organization: string; sector: string; message: string; deadline: string; kt_hp: string };
const EMPTY: Values = { name: '', email: '', organization: '', sector: 'Not sure yet', message: '', deadline: '', kt_hp: '' };
const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Plain-word checks, shown beside each field as it is completed.
const checks: Partial<Record<keyof Values, (v: string) => string>> = {
  name: (v) => (v.trim() ? '' : 'Please add your name.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter a work email address, like name@organization.com.'),
  organization: (v) => (v.trim() ? '' : 'Please add your organization.'),
  message: (v) => (v.trim().length >= 10 ? '' : 'Please tell us a little about what you need delivered.'),
};

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

export function EnquiryForm({ pos }: { pos: string }) {
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failure, setFailure] = useState('');
  const [ask, setAsk] = useState<string | null>(null);
  const started = useRef(false);
  const sectorTouched = useRef(false);
  const token = useRef('');
  const widget = useRef<HTMLDivElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const id = (k: string) => `${pos}-${k}`;

  // The sector field follows the scene 5 choice until the visitor changes it here.
  useEffect(() => {
    const sync = () => {
      if (sectorTouched.current) return;
      const s = getSector();
      setV((cur) => ({ ...cur, sector: s === 'public' ? 'Public sector' : s === 'private' ? 'Private sector' : 'Not sure yet' }));
    };
    sync();
    window.addEventListener('kt:sector', sync);
    const a = new URLSearchParams(window.location.search).get('ask');
    if (a === 'call' || a === 'statement') {
      setAsk(a);
      setV((cur) => (cur.message ? cur : { ...cur, message: a === 'call' ? 'I would like to book a 30-minute call. Good times for me are: ' : 'Please send me your capability statement.' }));
    }
    return () => window.removeEventListener('kt:sector', sync);
  }, []);

  useEffect(() => {
    if (state === 'sent') sentHeading.current?.focus();
  }, [state]);

  const onStart = () => {
    if (started.current) return;
    started.current = true;
    track('form_started', { position: pos });
    // Invisible bot check (Cloudflare Turnstile): loaded only when someone starts the form. No puzzle is shown.
    if (TURNSTILE_KEY && !document.getElementById('cf-turnstile-js')) {
      const s = document.createElement('script');
      s.id = 'cf-turnstile-js';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => {
        if (widget.current && window.turnstile) {
          window.turnstile.render(widget.current, { sitekey: TURNSTILE_KEY, appearance: 'interaction-only', callback: (t: string) => (token.current = t), 'expired-callback': () => (token.current = '') });
        }
      };
      document.head.appendChild(s);
    }
  };

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setV((cur) => ({ ...cur, [k]: value }));
    if (errors[k]) setErrors((cur) => ({ ...cur, [k]: checks[k]?.(value) || '' }));
  };
  // Check a field once it has been completed. An untouched empty field is only flagged on sending.
  const blur = (k: keyof Values) => () => { if (v[k].trim()) setErrors((cur) => ({ ...cur, [k]: checks[k]?.(v[k]) || '' })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Partial<Record<keyof Values, string>> = {};
    (Object.keys(checks) as (keyof Values)[]).forEach((k) => {
      const msg = checks[k]!(v[k]);
      if (msg) found[k] = msg;
    });
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(id(first))?.focus();
      return;
    }
    setState('sending');
    setFailure('');
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, turnstileToken: token.current, page: window.location.pathname }),
      });
      if (r.status === 429) throw new Error('You have sent several messages in a short time. Please try again in a few minutes');
      if (!r.ok) throw new Error('We could not send your message');
      track('form_sent', { position: pos, sector: v.sector });
      setState('sent');
    } catch (err) {
      // Keep everything the visitor typed, and say what to do next in plain words.
      const base = err instanceof Error && !/fetch|network/i.test(err.message) ? err.message : 'We could not send your message';
      setFailure(`${base}. Nothing you typed has been lost. Please try again, or email ${site.email}.`);
      setState('idle');
      try { window.turnstile?.reset(); } catch { /* optional */ }
    }
  };

  if (state === 'sent') {
    return (
      <div className="sent" data-testid="form-sent">
        <p className="hud"><b>Enquiry received</b></p>
        <h3 ref={sentHeading} tabIndex={-1}>Thank you, {v.name.trim().split(/\s+/)[0]}. Your enquiry is with us.</h3>
        <p>Here is what happens next:</p>
        <ol>
          <li>Your enquiry goes straight to our delivery team.</li>
          <li>We reply to <strong>{v.email.trim()}</strong> within {site.replyPromiseShort}.</li>
          <li>If we need more detail to shape your plan, we will ask in that reply.</li>
        </ol>
        <div className="ctas">
          <a className="btn btn-ghost" href={callHref} data-cta="call" data-pos={`${pos}-confirmation`}>{site.cta.call}</a>
          <a className="btn btn-ghost" href={statementHref} data-cta="statement" data-pos={`${pos}-confirmation`}>{statementLabel}</a>
        </div>
      </div>
    );
  }

  const field = (k: 'name' | 'email' | 'organization', label: string, extra: React.InputHTMLAttributes<HTMLInputElement>, full = false) => (
    <div className={full ? 'field full' : 'field'}>
      <label htmlFor={id(k)}>{label}</label>
      <input id={id(k)} name={k} value={v[k]} onChange={set(k)} onBlur={blur(k)} required aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? id(`${k}-err`) : undefined} {...extra} />
      <p className="err" id={id(`${k}-err`)}>{errors[k]}</p>
    </div>
  );

  return (
    <form className="form" onSubmit={submit} onFocus={onStart} noValidate data-testid="enquiry-form">
      {ask ? (
        <p className="field full muted" style={{ margin: 0 }}>
          {ask === 'call' ? 'Tell us a few times that suit you and we will confirm a 30-minute call.' : 'Tell us where to send the capability statement.'}
        </p>
      ) : null}
      {field('name', 'Your name', { autoComplete: 'name', maxLength: 120 })}
      {field('email', 'Work email', { type: 'email', autoComplete: 'email', maxLength: 254, inputMode: 'email' })}
      {field('organization', 'Organization', { autoComplete: 'organization', maxLength: 160 }, true)}
      <fieldset className="field full">
        <legend>Sector</legend>
        <div className="seg">
          {SECTORS.map((s) => (
            <label key={s}>
              <input type="radio" name={`${pos}-sector`} value={s} checked={v.sector === s} onChange={() => { sectorTouched.current = true; setV((cur) => ({ ...cur, sector: s })); }} />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field full">
        <label htmlFor={id('message')}>What do you need delivered?</label>
        <textarea id={id('message')} name="message" value={v.message} onChange={set('message')} onBlur={blur('message')} required maxLength={4000} aria-invalid={errors.message ? true : undefined} aria-describedby={errors.message ? id('message-err') : id('message-hint')} />
        {errors.message ? <p className="err" id={id('message-err')}>{errors.message}</p> : <p className="muted" id={id('message-hint')} style={{ margin: 0, fontSize: '0.88rem' }}>A few lines on the project and where it stands today.</p>}
      </div>
      <div className="field full">
        <label htmlFor={id('deadline')}>When does it need to land? <span className="opt">(optional)</span></label>
        <input id={id('deadline')} name="deadline" value={v.deadline} onChange={set('deadline')} maxLength={120} />
      </div>
      {/* Hidden spam trap. Real visitors never see or fill this field. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={id('kt')}>Leave this field empty</label>
        <input id={id('kt')} name="kt_hp" tabIndex={-1} autoComplete="off" value={v.kt_hp} onChange={set('kt_hp')} />
      </div>
      <div ref={widget} className="field full" style={{ display: 'contents' }} />
      <p className="form-msg" role="alert">{failure}</p>
      <div className="form-foot">
        <button className="btn btn-primary" type="submit" disabled={state === 'sending'} data-cta="send" data-pos={pos}>
          {state === 'sending' ? 'Sending…' : 'Send and get my plan'}
        </button>
        <p>
          {site.replyPromise} Or email <a href={`mailto:${site.email}`}>{site.email}</a>. <Link href="/privacy/">Privacy notice</Link>
        </p>
      </div>
    </form>
  );
}
