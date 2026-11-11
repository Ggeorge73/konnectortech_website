// One place for the site's names, links and home-page copy.
// Copy comes from the rebuild script and the current live site. Change wording here, not in components.

export const IS_PRODUCTION = process.env.SITE_ENV === 'production';

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
  // A calendar booking link for the 30-minute call (e.g. Microsoft Bookings or Calendly).
  bookingUrl: (process.env.NEXT_PUBLIC_BOOKING_URL || null) as string | null,
  // Path or URL of the capability statement PDF (e.g. '/konnector-capability-statement.pdf' placed in /public).
  capabilityStatementUrl: (process.env.NEXT_PUBLIC_CAPABILITY_STATEMENT_URL || null) as string | null,
  // Reply promise shown under the form. The script recommends one business day, if the team can always keep it.
  replyPromise: 'We reply within one business day.',
  replyPromiseShort: 'one business day',
} as const;

export const heroHeadline = process.env.NEXT_PUBLIC_HERO === 'B' ? site.hero.B : site.hero.A;

export const callHref = site.bookingUrl ?? '/contact/?ask=call';
export const statementHref = site.capabilityStatementUrl ?? '/contact/?ask=statement';
export const statementLabel = site.capabilityStatementUrl ? site.cta.statement : 'Request capability statement';

export const scenes = [
  { n: 1, id: 'top', name: 'Arrival', asks: 'Who is this?' },
  { n: 2, id: 'scan', name: 'The scan', asks: 'What is my problem?' },
  { n: 3, id: 'services', name: 'The line', asks: 'Who can fix it?' },
  { n: 4, id: 'how', name: 'The run', asks: 'How do they work?' },
  { n: 5, id: 'sectors', name: 'Two doors', asks: 'Is it for me?' },
  { n: 6, id: 'proof', name: 'Proof', asks: 'Can I trust them?' },
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
    text: 'Mid-size and enterprise teams running technology programs that have to land, whatever the industry.',
    href: '/private-sector/',
  },
} as const;
export type SectorKey = keyof typeof sectors;

export const nav = [
  { label: 'Services', href: '/services/' },
  { label: 'How we deliver', href: '/how-we-deliver/' },
  { label: 'Sectors', href: '/#sectors' },
  { label: 'Proof', href: '/proof/' },
  { label: 'About', href: '/about/' },
] as const;

export const markStory =
  'Three points joined into one unbroken triangle. Some lines run straight, like the plan. Some bend, like the real world, with its turns and surprises. Every one still arrives. That is how we work: we take ownership from first plan to final handover, connect the people and technology in between, and deliver, end to end.';
