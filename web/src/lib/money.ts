export function centsToInput(cents: number): string {
  return cents ? (cents / 100).toFixed(2) : '';
}

export function inputToCents(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'CAD' });
}
