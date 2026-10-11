import { supabase } from './supabase';
import type { Delivery, DeliveryRequirement, RequirementStatus } from './types';

export async function setRequirementStatus(reqId: string, status: RequirementStatus, reason?: string): Promise<string | null> {
  const { error } = await supabase.rpc('set_requirement_status', {
    p_requirement_id: reqId,
    p_status: status,
    p_exception_reason: reason ?? null,
  });
  return error ? error.message : null;
}

// Marks the delivery complete and tells its Finance Manager, naming any
// exceptions. Returns a message worth showing the user, or null when there's
// nothing to say.
export async function completeDelivery(d: Delivery, requirements: DeliveryRequirement[]): Promise<{ error?: string; notice?: string }> {
  const { error } = await supabase.rpc('complete_delivery', { p_delivery_id: d.id });
  if (error) return { error: error.message };
  const exceptions = requirements.filter((r) => r.status === 'exception');
  const body = exceptions.length
    ? `Delivery Complete for ${d.customer_name} — with exceptions: ${exceptions.map((r) => `${r.label}${r.exception_reason ? ` (${r.exception_reason})` : ''}`).join('; ')}.`
    : `Delivery Complete for ${d.customer_name} — with no exceptions.`;
  const { data, error: pushError } = await supabase.functions.invoke('send-webpush', {
    body: {
      profile_ids: [d.fsm_id],
      delivery_id: d.id,
      title: `Delivery Complete — ${d.customer_name}`,
      body,
      data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'delivery_complete' },
    },
  }).catch(() => ({ data: null, error: null }));
  if (!pushError && !data?.sent) {
    return { notice: 'Marked delivered — the Finance Manager has no device enrolled for push notifications yet.' };
  }
  return {};
}
