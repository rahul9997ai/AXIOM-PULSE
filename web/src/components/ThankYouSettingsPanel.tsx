import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { loadThankYouSettings, saveNotifyEmail, type ThankYouSettings } from '@/lib/thankYou';

interface TeamMember { id: string; name: string; role: string; notify_email: string | null }

const ROLE_ORDER = ['Salesperson', 'FSM', 'Sales Manager', 'General Manager'];
const ROLE_LABEL: Record<string, string> = { Salesperson: 'Salesperson', FSM: 'Finance Manager', 'Sales Manager': 'Sales Manager', 'General Manager': 'General Manager' };

// GM / Master control over customer thank-you emails: on or off, the Google
// review link used for pre-owned deliveries, an optional work-domain rule,
// and everyone's notification email in one place.
export default function ThankYouSettingsPanel({ dealershipId }: { dealershipId: string }) {
  const { session } = useSession();
  const [settings, setSettings] = useState<ThankYouSettings | null>(null);
  const [reviewUrl, setReviewUrl] = useState('');
  const [domain, setDomain] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowState, setRowState] = useState<Record<string, { saving?: boolean; saved?: boolean; error?: string }>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSettings(null);
    loadThankYouSettings(dealershipId).then((s) => {
      setSettings(s);
      setReviewUrl(s.google_review_url ?? '');
      setDomain(s.email_domain ?? '');
    });
    supabase.from('profiles').select('id, name, role, notify_email')
      .eq('dealership_id', dealershipId).eq('pulse_enabled', true).in('role', ROLE_ORDER).order('name')
      .then(({ data }) => {
        const list = ((data as TeamMember[]) || []).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
        setTeam(list);
        setDrafts(Object.fromEntries(list.map((m) => [m.id, m.notify_email ?? ''])));
      });
  }, [dealershipId]);

  const save = async (patch: Partial<ThankYouSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setError(null);
    const { error: err } = await supabase.from('thankyou_settings').upsert({
      dealership_id: dealershipId,
      enabled: next.enabled,
      google_review_url: next.google_review_url?.trim() || null,
      email_domain: next.email_domain?.trim().replace(/^@/, '').toLowerCase() || null,
      updated_at: new Date().toISOString(),
      updated_by: session?.user.id ?? null,
    });
    if (err) { setError(err.message); return; }
    setStatus('✓ Saved');
    setTimeout(() => setStatus(null), 1800);
  };

  const saveMember = async (m: TeamMember) => {
    const value = (drafts[m.id] ?? '').trim().toLowerCase();
    if (value === (m.notify_email ?? '')) return;
    setRowState((s) => ({ ...s, [m.id]: { saving: true } }));
    const err = await saveNotifyEmail(m.id, value);
    if (err) { setRowState((s) => ({ ...s, [m.id]: { error: err } })); return; }
    setTeam((t) => t.map((x) => (x.id === m.id ? { ...x, notify_email: value || null } : x)));
    setDrafts((d) => ({ ...d, [m.id]: value }));
    setRowState((s) => ({ ...s, [m.id]: { saved: true } }));
    setTimeout(() => setRowState((s) => ({ ...s, [m.id]: {} })), 1800);
  };

  if (!settings) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Customer thank-you emails</h2>
        <div style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Loading…</div>
      </div>
    );
  }

  const salespeople = team.filter((m) => m.role === 'Salesperson');
  const connected = salespeople.filter((m) => m.notify_email).length;

  return (
    <div className="card" id="thank-you" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>Customer thank-you emails</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', margin: '6px 0 0', lineHeight: 1.5 }}>
            When a delivery is marked delivered, the salesperson is emailed a ready-to-send thank-you to forward from their own work email —
            asking new-vehicle buyers to complete the manufacturer survey, and pre-owned buyers for a Google review and referrals.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label={`Customer thank-you emails ${settings.enabled ? 'on' : 'off'}`}
          className={`switch${settings.enabled ? ' is-on' : ''}`}
          onClick={() => save({ enabled: !settings.enabled })}
        >
          <span className="switch-knob" />
        </button>
      </div>

      <fieldset disabled={!settings.enabled} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, opacity: settings.enabled ? 1 : 0.5 }}>
        <label className="field-label">
          Google review link (pre-owned)
          <input
            type="url"
            placeholder="https://g.page/r/…/review"
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            onBlur={() => reviewUrl.trim() !== (settings.google_review_url ?? '') && save({ google_review_url: reviewUrl })}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--muted)' }}>
            From your Google Business Profile → “Ask for reviews”. Without it, customers are told to search the dealership on Google.
          </span>
        </label>
        <label className="field-label">
          Only accept work emails ending in
          <input
            placeholder="401dixienissan.com (blank = any address)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onBlur={() => domain.trim().replace(/^@/, '').toLowerCase() !== (settings.email_domain ?? '') && save({ email_domain: domain })}
          />
        </label>

        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
            Team work emails · {connected} of {salespeople.length} salespeople connected
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {team.map((m) => {
              const st = rowState[m.id] ?? {};
              return (
                <div key={m.id} className="team-email-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84375rem' }}>{m.name}</div>
                    <div style={{ fontSize: '0.71875rem', color: st.error ? '#a3261b' : 'var(--muted)' }}>
                      {st.error ?? (st.saving ? 'Saving…' : st.saved ? '✓ Saved' : ROLE_LABEL[m.role] ?? m.role)}
                    </div>
                  </div>
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="Not set"
                    aria-label={`${m.name}'s work email`}
                    value={drafts[m.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                    onBlur={() => saveMember(m)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>

      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: error ? '#a3261b' : 'var(--muted)', minHeight: 16 }}>
        {error ?? status ?? (settings.enabled ? 'On — sent shortly after each delivery is marked delivered.' : 'Off — no thank-you emails are being sent.')}
      </div>
    </div>
  );
}
