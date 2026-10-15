// Finance Manager delivery check-ins (9AM / 3PM / 8PM Eastern). Sent and
// escalated by the delivery-reminders edge function; this is the client
// side — confirming, and the log managers review.
import { supabase } from './supabase';

export const DEALERSHIP_TZ = 'America/Toronto';

export type CheckinSlot = '9am' | '3pm' | '8pm';

export const CHECKIN_SLOTS: { slot: CheckinSlot; label: string }[] = [
  { slot: '9am', label: '9:00 AM' },
  { slot: '3pm', label: '3:00 PM' },
  { slot: '8pm', label: '8:00 PM' },
];

export interface FsmCheckin {
  id: string;
  fsm_id: string;
  dealership_id: string | null;
  local_date: string;
  slot: CheckinSlot;
  sent_at: string;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  escalated_at: string | null;
}

export function slotLabel(slot: string): string {
  return CHECKIN_SLOTS.find((s) => s.slot === slot)?.label ?? slot;
}

// The dealership's calendar date (YYYY-MM-DD) — check-ins are keyed by it,
// not by the viewer's own timezone.
export function dealershipDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DEALERSHIP_TZ }).format(d);
}

// The UTC instant of midnight, dealership time, on the given date key.
export function dealershipMidnight(dateKey: string): Date {
  const utcMidnight = new Date(`${dateKey}T00:00:00Z`);
  const local = new Date(utcMidnight.toLocaleString('en-US', { timeZone: DEALERSHIP_TZ }));
  const utc = new Date(utcMidnight.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(utcMidnight.getTime() - (local.getTime() - utc.getTime()));
}

export function formatDealershipTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { timeZone: DEALERSHIP_TZ, hour: 'numeric', minute: '2-digit' });
}

export async function confirmCheckin(id: string): Promise<{ confirmedAt?: string; error?: string }> {
  const { data, error } = await supabase.rpc('confirm_fsm_checkin', { p_checkin_id: id });
  if (error) return { error: error.message };
  return { confirmedAt: data as string };
}
