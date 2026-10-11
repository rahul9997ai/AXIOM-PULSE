import type { Delivery } from './types';

export type DueTone = 'over' | 'soon' | 'later' | 'done';

const HOUR = 60 * 60 * 1000;

function span(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`;
  const days = Math.floor(h / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

// "Overdue 1h 45m", "in 25m", "Tomorrow" — the one-glance answer to "how
// urgent is this?", colored by tone.
export function countdown(d: Delivery, now: Date): { label: string; tone: DueTone } {
  if (d.status === 'delivered') return { label: 'Delivered', tone: 'done' };
  const at = new Date(d.delivery_at);
  const diff = at.getTime() - now.getTime();
  if (diff < 0) return { label: `Overdue ${span(-diff)}`, tone: 'over' };
  if (diff <= 2 * HOUR) return { label: `in ${span(diff)}`, tone: 'soon' };
  if (isSameDay(at, now)) return { label: `in ${span(diff)}`, tone: 'later' };
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(at, tomorrow)) return { label: 'Tomorrow', tone: 'later' };
  return { label: `in ${span(diff)}`, tone: 'later' };
}

export function isActive(d: Delivery): boolean {
  return d.status !== 'delivered' && d.status !== 'cancelled';
}

// Requirements counted as dealt with: completed, or flagged as an exception.
export function requirementProgress(d: Delivery): { done: number; total: number; open: number } {
  const reqs = d.delivery_requirements || [];
  const open = reqs.filter((r) => r.status === 'outstanding').length;
  return { done: reqs.length - open, total: reqs.length, open };
}

// Two active deliveries at the same dealership booked for the exact same
// time — one of them almost certainly needs to move.
export function findClashes(rows: Delivery[]): Map<string, Delivery[]> {
  const bySlot = new Map<string, Delivery[]>();
  rows.filter(isActive).forEach((d) => {
    const key = `${d.dealership_id}|${new Date(d.delivery_at).getTime()}`;
    bySlot.set(key, [...(bySlot.get(key) ?? []), d]);
  });
  const clashes = new Map<string, Delivery[]>();
  bySlot.forEach((group) => {
    if (group.length < 2) return;
    group.forEach((d) => clashes.set(d.id, group.filter((o) => o.id !== d.id)));
  });
  return clashes;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function timeLabel(d: Date, now: Date): string {
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return isSameDay(d, now) ? time : `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}
