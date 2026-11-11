// The Konnector mark: three ring nodes joined by bars. Artwork is unchanged from the current site.
export function Mark({ strokeWidth = 5, ...props }: React.SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="-4 -4 78 70" fill="none" stroke="#00C2FF" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="35" cy="9" r="6.5" />
      <circle cx="10" cy="51" r="6.5" />
      <circle cx="60" cy="51" r="6.5" />
      <path d="M31.5 14.5 L13.5 45.5" />
      <path d="M38.5 14.5 L43 22 L37 33 L56.5 45.5" />
      <path d="M16.5 51 L28 51 L31 47 L35 51 L53.5 51" />
    </svg>
  );
}

// Scanner ring with tick marks: the porthole motif used on the lens and on page headers.
export function ScannerRing(props: React.SVGProps<SVGSVGElement>) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <svg viewBox="-100 -100 200 200" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <circle r="80" strokeWidth="1" opacity="0.75" />
      <circle r="92" strokeWidth="0.6" opacity="0.4" strokeDasharray="2 6" />
      {ticks.map((i) => (
        <line key={i} x1="0" y1={-80} x2="0" y2={i % 6 === 0 ? -88 : -84} strokeWidth={i % 6 === 0 ? 1.2 : 0.7} opacity={i % 6 === 0 ? 0.9 : 0.5} transform={`rotate(${i * 5})`} />
      ))}
      <path d="M0 -80 A80 80 0 0 1 69.3 -40" stroke="#00C2FF" strokeWidth="2" />
    </svg>
  );
}
