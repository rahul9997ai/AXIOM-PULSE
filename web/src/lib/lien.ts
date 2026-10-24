// A requirement is trade-related when its label mentions a trade
// ("Trade Ownership", "Trade-in keys", "Trade payout letter"...).
export const isTradeRelated = (label: string) => /\btrade\b/i.test(label);

export type LienStatus = 'none' | 'pending' | 'paid';
