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

// Tells the salesperson when someone else (their Finance Manager, a GM or a
// Master) updates one of their requirements, so the tile flipping on their
// screen never comes as a surprise. Pushes share the delivery's tag, so a
// run of ticks collapses into the latest one on the phone.
export async function notifyRequirementOnBehalf(
  d: Delivery,
  req: DeliveryRequirement,
  status: RequirementStatus,
  actor: { name: string; role: string },
  stillOpen: number,
  reason?: string,
): Promise<void> {
  const who = `${actor.name} (${actor.role === 'General Manager' ? 'General Manager' : 'Finance Manager'})`;
  let title: string;
  let body: string;
  if (status === 'completed') {
    title = `Requirement completed — ${d.customer_name}`;
    body = `${who} has completed "${req.label}" on your behalf. `
      + (stillOpen === 0
        ? 'All requirements are now complete — please confirm the vehicle is ready and mark it delivered after handover.'
        : `${stillOpen} item${stillOpen === 1 ? '' : 's'} still require${stillOpen === 1 ? 's' : ''} your attention.`);
  } else if (status === 'exception') {
    title = `Exception recorded — ${d.customer_name}`;
    body = `${who} has recorded an exception for "${req.label}"${reason ? `: ${reason}` : ''}. No further action is needed on this item.`;
  } else {
    title = `Requirement reopened — ${d.customer_name}`;
    body = `${who} has reopened "${req.label}". Please complete it before the delivery.`;
  }
  await supabase.functions.invoke('send-webpush', {
    body: {
      profile_ids: [d.salesperson_id],
      delivery_id: d.id,
      title,
      body,
      data: { url: `/delivery/${d.id}`, deliveryId: d.id, type: 'requirement_update' },
    },
  }).catch(() => undefined);
}
