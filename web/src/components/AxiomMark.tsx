// Same "A" monogram lockup used across Axiom Command Center / Axiom Flow, so
// Pulse reads as the same brand family rather than a separate product.
export function AxiomMonogram({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 132 110" width={size} height={(size * 110) / 132} aria-hidden="true">
      <defs>
        <linearGradient id="axpLg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0a55e6" />
          <stop offset="1" stopColor="#2f9bff" />
        </linearGradient>
      </defs>
      <path d="M4 106L50 6h24l50 100h-27L62 38 31 106z" fill="url(#axpLg)" />
      <path d="M14 92L74 70l-8-9 62-24-42 32 12 4-56 24z" fill="#5cc8ff" />
    </svg>
  );
}

export function AxiomLockup({ size = 40 }: { size?: number }) {
  return (
    <div className="ax-lockup">
      <AxiomMonogram size={size} />
      <span className="ax-xiom">XIOM</span>
      <span className="ax-pulse">Pulse</span>
    </div>
  );
}
