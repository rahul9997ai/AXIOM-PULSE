// The post-delivery "thank you" message. Pulse doesn't email customers
// directly: it emails the salesperson a ready-to-send message (and shows the
// same message on the delivery page) for them to send from their own work
// email, so it reaches the customer from the salesperson's address.
//
// New vehicles ask the customer to complete the manufacturer's survey; used
// vehicles ask for a Google review and referrals instead.
//
// Everything brand-specific (survey issuer, top score, owner app) comes from
// BRANDS keyed by the dealership's brandKey, and everything
// dealership-specific (name, address, phone, colour, review link) from the
// dealership's own settings — a new dealership or brand only needs
// configuration, not new copy.
//
// Pure functions with no imports: the web app imports this same file to
// show the message in-app.

export interface BrandConfig {
  name: string; // "Nissan"
  surveyIssuer: string; // who sends the new-vehicle survey: "Nissan Canada"
  topScore: string; // the only rating that counts as fully satisfied
  ownerApp?: string; // connected-car app worth a mention
}

export const BRANDS: Record<string, BrandConfig> = {
  nissan: { name: 'Nissan', surveyIssuer: 'Nissan Canada', topScore: '10 out of 10', ownerApp: 'the NissanConnect app' },
};

// Used for a dealership with no brandKey or one not in BRANDS yet.
const GENERIC_BRAND: BrandConfig = { name: 'the manufacturer', surveyIssuer: 'the manufacturer', topScore: 'the highest rating' };

export interface DealershipConfig {
  name: string; // "401 DIXIE NISSAN"
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  brandKey?: string | null;
  brandColor?: string | null;
  googleReviewUrl?: string | null;
}

export interface ThankYouInput {
  customerName: string;
  vehicle: string | null;
  // 'used' gets the Google review version; anything else the survey version.
  condition: 'new' | 'used' | null;
  salespersonName: string;
  dealership: DealershipConfig;
}

export interface CustomerMessage {
  subject: string;
  paragraphs: string[];
  link?: { label: string; url: string };
  bulletsIntro: string;
  bullets: string[];
  signature: string[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// "401 DIXIE NISSAN" → "401 Dixie Nissan". Mixed-case text is left alone;
// words with digits (postal codes) and province codes stay upper case.
export function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.split(' ').map((w) => /\d/.test(w) || /^(ON|BC|AB|QC|MB|SK|NS|NB|PE|NL)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

export function brandFor(d: DealershipConfig): BrandConfig {
  return (d.brandKey && BRANDS[d.brandKey.toLowerCase()]) || GENERIC_BRAND;
}

const isUsed = (i: ThankYouInput) => i.condition === 'used';

function signature(i: ThankYouInput): string[] {
  const d = i.dealership;
  const street = [d.address, d.city].filter(Boolean).map((s) => titleCase(s!)).join(', ');
  return [
    'Thank you again for your trust.',
    '',
    'Warm regards,',
    i.salespersonName,
    'Sales Consultant',
    titleCase(d.name),
    ...(street ? [street] : []),
    ...(d.phone ? [d.phone] : []),
  ];
}

// The message the salesperson sends to their customer.
export function customerMessage(i: ThankYouInput): CustomerMessage {
  const b = brandFor(i.dealership);
  const store = titleCase(i.dealership.name);
  const first = firstName(i.customerName);
  const me = firstName(i.salespersonName);
  const phone = i.dealership.phone ? ` at ${i.dealership.phone} (just ask for ${me})` : '';
  const helpFeatures = `Help with your vehicle's features${b.ownerApp && !isUsed(i) ? `, pairing your phone or setting up ${b.ownerApp}` : ' or pairing your phone'}`;

  if (isUsed(i)) {
    const vehicle = i.vehicle?.trim() ? `your ${i.vehicle.trim()}` : 'your vehicle';
    // Only a real web link is used — anything else falls back to "search on Google".
    const typed = i.dealership.googleReviewUrl?.trim();
    const reviewUrl = typed && /^https?:\/\//i.test(typed) ? typed : undefined;
    return {
      subject: `Thank you, ${first} — enjoy ${vehicle}`,
      paragraphs: [
        `Hi ${first},`,
        `Thank you for choosing ${store} for ${vehicle}. It was a real pleasure working with you, and I hope you're already enjoying every drive.`,
        `If you have a moment, I would be truly grateful if you could share your experience in a quick Google review. Reviews are how future customers decide where to buy, and when you mention me by name, it goes a long way for me personally.`,
        reviewUrl
          ? 'It only takes a minute:'
          : `It only takes a minute — just search "${store}" on Google and tap "Write a review".`,
      ],
      link: reviewUrl ? { label: `Write a Google review for ${store}`, url: reviewUrl } : undefined,
      bulletsIntro: 'The best compliment I can receive is a referral. If friends, family or co-workers are shopping for a vehicle — new or pre-owned — please send them my way, and I\'ll look after them just as carefully. And I\'m always here for you too:',
      bullets: [
        helpFeatures,
        'Booking your first service appointment',
        `Any question at all — reply to this email or call me${phone}`,
      ],
      signature: signature(i),
    };
  }

  const vehicle = i.vehicle?.trim() ? `your new ${i.vehicle.trim()}` : `your new ${b === GENERIC_BRAND ? 'vehicle' : b.name}`;
  return {
    subject: `Thank you, ${first} — enjoy ${vehicle}`,
    paragraphs: [
      `Hi ${first},`,
      `Thank you for choosing ${store} for ${vehicle}. It was a real pleasure working with you, and I hope you're already enjoying every drive.`,
      `Over the next few days you'll receive a short survey by email from ${b.surveyIssuer} about your purchase experience. I would be truly grateful if you could take a few minutes to complete it.`,
      `${b.surveyIssuer} reads every response, and it's the main way they measure my work. In their survey, only a ${b.topScore} is counted as a completely satisfied customer — any lower score is recorded against me, even when the overall experience was a good one. Your feedback directly affects my standing and recognition with ${b.name}, so it means a great deal to me.`,
      `If anything about your purchase or delivery was less than a ${b.topScore} experience, please reply to this email or call me${phone} before completing the survey. I'd welcome the chance to make it right.`,
    ],
    bulletsIntro: 'I\'m also here for anything you need along the way:',
    bullets: [
      helpFeatures,
      'Booking your first service appointment',
      'Friends or family who are shopping for a vehicle — I\'d be honoured to look after them the same way',
    ],
    signature: signature(i),
  };
}

// Plain text of the customer message — what gets copied or pre-filled.
export function customerMessageText(i: ThankYouInput): string {
  const m = customerMessage(i);
  const [greeting, ...rest] = m.paragraphs;
  return [
    greeting, '',
    ...rest.flatMap((p) => [p, '']),
    ...(m.link ? [`${m.link.label}:`, m.link.url, ''] : []),
    m.bulletsIntro, '',
    ...m.bullets.map((x) => `• ${x}`), '',
    ...m.signature,
  ].join('\n');
}

// The customer message as HTML with inline styles, so it pastes cleanly into
// Gmail and Outlook. The Google review link shows as short text ("Write a
// Google review for ...") that opens the review page, never the raw URL.
export function customerMessageHtml(i: ThankYouInput): string {
  const m = customerMessage(i);
  const accent = i.dealership.brandColor || '#1e3a8a';
  const para = (p: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1f2937">${esc(p)}</p>`;
  const link = m.link
    ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6"><a href="${esc(m.link.url)}" style="color:${accent};font-weight:700;text-decoration:underline">${esc(m.link.label)}</a></p>`
    : '';
  const bullets = m.bullets.map((x) => `<li style="margin:0 0 6px;font-size:15px;line-height:1.55;color:#1f2937">${esc(x)}</li>`).join('');
  const sig = m.signature.map((l) => l ? esc(l) : '&nbsp;').join('<br>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${m.paragraphs.map(para).join('\n')}
${link}
${para(m.bulletsIntro)}
<ul style="margin:0 0 14px;padding-left:20px">${bullets}</ul>
<p style="margin:0;font-size:15px;line-height:1.6;color:#1f2937">${sig}</p>
</div>`;
}

export function mailtoHref(i: ThankYouInput): string {
  const m = customerMessage(i);
  return `mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(customerMessageText(i))}`;
}

// --- The email Pulse sends to the salesperson -------------------------------

export function thankYouEmailSubject(i: ThankYouInput): string {
  return `Ready to send: thank-you email for ${i.customerName}`;
}

function intro(i: ThankYouInput): string {
  const b = brandFor(i.dealership);
  return isUsed(i)
    ? 'Sending it from your own work email within a day of delivery keeps the relationship personal — and asks for a Google review and referrals while the experience is still fresh.'
    : `Sending it from your own work email within a day of delivery keeps the relationship personal — and reminds them the ${b.surveyIssuer} survey is coming, while the experience is still fresh.`;
}

function tip(i: ThankYouInput): string {
  return isUsed(i)
    ? 'Ask in person at delivery too — customers are far more likely to leave a review the same day they hear it from you.'
    : 'The customer is far more likely to respond when they hear about the survey from you first. If they mention any concern, resolve it before the survey arrives.';
}

export function thankYouEmailText(i: ThankYouInput): string {
  const first = firstName(i.customerName);
  return [
    `Congratulations on ${first}'s delivery, ${firstName(i.salespersonName)}.`,
    '',
    `Your thank-you email to ${i.customerName} is written and ready. ${intro(i)}`,
    '',
    `Copy everything between the lines into a new email from your work address to ${first}, add a personal line, and send.`,
    '',
    '----------------------------------------',
    `Subject: ${customerMessage(i).subject}`,
    '',
    customerMessageText(i),
    '----------------------------------------',
    '',
    `Tip: ${tip(i)}`,
  ].join('\n');
}

export function thankYouEmailHtml(i: ThankYouInput, deliveryUrl?: string): string {
  const m = customerMessage(i);
  const accent = i.dealership.brandColor || '#1e3a8a';
  const first = firstName(i.customerName);
  const store = titleCase(i.dealership.name);
  const used = isUsed(i);

  const steps = [
    ['Copy', 'Select everything inside the box below, from the subject line down to your signature.'],
    ['Paste', `Start a new email from your work address to ${esc(first)}, and paste.`],
    ['Personalize', 'Add a line about something you talked about — it makes it theirs. Then send.'],
  ];
  const stepRows = steps.map(([t, d], n) => `
            <td width="33%" valign="top" style="padding:0 ${n < 2 ? '8px' : '0'} 0 ${n > 0 ? '8px' : '0'}">
              <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${accent}">${n + 1}. ${t}</div>
              <div style="font-size:13px;line-height:1.5;color:#475569;margin-top:4px">${d}</div>
            </td>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(thankYouEmailSubject(i))}</title></head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,23,42,.08)">
        <tr><td style="background:#0B1430;padding:18px 28px">
          <div style="font-family:Sora,'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.02em">Mahan<span style="color:#F0B94A">-Ex</span> <span style="font-style:italic;font-weight:700;color:#D4E1F7">Pulse</span></div>
        </td></tr>
        <tr><td style="height:4px;background:${accent};font-size:0;line-height:0">&nbsp;</td></tr>

        <tr><td style="padding:28px 28px 8px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${accent}">Delivered${used ? ' · Pre-owned' : ''}${i.vehicle ? ` · ${esc(i.vehicle)}` : ''}</div>
          <h1 style="margin:6px 0 10px;font-size:22px;line-height:1.3;color:#0f172a">Congratulations on ${esc(first)}'s delivery, ${esc(firstName(i.salespersonName))}</h1>
          <p style="margin:0;font-size:14.5px;line-height:1.6;color:#475569">
            Your thank-you email to <strong style="color:#0f172a">${esc(i.customerName)}</strong> is written and ready. ${esc(intro(i))}
          </p>
        </td></tr>

        <tr><td style="padding:18px 28px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border-radius:10px;padding:14px 16px"><tr>${stepRows}
          </tr></table>
        </td></tr>

        <tr><td style="padding:18px 28px 0">
          <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:8px">Message to copy</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed #b6c2d4;border-radius:10px">
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e5e9f0;background:#fbfcfe;border-radius:10px 10px 0 0">
              <span style="font-size:12px;font-weight:700;color:#64748b">Subject:</span>
              <span style="font-size:15px;font-weight:700;color:#0f172a">${esc(m.subject)}</span>
            </td></tr>
            <tr><td style="padding:18px 18px 16px">
              ${customerMessageHtml(i)}
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:20px 28px 6px">
          <a href="${esc(mailtoHref(i))}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 26px;border-radius:9px">Open in my email app</a>
          <div style="font-size:12px;color:#64748b;margin-top:8px">On your phone this opens a new email with the message already filled in — just add ${esc(first)}'s address.${deliveryUrl ? ` It's also on the <a href="${esc(deliveryUrl)}" style="color:#64748b">delivery in Pulse</a>, with a Copy button.` : ''}</div>
        </td></tr>

        <tr><td style="padding:18px 28px 26px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8eb;border-left:4px solid #F0B94A;border-radius:8px">
            <tr><td style="padding:12px 16px;font-size:13.5px;line-height:1.55;color:#5b4a1f">
              <strong>${used ? 'Review tip' : 'Survey tip'}:</strong> ${esc(tip(i))}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:16px 28px 22px;border-top:1px solid #e5e9f0;font-size:11.5px;line-height:1.6;color:#94a3b8">
          Sent by Mahanex Pulse for ${esc(store)} because this delivery was marked Delivered.<br>
          Mahanex · Machine-Augmented Human Intelligence &amp; eXecution
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// A short confirmation that Pulse can reach someone's notification email.
export function testEmailHtml(name: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
      <tr><td style="background:#0B1430;padding:18px 28px"><div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.02em">Mahan<span style="color:#F0B94A">-Ex</span> <span style="font-style:italic;font-weight:700;color:#D4E1F7">Pulse</span></div></td></tr>
      <tr><td style="padding:26px 28px">
        <h1 style="margin:0 0 10px;font-size:20px;color:#0f172a">You're all set, ${esc(firstName(name))}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">This address is now connected to Pulse. Customer thank-you emails and other Pulse notifications will arrive here.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
