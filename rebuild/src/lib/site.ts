// One place for the site's names, links and home-page copy.
// Copy comes from the rebuild script and the current live site. Change wording here, not in components.

export const IS_PRODUCTION = process.env.SITE_ENV === 'production';

// ── Sections switched off until Konnector has the content (owner decision, 14 Nov 2026). ──
// Each one is a light switch: while it is off, the section, its nav and footer links, its buttons and its
// launch checks all disappear together, so no empty section or dead link is left behind.
// To bring one back, set its variable to 1 in the build settings (or flip the default here) and rebuild.
const on = (v: string | undefined) => v === '1' || v === 'true';
export const show = {
  // Delivery records: home scene 6 records, the /proof/ pages, nav and footer links.
  proof: on(process.env.NEXT_PUBLIC_SHOW_PROOF),
  // Credentials strip, plus the procurement facts table (registrations, NAICS codes, contract routes).
  credentials: on(process.env.NEXT_PUBLIC_SHOW_CREDENTIALS),
  // "Download / Request capability statement" buttons everywhere.
  capabilityStatement: on(process.env.NEXT_PUBLIC_SHOW_CAPABILITY_STATEMENT),
  // "The people" profiles on the About page.
  people: on(process.env.NEXT_PUBLIC_SHOW_PEOPLE),
} as const;

export const site = {
  name: 'Konnector Tech',
  legalName: 'Konnector LLC',
  url: 'https://www.konnectortech.com',
  email: 'george@konnectortech.com',
  location: 'Atlanta, Georgia',
  tagline: 'Technology delivered. End2End',
  description:
    'Konnector Tech connects the systems, vendors and teams behind critical technology projects, and stays accountable from first plan to final handover.',

  // Hero headline: A and B are to be tested against each other after launch. Set NEXT_PUBLIC_HERO=B to switch.
  hero: {
    A: 'Every system you own, finally working as one.',
    B: 'Projects fail in the gaps between systems. We own the gaps.',
    support:
      'Konnector Tech connects the systems, vendors and teams behind critical technology projects, and stays accountable from first plan to final handover. On time, on budget, to the acceptance criteria you set.',
  },

  cta: {
    main: 'Get a delivery plan',
    call: 'Book a 30-minute call',
    statement: 'Download capability statement',
  },

  // ── Items Konnector supplies. While one is null the site falls back to the enquiry form, so no button is dead. ──
  // A calendar booking link for the 30-minute call (e.g. Microsoft Bookings or Calendly). Not used at launch:
  // every "Book a call" button opens the contact form (owner decision, 14 Nov 2026). Set it later to switch.
  bookingUrl: (process.env.NEXT_PUBLIC_BOOKING_URL || null) as string | null,
  // Path or URL of the capability statement PDF (e.g. '/konnector-capability-statement.pdf' placed in /public).
  capabilityStatementUrl: (process.env.NEXT_PUBLIC_CAPABILITY_STATEMENT_URL || null) as string | null,
  // Reply promise shown under the form and in the confirmation email. Confirmed by the owner on 14 Nov 2026.
  replyPromise: 'We reply within one business day.',
  replyPromiseShort: 'one business day',
} as const;

export const heroHeadline = process.env.NEXT_PUBLIC_HERO === 'B' ? site.hero.B : site.hero.A;

export const callHref = site.bookingUrl ?? '/contact/?ask=call';
// Without a booking link, "Book a 30-minute call" opens the contact form, which asks for times and confirms the call.
export const callLabel = site.cta.call;
export const statementHref = site.capabilityStatementUrl ?? '/contact/?ask=statement';
// With the PDF set, the button is a real download. Until then it is a request that opens the form.
export const statementAttrs = site.capabilityStatementUrl ? { download: true } : {};
export const statementLabel = site.capabilityStatementUrl ? site.cta.statement : 'Request capability statement';

export const scenes = [
  { n: 1, id: 'top', name: 'Arrival', asks: 'Who is this?' },
  { n: 2, id: 'scan', name: 'The scan', asks: 'What is my problem?' },
  { n: 3, id: 'services', name: 'The line', asks: 'Who can fix it?' },
  { n: 4, id: 'how', name: 'The run', asks: 'How do they work?' },
  { n: 5, id: 'sectors', name: 'Two doors', asks: 'Is it for me?' },
  // While delivery records and credentials are switched off, the frontier section takes scene 6's place.
  show.proof || show.credentials
    ? { n: 6, id: 'proof', name: 'Proof', asks: 'Can I trust them?' }
    : { n: 6, id: 'frontier', name: 'Frontier tech', asks: 'Can they land what is new?' },
  { n: 7, id: 'about', name: 'Transformation', asks: 'What do I do next?' },
] as const;

export const systems = ['Finance', 'Records', 'Operations', 'Legacy system', 'Vendor platform'] as const;

export const gaps = [
  { key: 'vendor', title: 'Vendor to vendor', text: 'no one owns the handoff.' },
  { key: 'plan', title: 'Plan to reality', text: 'the schedule did not expect the surprise.' },
  { key: 'build', title: 'Build to sign-off', text: '‘done’ was never defined.' },
] as const;

export const stages = [
  { n: 1, name: 'Discover', line: 'Goals, constraints and what “accepted” means.' },
  { n: 2, name: 'Plan', line: 'Scope, schedule, budget and team, agreed up front.' },
  { n: 3, name: 'Build and integrate', line: 'Configure, connect and adapt as reality changes.' },
  { n: 4, name: 'Test and accept', line: 'Proven against the criteria you agreed.' },
  { n: 5, name: 'Hand over', line: 'Working system, trained people, clean close.' },
] as const;

export const promises = [
  {
    key: 'time',
    name: 'On time',
    line: 'A plan everyone agrees up front, and delivery leadership that keeps every milestone honest.',
  },
  {
    key: 'budget',
    name: 'On budget',
    line: 'Flexible expert capacity that scales with the work, without the cost of permanent headcount.',
  },
  {
    key: 'accepted',
    name: 'Accepted',
    line: 'We test against what you agreed, so “done” means the system works the way you need it to.',
  },
] as const;

export const sectors = {
  public: {
    key: 'public',
    name: 'Public sector',
    door: 'Public mission',
    text: 'State agencies, cities, counties, schools and public authorities modernizing the systems people rely on.',
    href: '/public-sector/',
  },
  private: {
    key: 'private',
    name: 'Private sector',
    door: 'Private enterprise',
    text: 'Small, mid-size and large organizations, up to enterprise scale, running technology programs that have to land, whatever the industry.',
    href: '/private-sector/',
  },
} as const;
export type SectorKey = keyof typeof sectors;

export const nav = [
  { label: 'Services', href: '/services/' },
  { label: 'How we deliver', href: '/how-we-deliver/' },
  { label: 'Sectors', href: '/#sectors' },
  ...(show.proof ? [{ label: 'Proof', href: '/proof/' }] : []),
  { label: 'About', href: '/about/' },
];

export const markStory =
  'Three points joined into one unbroken triangle. Some lines run straight, like the plan. Some bend, like the real world, with its turns and surprises. Every one still arrives. That is how we work: we take ownership from first plan to final handover, connect the people and technology in between, and deliver, end to end.';
