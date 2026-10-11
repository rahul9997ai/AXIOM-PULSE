// Single source of truth for salesperson bonus math — shared by the monthly
// PDF report and the live tracker on the salesperson's home screen, so the
// two can never disagree.

// $150 per completed hat-trick group, and a stepped (not per-car) volume
// bonus on total vehicles delivered in the month — highest threshold met
// wins, no bonus below 10.
export const HATTRICK_BONUS_CENTS = 15000;
export const VOLUME_BONUS_TIERS: { count: number; cents: number }[] = [
  { count: 25, cents: 200000 },
  { count: 20, cents: 150000 },
  { count: 15, cents: 100000 },
  { count: 10, cents: 50000 },
];

export function volumeBonusFor(deliveredCount: number): { tierCount: number; cents: number } | null {
  for (const tier of VOLUME_BONUS_TIERS) {
    if (deliveredCount >= tier.count) return { tierCount: tier.count, cents: tier.cents };
  }
  return null;
}

export function nextVolumeTier(deliveredCount: number): { count: number; cents: number } | null {
  const above = VOLUME_BONUS_TIERS.filter((t) => t.count > deliveredCount);
  return above.length ? above[above.length - 1] : null;
}

export interface HattrickRow {
  id: string;
  customer_name: string;
  stock_number: string | null;
  delivery_at: string;
  delivered_at: string | null;
  sold_at: string;
  status: string;
}

export interface HattrickCandidate {
  soldAt: string;
  members: HattrickRow[];
  allDelivered: boolean;
  completedAt: string | null;
}

// Grouped by sold date — 3+ vehicles sold the same day is a hat-trick
// candidate, complete only once every member has been delivered. The bonus
// belongs to the month the last member delivered (completedAt).
export function groupHattricks(rows: HattrickRow[]): HattrickCandidate[] {
  const bySoldAt = new Map<string, HattrickRow[]>();
  rows.forEach((r) => bySoldAt.set(r.sold_at, [...(bySoldAt.get(r.sold_at) ?? []), r]));
  return Array.from(bySoldAt.entries())
    .filter(([, members]) => members.length >= 3)
    .map(([soldAt, members]) => {
      const allDelivered = members.every((m) => m.status === 'delivered');
      const completedAt = allDelivered
        ? members.reduce<string | null>((max, m) => (m.delivered_at && (!max || m.delivered_at > max) ? m.delivered_at : max), null)
        : null;
      return { soldAt, members, allDelivered, completedAt };
    })
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
}

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}
