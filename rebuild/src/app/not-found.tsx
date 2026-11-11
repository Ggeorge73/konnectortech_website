import Link from 'next/link';
import { PageHead } from '@/components/Page';

export default function NotFound() {
  return (
    <PageHead label="Page not found" title="This line does not reach a page." lede="The address may have changed. The home page will get you back on the line.">
      <div className="ctas"><Link className="btn btn-primary" href="/">Go to the home page</Link><Link className="btn btn-ghost" href="/contact/">Contact us</Link></div>
    </PageHead>
  );
}
