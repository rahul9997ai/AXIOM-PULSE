import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { saveNotifyEmail, sendTestEmail } from '@/lib/thankYou';

// Everyone's own "where Pulse emails me" address — separate from how they
// sign in. Salespeople need it to receive their customer thank-you drafts.
export default function NotifyEmailCard() {
  const { profile, refresh } = useSession();
  const saved = profile?.notify_email ?? '';
  const [email, setEmail] = useState(saved);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const location = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setEmail(saved), [saved]);

  // Arriving from the home-screen "Add your work email" banner.
  useEffect(() => {
    if (location.hash !== '#email' || !cardRef.current) return;
    cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cardRef.current.querySelector('input')?.focus({ preventScroll: true });
  }, [location.hash, profile?.id]);

  if (!profile) return null;
  const dirty = email.trim().toLowerCase() !== saved;

  const save = async () => {
    setBusy('save');
    setMessage(null);
    const err = await saveNotifyEmail(profile.id, email);
    if (err) { setBusy(null); setMessage({ ok: false, text: err }); return; }
    await refresh();
    if (!email.trim()) { setBusy(null); setMessage({ ok: true, text: 'Removed.' }); return; }
    // Send the test straight away so a typo shows up now, not on the next delivery.
    setBusy('test');
    const testErr = await sendTestEmail();
    setBusy(null);
    setMessage(testErr ? { ok: false, text: `Saved, but the test email failed: ${testErr}` } : { ok: true, text: `Saved — a test email is on its way to ${email.trim().toLowerCase()}.` });
  };

  const test = async () => {
    setBusy('test');
    setMessage(null);
    const err = await sendTestEmail();
    setBusy(null);
    setMessage(err ? { ok: false, text: err } : { ok: true, text: `Test email sent to ${saved}. Check your inbox (and junk folder).` });
  };

  return (
    <div className="card" id="email" ref={cardRef}>
      <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, marginBottom: 6 }}>WORK EMAIL</div>
      <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
        {profile.role === 'Salesperson'
          ? 'Where Pulse sends your ready-to-send customer thank-you emails after each delivery. This doesn\'t change how you sign in.'
          : 'Where Pulse sends your emails. This doesn\'t change how you sign in.'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@dealership.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: '1 1 220px', minWidth: 0 }}
        />
        {dirty ? (
          <button type="button" className="btn" disabled={busy !== null} onClick={save}>
            {busy === 'save' ? 'Saving…' : busy === 'test' ? 'Sending test…' : 'Save'}
          </button>
        ) : saved ? (
          <button type="button" className="btn secondary" disabled={busy !== null} onClick={test}>
            {busy === 'test' ? 'Sending…' : 'Send test email'}
          </button>
        ) : null}
      </div>
      {message && (
        <p style={{ fontSize: '0.78125rem', marginTop: 10, marginBottom: 0, color: message.ok ? 'var(--banner-ok-fg)' : '#a3261b', fontWeight: 600 }}>{message.text}</p>
      )}
    </div>
  );
}
