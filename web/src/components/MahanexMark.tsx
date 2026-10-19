// The Mahanex wordmark (shown as Mahan-Ex: the dash is visual only — the name
// is always "Mahanex" in text) with this app's product name beside it.
export function MahanexWordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="mx-wm" role="img" aria-label="Mahanex" style={{ fontSize: size }}>
      <span className="mx-mahan">Mahan</span>
      <span className="mx-dash" aria-hidden="true" />
      <span className="mx-ex">Ex</span>
    </span>
  );
}

export function MahanexLockup({ size = 22 }: { size?: number }) {
  return (
    <div className="mx-lockup" aria-label="Mahanex Pulse">
      <MahanexWordmark size={size} />
      <span className="mx-product" style={{ fontSize: size * 0.95 }}>Pulse</span>
    </div>
  );
}
