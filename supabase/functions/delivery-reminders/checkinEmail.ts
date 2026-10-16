// The Finance Manager check-in email (9AM / 3PM / 8PM). Pure functions —
// no Deno or Supabase imports — so the template can be rendered and
// previewed outside the edge runtime.

export interface CheckinEmailEntry {
  customer_name: string;
  stock_number: string | null;
  delivery_at: string;
  created_at: string;
}

export interface CheckinEmailInput {
  slot: '9am' | '3pm' | '8pm';
  firstName: string;
  dealershipName: string | null;
  dateLabel: string; // e.g. "Thursday, October 15"
  entries: CheckinEmailEntry[];
  confirmUrl: string;
  timeZone: string;
}

const SLOT_LABEL = { '9am': '9:00 AM', '3pm': '3:00 PM', '8pm': '8:00 PM' } as const;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function checkinEmailSubject(slot: CheckinEmailInput['slot'], dateLabel: string): string {
  const prefix = slot === '8pm' ? 'Action required: End-of-day delivery check-in' : `Delivery check-in — ${SLOT_LABEL[slot]}`;
  return `${prefix} · ${dateLabel}`;
}

function intro(slot: CheckinEmailInput['slot']): string {
  if (slot === '9am') {
    return 'Please confirm that every delivery for which a work order was created in CDK 180 since yesterday\'s end-of-day check-in has been entered in Axiom Pulse.';
  }
  if (slot === '3pm') {
    return 'Please confirm that every delivery for which a work order has been created in CDK 180 today has been entered in Axiom Pulse.';
  }
  return 'Before you finish for the day, please confirm that every delivery for which a work order was created in CDK 180 today has been entered in Axiom Pulse.';
}

export function checkinEmailText(i: CheckinEmailInput): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-US', { timeZone: i.timeZone, ...opts });
  const lines = i.entries.length
    ? i.entries.map((e) => `  - ${e.customer_name}${e.stock_number ? ` (Stock #${e.stock_number})` : ''}: delivery ${fmt(e.delivery_at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}, entered ${fmt(e.created_at, { hour: 'numeric', minute: '2-digit' })}`).join('\n')
    : '  (none entered today)';
  return [
    `Hi ${i.firstName},`,
    '',
    `This is your ${SLOT_LABEL[i.slot]} delivery check-in for ${i.dateLabel}.`,
    '',
    intro(i.slot),
    '',
    `Deliveries you have entered in Pulse today: ${i.entries.length}`,
    lines,
    '',
    'If any work order from CDK 180 is not listed above, please enter it in Pulse now, then confirm your check-in:',
    i.confirmUrl,
    '',
    'Prompt entry ensures each salesperson receives their delivery details, requirements and reminders without delay. Check-ins not confirmed are included in the next morning\'s report to management.',
    '',
    'Thank you,',
    `Axiom Pulse — Delivery Coordination${i.dealershipName ? `\n${i.dealershipName}` : ''}`,
  ].join('\n');
}

export function checkinEmailHtml(i: CheckinEmailInput): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-US', { timeZone: i.timeZone, ...opts });
  const rows = i.entries.map((e) => `
          <tr>
            <td style="padding:10px 12px;border-top:1px solid #e5e9f0;font-size:14px;color:#0f172a;font-weight:600">${esc(e.customer_name)}</td>
            <td style="padding:10px 12px;border-top:1px solid #e5e9f0;font-size:13px;color:#475569;white-space:nowrap">${e.stock_number ? `#${esc(e.stock_number)}` : '—'}</td>
            <td style="padding:10px 12px;border-top:1px solid #e5e9f0;font-size:13px;color:#475569;white-space:nowrap">${esc(fmt(e.delivery_at, { weekday: 'short', month: 'short', day: 'numeric' }))}<br><span style="color:#64748b">${esc(fmt(e.delivery_at, { hour: 'numeric', minute: '2-digit' }))}</span></td>
            <td style="padding:10px 12px;border-top:1px solid #e5e9f0;font-size:13px;color:#475569;white-space:nowrap;text-align:right">${esc(fmt(e.created_at, { hour: 'numeric', minute: '2-digit' }))}</td>
          </tr>`).join('');

  const table = i.entries.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0;border-radius:10px;border-collapse:separate;overflow:hidden">
          <tr style="background:#f6f8fb">
            <td style="padding:9px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">Customer</td>
            <td style="padding:9px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">Stock</td>
            <td style="padding:9px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">Delivery</td>
            <td style="padding:9px 12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;text-align:right">Entered</td>
          </tr>${rows}
        </table>`
    : `<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:14px 16px;font-size:14px;color:#475569">No deliveries have been entered in Pulse today.</div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(checkinEmailSubject(i.slot, i.dateLabel))}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden">${esc(`${SLOT_LABEL[i.slot]} check-in: confirm every CDK 180 work order is entered in Pulse.`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe2ea;border-radius:14px;overflow:hidden">
      <tr><td style="background:#1e3a8a;padding:20px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:.12em">AXIOM <span style="font-style:italic;font-weight:700;letter-spacing:0;color:#bcd0ff">Pulse</span></td>
          <td align="right" style="color:#c9d6f2;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Delivery Check-in</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 28px 8px">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px">${esc(SLOT_LABEL[i.slot])} · ${esc(i.dateLabel)}</div>
        <div style="font-size:22px;font-weight:800;line-height:1.3;margin-bottom:16px">${i.slot === '8pm' ? 'End-of-day confirmation required' : 'Confirm your deliveries are entered'}</div>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">Hi ${esc(i.firstName)},</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">${esc(intro(i.slot))}</p>
      </td></tr>
      <tr><td style="padding:0 28px">
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px">Deliveries you have entered in Pulse today <span style="color:#1e3a8a">(${i.entries.length})</span></div>
        ${table}
        <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#475569">If any work order from CDK 180 is not listed above, please enter it in Pulse now, then confirm your check-in.</p>
      </td></tr>
      <tr><td style="padding:24px 28px 8px">
        <a href="${i.confirmUrl}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px">Review &amp; confirm check-in</a>
      </td></tr>
      <tr><td style="padding:16px 28px 26px">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">Prompt entry ensures each salesperson receives their delivery details, requirements and reminders without delay. Check-ins that are not confirmed are included in the next morning's report to management.</p>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#334155">Thank you,<br><strong>Axiom Pulse</strong> — Delivery Coordination${i.dealershipName ? `<br><span style="color:#64748b">${esc(i.dealershipName)}</span>` : ''}</p>
      </td></tr>
      <tr><td style="background:#f6f8fb;border-top:1px solid #e5e9f0;padding:14px 28px;font-size:11.5px;line-height:1.5;color:#94a3b8">
        This is an automated message from Axiom Pulse. Please do not reply to this email.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
