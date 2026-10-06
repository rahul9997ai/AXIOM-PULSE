// The month an FSM is asked to close is always the one that just ended —
// on any day in a new calendar month, that's the previous month.
export function previousMonth(now = new Date()): { year: number; month: number } {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based; last month's 1-based number
  return m === 0 ? { year: y - 1, month: 12 } : { year: y, month: m };
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

// Hat-trick tracking (the salesperson yes/no prompt) launched partway
// through October 2026 — a fixed cutoff, not a rolling "current month"
// window, so deliveries from before the feature existed are never asked
// about it, this month or any month after. Deliveries from this date
// onward keep being asked indefinitely; this isn't a one-time grace period.
export const HATTRICK_TRACKING_STARTS_AT = '2026-10-01T00:00:00Z';
