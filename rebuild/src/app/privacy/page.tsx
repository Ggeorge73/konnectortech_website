import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { PageHead } from '@/components/Page';

export const metadata: Metadata = { title: 'Privacy notice', description: 'What the Konnector Tech website collects when you send an enquiry, and how it is used.', alternates: { canonical: '/privacy/' } };

export default function Privacy() {
  return (
    <>
      <PageHead label="Privacy notice" title="What we collect and why." />
      <section className="section">
        <div className="wrap prose">
          <h2 style={{ marginTop: 0 }}>When you send an enquiry</h2>
          <p>The enquiry form collects only what you type into it: your name, work email, organization, sector, what you need delivered and, if you choose to give it, when it needs to land.</p>
          <p>We use this to reply to you and to prepare a delivery plan. The enquiry is stored so it cannot be lost, sent to our team by email, and may be recorded in our customer relationship system as a new enquiry. The site sends you one confirmation email.</p>
          <h2>What the site does not do</h2>
          <ul>
            <li>It carries no advertising trackers.</li>
            <li>It asks for nothing beyond the fields listed above.</li>
          </ul>
          <h2>Site measurement</h2>
          <p>We count visits and a small set of page events, such as a button being pressed or a form being sent, to learn whether the site works for visitors. This measurement does not use advertising cookies and does not build a profile of you.</p>
          <p>The site remembers two choices in your browser so pages behave as you expect: whether you prefer the plain version of the home page, and which sector you chose. Neither is sent to us.</p>
          <h2>Protection against spam</h2>
          <p>The form uses an invisible check to tell people from automated senders, and limits how many enquiries one connection can send in a short time.</p>
          <h2>Your choices</h2>
          <p>To see, correct or delete the details you sent us, email <a href={`mailto:${site.email}`}>{site.email}</a>.</p>
          <p className="muted">{site.legalName}, {site.location}.</p>
        </div>
      </section>
    </>
  );
}
