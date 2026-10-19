import type { CSSProperties } from 'react';
import { mhMark } from '@/lib/mhMark';

// The Mahanex logo: the hexagon mark (generated locally from fixed shapes, no
// user input, so injecting its SVG is safe) and the wordmark, shown as
// Mahan-Ex — the dash is visual only; the name is always "Mahanex" in text.

// Mark + wordmark + product name. "large" (sign-in and other landing
// screens) uses the circuit-trace version of the mark; "small" (header and
// side menu) the mark alone. Everything scales from --mx so narrow phones
// can shrink the large lockup in CSS.
export function MahanexLockup({ size = 22, mark = 'small' }: { size?: number; mark?: 'large' | 'small' }) {
  const large = mark === 'large';
  return (
    <div className={`mx-brand mx-brand-${mark}`} aria-label="Mahanex Pulse" style={{ '--mx': `${size}px` } as CSSProperties}>
      <span
        className="mh-mark-wrap"
        style={{ width: `calc(var(--mx) * ${large ? 3.1 : 1.75})` }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: mhMark({ traces: large, label: '' }) }}
      />
      <div className="mx-lockup">
        <span className="mx-wm" role="img" aria-label="Mahanex" style={{ fontSize: 'var(--mx)' }}>
          <span className="mx-mahan">Mahan</span>
          <span className="mx-dash" aria-hidden="true" />
          <span className="mx-ex">Ex</span>
        </span>
        <span className="mx-product" style={{ fontSize: 'calc(var(--mx) * 0.95)' }}>Pulse</span>
      </div>
    </div>
  );
}
