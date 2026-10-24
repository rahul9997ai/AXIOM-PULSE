// Reminder to pay off the lien on a delivered vehicle's trade-in. Pure
// functions (no Deno imports) so the template can be previewed anywhere.

export interface LienEmailInput {
  firstName: string;
  customerName: string;
  stockNumber: string | null;
  vehicle: string | null;
  deliveredLabel: string; // e.g. "Mon, Oct 19, 2:15 PM"
  n: 1 | 2 | 3;
  url: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function lienEmailSubject(i: Pick<LienEmailInput, 'customerName' | 'n'>): string {
  return `Reminder ${i.n} of 3: pay off the lien on ${i.customerName}'s trade-in`;
}

const LEAD = {
  1: 'This is a friendly reminder that the trade-in on this delivery has a lien that still needs to be paid off.',
  2: 'The lien on this trade-in is still showing as open. Please pay it off and update Pulse.',
  3: 'This is the final reminder: the lien on this trade-in is still showing as open.',
} as const;

const HOW = 'Once it is paid, open the delivery and tap “Lien paid off”. If there turned out to be no lien, tap “No lien after all”. Either one stops these reminders.';

export function lienEmailText(i: LienEmailInput): string {
  return [
    `Hi ${i.firstName},`, '',
    LEAD[i.n], '',
    `Customer: ${i.customerName}`,
    i.stockNumber ? `Stock #: ${i.stockNumber}` : '',
    i.vehicle ? `Vehicle: ${i.vehicle}` : '',
    `Delivered: ${i.deliveredLabel}`, '',
    HOW, '', `Open delivery: ${i.url}`, '',
    `Reminder ${i.n} of 3 · Mahan-Ex Pulse`,
  ].filter((l, idx, a) => l !== '' || a[idx - 1] !== '').join('\n');
}

export function lienEmailHtml(i: LienEmailInput): string {
  const row = (k: string, v: string | null) => v
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:96px">${k}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827">${esc(v)}</td></tr>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0B1430;padding:18px 24px;color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.3px">Mahan-Ex <span style="font-style:italic;color:#7aa2ff">Pulse</span></td></tr>
<tr><td style="padding:24px">
<div style="display:inline-block;background:#fff4d6;color:#8a5a00;font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px">Reminder ${i.n} of 3</div>
<h1 style="margin:12px 0 8px;font-size:20px;color:#111827">Pay off the lien on ${esc(i.customerName)}’s trade-in</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">Hi ${esc(i.firstName)}, ${esc(LEAD[i.n])}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:16px">
${row('Customer', i.customerName)}${row('Stock #', i.stockNumber)}${row('Vehicle', i.vehicle)}${row('Delivered', i.deliveredLabel)}
</table>
<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#4b5563">${esc(HOW)}</p>
<a href="${esc(i.url)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Open delivery</a>
</td></tr>
<tr><td style="padding:14px 24px;background:#f9fafb;color:#9ca3af;font-size:11px">Mahan-Ex Pulse · Reminder ${i.n} of 3</td></tr>
</table></td></tr></table></body></html>`;
}
