import { supabase } from './supabase';

// Privacy notice, terms of use and cookies/storage pages. They're written per
// dealership (its name, address, phone, privacy contact and province) with
// Mahanex named as the software provider, and are reachable before anyone
// signs in, at /<dealership-slug>/privacy etc. Without a dealership (the
// sign-in page's general links) they describe the service in general.

export type LegalKind = 'privacy' | 'terms' | 'cookies';

export const LEGAL_KINDS: { kind: LegalKind; label: string }[] = [
  { kind: 'privacy', label: 'Privacy notice' },
  { kind: 'terms', label: 'Terms of use' },
  { kind: 'cookies', label: 'Cookies & storage' },
];

// Bump when the wording changes.
export const LEGAL_UPDATED = '2026-10-20';

// Mahanex, the software provider named on every dealership's pages. Set
// `contactEmail` once the company has a privacy contact address; until then
// the pages send requests to the dealership, which involves Mahanex as needed,
// rather than publishing an address that doesn't exist.
export const MAHANEX = {
  name: 'Mahanex',
  contactEmail: '',
};

export const PROVINCES: { code: ProvinceCode; name: string }[] = [
  { code: 'ON', name: 'Ontario' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'AB', name: 'Alberta' },
  { code: 'QC', name: 'Québec' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'YT', name: 'Yukon' },
];
export type ProvinceCode = 'ON' | 'BC' | 'AB' | 'QC' | 'MB' | 'SK' | 'NS' | 'NB' | 'NL' | 'PE' | 'NT' | 'NU' | 'YT';

export interface DealershipLegal {
  name: string;
  legalName: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  privacyEmail: string | null;
  province: ProvinceCode;
}

// "401 DIXIE NISSAN" -> "401-dixie-nissan". Must match the database function
// public_dealership_legal, which looks dealerships up by this.
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function legalPath(kind: LegalKind, slug?: string | null): string {
  return slug ? `/${slug}/${kind}` : `/${kind}`;
}

const RESERVED_FIRST_SEGMENTS = new Set(['delivery', 'lenders', 'edit', 'new', 'checkin', 'settings', 'calendar', 'month-close']);

// Which legal page (if any) a URL is, so it can be shown without signing in.
export function matchLegalPath(pathname: string): { kind: LegalKind; slug: string | null } | null {
  const general = pathname.match(/^\/(privacy|terms|cookies)\/?$/);
  if (general) return { kind: general[1] as LegalKind, slug: null };
  const scoped = pathname.match(/^\/([a-z0-9-]+)\/(privacy|terms|cookies)\/?$/);
  if (scoped && !RESERVED_FIRST_SEGMENTS.has(scoped[1])) return { kind: scoped[2] as LegalKind, slug: scoped[1] };
  return null;
}

export async function fetchDealershipLegal(slug: string): Promise<DealershipLegal | null> {
  const { data, error } = await supabase.rpc('public_dealership_legal', { p_slug: slug });
  if (error || !data) return null;
  const d = data as { name: string; legal_name: string; address: string | null; city: string | null; phone: string | null; privacy_email: string | null; province: ProvinceCode };
  return { name: d.name, legalName: d.legal_name, address: d.address, city: d.city, phone: d.phone, privacyEmail: d.privacy_email, province: d.province };
}

export interface LegalSettings {
  dealership_id: string;
  legal_name: string | null;
  privacy_email: string | null;
  province: ProvinceCode;
}

export async function loadLegalSettings(dealershipId: string): Promise<LegalSettings> {
  const { data } = await supabase.from('dealership_legal_settings').select('*').eq('dealership_id', dealershipId).maybeSingle();
  return { dealership_id: dealershipId, legal_name: null, privacy_email: null, province: 'ON', ...((data as LegalSettings | null) ?? {}) };
}
