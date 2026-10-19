import { supabase } from './supabase';
import type { Delivery } from './types';
import type { DealershipConfig, ThankYouInput } from '../../../supabase/functions/delivery-reminders/thankYouEmail';

export { customerMessage, customerMessageText, mailtoHref } from '../../../supabase/functions/delivery-reminders/thankYouEmail';
export type { ThankYouInput } from '../../../supabase/functions/delivery-reminders/thankYouEmail';

export interface ThankYouSettings {
  dealership_id: string;
  enabled: boolean;
  google_review_url: string | null;
  email_domain: string | null;
}

export const DEFAULT_THANKYOU_SETTINGS: Omit<ThankYouSettings, 'dealership_id'> = { enabled: true, google_review_url: null, email_domain: null };

export async function loadThankYouSettings(dealershipId: string): Promise<ThankYouSettings> {
  const { data } = await supabase.from('thankyou_settings').select('*').eq('dealership_id', dealershipId).maybeSingle();
  return { dealership_id: dealershipId, ...DEFAULT_THANKYOU_SETTINGS, ...((data as ThankYouSettings | null) ?? {}) };
}

// Everything the thank-you template needs for one delivery: the dealership's
// details and brand (from its Command Center record) plus its review link.
export async function thankYouInputFor(d: Delivery, salespersonName: string): Promise<{ input: ThankYouInput; enabled: boolean }> {
  const [{ data: dealership }, settings] = await Promise.all([
    supabase.from('dealerships').select('name, data').eq('id', d.dealership_id).maybeSingle(),
    loadThankYouSettings(d.dealership_id),
  ]);
  const data = ((dealership?.data ?? {}) as Record<string, string | undefined>);
  const config: DealershipConfig = {
    name: dealership?.name ?? data.name ?? '',
    address: data.address,
    city: data.city,
    phone: data.phone,
    brandKey: data.brandKey,
    brandColor: data.brandColor,
    googleReviewUrl: settings.google_review_url,
  };
  return {
    input: { customerName: d.customer_name, vehicle: d.vehicle, condition: d.vehicle_condition, salespersonName, dealership: config },
    enabled: settings.enabled,
  };
}

// Saves where Pulse emails someone; returns an error message or null.
export async function saveNotifyEmail(profileId: string, email: string): Promise<string | null> {
  const { error } = await supabase.rpc('set_notify_email', { p_profile: profileId, p_email: email });
  return error ? error.message : null;
}

export async function sendTestEmail(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('delivery-reminders', { body: { action: 'test_email' } });
  if (!error) return null;
  const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
  return body?.error ?? (data as { error?: string } | null)?.error ?? error.message;
}
