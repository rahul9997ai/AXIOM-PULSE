// The daily Finance Manager reminder email ("enter today's deliveries").
// Pure functions — no Deno or Supabase imports — so the template can be
// rendered and previewed outside the edge runtime.

export interface ReminderEmailEntry {
  customer_name: string;
  stock_number: string | null;
  delivery_at: string;
  created_at: string;
}

export interface ReminderEmailInput {
  firstName: string;
  dealershipName: string | null;
  dateLabel: string; // e.g. "Monday, October 19"
  entries: ReminderEmailEntry[];
  newDeliveryUrl: string;
  timeZone: string;
}

const BENEFITS = [
  ['Lienholder details, instantly', 'Salespeople see the lender, approval status and delivery time the moment the deal is entered — no calls or messages to Finance.'],
  ['Requirements started on day one', 'Every requirement is assigned immediately, giving the team the full lead time to collect insurance, documents and plates before handover.'],
  ['An accurate delivery tracker', 'Each salesperson\'s delivery count, bonus tracker and reminders stay correct, and management reports reflect what is actually scheduled.'],
] as const;

const COSTS = [
  'Salespeople end up chasing Finance Managers for lienholder information and delivery details.',
  'Requirements surface late and get rushed — or the delivery is pushed back.',
  'The salesperson\'s delivery tracker under-reports their month, and reminders never reach them.',
] as const;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function reminderEmailSubject(): string {
  return 'Reminder: Please enter today\'s deliveries in Mahanex Pulse';
}

export function reminderEmailText(i: ReminderEmailInput): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-US', { timeZone: i.timeZone, ...opts });
  return [
    `Hi ${i.firstName},`,
    '',
    'As the day winds down, please make sure every delivery with a work order sent in CDK 180 today has been entered in Mahanex Pulse.',
    '',
    'Why timely entry matters:',
    ...BENEFITS.map(([t, d]) => `  - ${t}: ${d}`),
    '',
    'When a delivery is entered late:',
    ...COSTS.map((c) => `  - ${c}`),
    '',
    'Best practice: enter each delivery in Pulse as soon as its work order is sent in CDK 180.',
    '',
    `Enter a delivery: ${i.newDeliveryUrl}`,
    '',
    `For reference, deliveries you have entered today: ${i.entries.length}`,
    ...i.entries.map((e) => `  - ${e.customer_name}${e.stock_number ? ` (Stock #${e.stock_number})` : ''}, delivery ${fmt(e.delivery_at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`),
    '',
    'Thank you for your support,',
    `Mahanex Pulse — Delivery Coordination${i.dealershipName ? `\n${i.dealershipName}` : ''}`,
  ].join('\n');
}

export function reminderEmailHtml(i: ReminderEmailInput): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-US', { timeZone: i.timeZone, ...opts });
  const benefitRows = BENEFITS.map(([title, desc]) => `
          <tr>
            <td width="34" valign="top" style="padding:0 0 14px"><div style="width:24px;height:24px;border-radius:12px;background:#1e3a8a;color:#ffffff;font-size:13px;font-weight:800;line-height:24px;text-align:center">&#10003;</div></td>
            <td valign="top" style="padding:0 0 14px"><div style="font-size:14.5px;font-weight:700;color:#0f172a;margin-bottom:2px">${esc(title)}</div><div style="font-size:14px;line-height:1.55;color:#475569">${esc(desc)}</div></td>
          </tr>`).join('');
  const costRows = COSTS.map((c) => `<li style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#7c2d12">${esc(c)}</li>`).join('');
  const entryRows = i.entries.map((e, n) => {
    const line = n === 0 ? '' : 'border-top:1px solid #e5e9f0;';
    return `
          <tr>
            <td style="padding:8px 12px;${line}font-size:13.5px;color:#0f172a;font-weight:600">${esc(e.customer_name)}</td>
            <td style="padding:8px 12px;${line}font-size:13px;color:#475569;white-space:nowrap">${e.stock_number ? `#${esc(e.stock_number)}` : '—'}</td>
            <td style="padding:8px 12px;${line}font-size:13px;color:#475569;white-space:nowrap;text-align:right">${esc(fmt(e.delivery_at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td>
          </tr>`;
  }).join('');
  const entries = i.entries.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9f0;border-radius:10px;border-collapse:separate;overflow:hidden">${entryRows}</table>`
    : '<div style="font-size:13.5px;color:#64748b">You have not entered any deliveries in Pulse today.</div>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(reminderEmailSubject())}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden">Please make sure every CDK 180 work order from today is entered in Pulse.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe2ea;border-radius:14px;overflow:hidden">
      <tr><td style="background:#0B1430;padding:20px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:'Sora',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:.09em">MAHAN<span style="color:#F0B94A">-EX</span> <span style="font-style:italic;font-weight:700;letter-spacing:0;color:#D4E1F7">Pulse</span></td>
          <td align="right" style="color:#D4E1F7;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">${esc(i.dateLabel)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:30px 28px 6px">
        <div style="font-size:23px;font-weight:800;line-height:1.3;margin-bottom:16px">Daily delivery entry reminder</div>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">Hi ${esc(i.firstName)},</p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155">As the day winds down, please take a moment to make sure every delivery with a work order sent in <strong>CDK 180</strong> today has been entered in Mahanex Pulse.</p>
      </td></tr>
      <tr><td style="padding:0 28px">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1e3a8a;margin-bottom:12px">Why timely entry matters</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${benefitRows}
        </table>
      </td></tr>
      <tr><td style="padding:6px 28px 0">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 18px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9a3412;margin-bottom:10px">When a delivery is entered late</div>
          <ul style="margin:0;padding-left:18px">${costRows}</ul>
        </div>
      </td></tr>
      <tr><td style="padding:22px 28px 4px">
        <p style="margin:0 0 18px;font-size:14.5px;line-height:1.6;color:#334155"><strong>Best practice:</strong> enter each delivery in Pulse as soon as its work order is sent in CDK 180.</p>
        <a href="${i.newDeliveryUrl}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px">Enter a delivery</a>
      </td></tr>
      <tr><td style="padding:26px 28px 6px">
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px">For reference — deliveries you have entered today <span style="color:#1e3a8a">(${i.entries.length})</span></div>
        ${entries}
      </td></tr>
      <tr><td style="padding:22px 28px 26px">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#334155">Thank you for your support,<br><strong>Mahanex Pulse</strong> — Delivery Coordination${i.dealershipName ? `<br><span style="color:#64748b">${esc(i.dealershipName)}</span>` : ''}</p>
      </td></tr>
      <tr><td style="background:#f6f8fb;border-top:1px solid #e5e9f0;padding:14px 28px;font-size:11.5px;line-height:1.5;color:#94a3b8">
        This is an automated reminder from Mahanex Pulse. Please do not reply to this email.<br>Mahanex · Great minds, built with AI.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
