// Konnector Tech — site behaviour (no dependencies)
(() => {
  const yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // Theme toggle: dark by default; the visitor's choice is remembered (the <head> script applies it before paint)
  const root = document.documentElement;
  const themeBtn = document.querySelector('.theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.content = theme === 'light' ? '#F4F7FB' : '#070C18';
    if (themeBtn) {
      const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
      themeBtn.setAttribute('aria-label', label);
      themeBtn.title = label;
    }
  };
  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch { /* private mode: choice lasts for this page only */ }
  });

  // Mobile menu
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  if (nav && toggle) {
    const setOpen = (open) => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); } });
  }

  // Reveal sections as they scroll into view
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  // Sector links preselect the sector in the contact form
  document.querySelectorAll('[data-sector]').forEach((a) => a.addEventListener('click', () => {
    const r = document.querySelector(`input[name="sector"][value="${a.dataset.sector}"]`);
    if (r) r.checked = true;
  }));

  // Contact form → /api/contact
  const form = document.getElementById('contact-form');
  const msg = document.getElementById('form-msg');
  if (form && msg) {
    const say = (text, kind) => { msg.textContent = text; msg.className = 'form-msg ' + (kind || ''); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.name = (data.name || '').trim();
      data.email = (data.email || '').trim();
      data.message = (data.message || '').trim();
      if (!data.name) return say('Please add your name.', 'err'), form.elements.namedItem('name').focus();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return say('Please enter a valid email address.', 'err'), form.elements.namedItem('email').focus();
      if (data.message.length < 10) return say('Please tell us a little about the project.', 'err'), form.elements.namedItem('message').focus();

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Sending…'; say('');
      try {
        const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (r.status === 429) return say('You have sent several messages in a short time. Please try again in a few minutes, or email george@konnectortech.com.', 'err');
        if (!r.ok) throw new Error('send failed');
        form.reset();
        say("Thank you — we've received your enquiry and will be in touch shortly.", 'ok');
      } catch {
        say('Something went wrong sending your message. Please email george@konnectortech.com.', 'err');
      } finally {
        btn.disabled = false; btn.textContent = 'Send enquiry';
      }
    });
  }
})();
