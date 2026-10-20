import { useEffect, useState } from 'react';
import type { Delivery } from '@/lib/types';
import { customerMessage, customerMessageHtml, customerMessageText, mailtoHref, thankYouInputFor, type ThankYouInput } from '@/lib/thankYou';

// The ready-to-send customer thank-you on a delivered vehicle, with Copy and
// "Open in my email app" — the same message that's emailed to the
// salesperson, available here whether or not they've set up their email.
export default function ThankYouCard({ delivery }: { delivery: Delivery }) {
  const [input, setInput] = useState<ThankYouInput | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'subject' | 'message' | null>(null);

  useEffect(() => {
    thankYouInputFor(delivery, delivery.salesperson_name ?? 'Your salesperson').then(({ input: i, enabled: on }) => {
      setInput(i);
      setEnabled(on);
    });
  }, [delivery]);

  if (!input || !enabled) return null;
  const message = customerMessage(input);
  const text = customerMessageText(input);
  const used = input.condition === 'used';

  // The message copies as rich text, so pasting into Gmail or Outlook keeps
  // "Write a Google review" as a clickable link instead of a long raw URL;
  // apps that only take plain text get the plain version.
  const copy = async (what: 'subject' | 'message') => {
    try {
      if (what === 'message' && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([customerMessageHtml(input)], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(what === 'subject' ? message.subject : text);
      }
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard blocked (e.g. an old in-app browser) — the message is still selectable below.
    }
  };

  return (
    <div className="card-3d tint-blue thankyou-card">
      <button type="button" className="thankyou-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem' }}>Customer thank-you email</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>
            {used ? 'Pre-owned · asks for a Google review and referrals' : 'New vehicle · asks them to complete the survey'}
          </div>
        </div>
        <span aria-hidden="true" style={{ fontSize: '1.125rem', color: 'var(--muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>

      {open && (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <p style={{ fontSize: '0.78125rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            Send this to {input.customerName.split(' ')[0]} from your own work email — copy it, or open it straight in your email app.
          </p>
          <div className="thankyou-subject">
            <span style={{ fontSize: '0.71875rem', fontWeight: 700, color: 'var(--muted)' }}>Subject</span>
            <span style={{ fontWeight: 700, fontSize: '0.84375rem', minWidth: 0, flex: 1 }}>{message.subject}</span>
            <button type="button" className="btn-3d" style={{ fontSize: '0.71875rem', padding: '4px 10px' }} onClick={() => copy('subject')}>
              {copied === 'subject' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="thankyou-body" dangerouslySetInnerHTML={{ __html: customerMessageHtml(input) }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" style={{ flex: '1 1 140px', fontSize: '0.875rem' }} onClick={() => copy('message')}>
              {copied === 'message' ? '✓ Message copied' : 'Copy message'}
            </button>
            <a className="btn secondary" style={{ flex: '1 1 140px', fontSize: '0.875rem', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} href={mailtoHref(input)}>
              Open in my email app
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
