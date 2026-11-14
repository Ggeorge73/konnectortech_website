import type { FrontierItem } from '@/lib/content';

// Frontier technology cards. Konnector is the integrator, not the inventor: the "what it is" line is the maker's own
// description, the rest is what Konnector does to make the device work inside the customer's environment.
// Text names only: no logos and no "partner" wording.
// Every technology serves both public and private sector customers. The home page lists both sides; a sector page
// (compact, with `side`) shows the line for its own side and links back to the full card on the home page.
export function FrontierCard({ item, pos, compact = false, side }: { item: FrontierItem; pos: string; compact?: boolean; side?: 'public' | 'private' }) {
  return (
    <article className="frontier-card" id={compact ? undefined : `frontier-${item.key}`}>
      <div className="stamp-row">
        <span className="stamp">Public and private sector</span>
        {item.draft ? <span className="stamp draft">Draft · wording and permission to confirm</span> : null}
      </div>
      <h3>{item.company} <span>{item.product}</span></h3>
      <dl>
        <div><dt>What it is</dt><dd>{item.what}</dd></div>
        <div>
          <dt>Where it fits</dt>
          <dd>
            {side ? (side === 'public' ? item.fitPublic : item.fitPrivate) : (
              <ul className="frontier-fit">
                <li><b>Public:</b> {item.fitPublic}</li>
                <li><b>Private:</b> {item.fitPrivate}</li>
              </ul>
            )}
          </dd>
        </div>
        {compact ? null : (
          <div>
            <dt>What Konnector does to land it</dt>
            <dd>
              <ol className="frontier-steps">
                {item.steps.map(([name, line]) => <li key={name}><b>{name}:</b> {line}.</li>)}
              </ol>
            </dd>
          </div>
        )}
      </dl>
      <p className="frontier-links">
        {compact ? <a className="arrow-link" href={`/#frontier-${item.key}`} data-cta="frontier" data-pos={pos}>How we land it</a> : null}
        <a href={item.url} rel="noopener noreferrer" data-cta="frontier-maker" data-pos={`${pos}-${item.key}`}>{item.company}&apos;s own site</a>
      </p>
    </article>
  );
}

export const FRONTIER_DISCLAIMER =
  'Product descriptions are each company’s own. Konnector is an independent integrator and makes no claims for these products. Company names are used for identification only.';
