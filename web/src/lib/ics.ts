import type { Delivery } from './types';

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Browsers have no API to write directly into a phone's native calendar —
// the standard, cross-platform way is a downloadable .ics file, which iOS
// and Android both recognize and offer to add to Calendar on open.
export function downloadDeliveryIcs(delivery: Delivery): void {
  const start = new Date(delivery.delivery_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const lender = delivery.lenders?.name ? ` at ${delivery.lenders.name}` : '';
  const requirements = (delivery.delivery_requirements || []).map((r) => `- ${r.label}`).join('\\n');
  const description = [
    delivery.vehicle ? `Vehicle: ${delivery.vehicle}` : null,
    requirements ? `Requirements:\\n${requirements}` : null,
    delivery.fsm_name ? `Finance Manager: ${delivery.fsm_name}` : null,
  ].filter(Boolean).join('\\n\\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Axiom Pulse//Delivery//EN',
    'BEGIN:VEVENT',
    `UID:${delivery.id}@axiompulse`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(delivery.delivery_at)}`,
    `DTEND:${toIcsDate(end.toISOString())}`,
    `SUMMARY:${escapeIcs(`Delivery — ${delivery.customer_name}${lender}`)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : '',
    delivery.lenders?.address ? `LOCATION:${escapeIcs(delivery.lenders.address)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `delivery-${delivery.customer_name.replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
