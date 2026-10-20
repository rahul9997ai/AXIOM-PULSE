import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

type Channel = 'push' | 'email';

interface Setting {
  dealership_id: string;
  channel: Channel;
  enabled: boolean;
  send_time: string; // 'HH:MM' or 'HH:MM:SS'
  days: number[]; // ISO weekdays, 1 = Monday
  excluded_ids: string[];
}

// Mirrors the defaults in the delivery-reminders function, used until a GM
// saves their own schedule for the dealership.
const DEFAULTS: Record<Channel, Omit<Setting, 'dealership_id' | 'channel'>> = {
  push: { enabled: true, send_time: '15:00', days: [1, 2, 3, 4, 5, 6], excluded_ids: [] },
  email: { enabled: true, send_time: '16:00', days: [1, 2, 3, 4, 5, 6], excluded_ids: [] },
};

const WEEKDAYS: { iso: number; short: string; long: string }[] = [
  { iso: 1, short: 'Mon', long: 'Monday' },
  { iso: 2, short: 'Tue', long: 'Tuesday' },
  { iso: 3, short: 'Wed', long: 'Wednesday' },
  { iso: 4, short: 'Thu', long: 'Thursday' },
  { iso: 5, short: 'Fri', long: 'Friday' },
  { iso: 6, short: 'Sat', long: 'Saturday' },
  { iso: 7, short: 'Sun', long: 'Sunday' },
];

const CHANNEL_COPY: Record<Channel, { title: string; blurb: string }> = {
  push: { title: 'Push notification', blurb: 'A short, personal reminder on their phone to enter any missed deliveries.' },
  email: { title: 'Email', blurb: 'One professional reminder email explaining why timely entry matters, with the deliveries they entered that day.' },
};

// GM / Master control over the Finance Managers' daily "enter today's
// deliveries" reminders: on or off, what time, which days and who receives
// them — separately for push and email.
export default function ReminderSettings({ dealershipId }: { dealershipId: string }) {
  const { session } = useSession();
  const [settings, setSettings] = useState<Record<Channel, Setting> | null>(null);
  const [fsms, setFsms] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState<Channel | null>(null);
  const [savedAt, setSavedAt] = useState<Record<Channel, boolean>>({ push: false, email: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSettings(null);
    Promise.all([
      supabase.from('fsm_reminder_settings').select('*').eq('dealership_id', dealershipId),
      supabase.from('profiles').select('id, name').eq('dealership_id', dealershipId).eq('role', 'FSM').eq('pulse_enabled', true).order('name'),
    ]).then(([{ data: rows }, { data: people }]) => {
      const byChannel = (c: Channel): Setting => {
        const row = ((rows as Setting[]) || []).find((r) => r.channel === c);
        return { dealership_id: dealershipId, channel: c, ...DEFAULTS[c], ...(row ?? {}), send_time: (row?.send_time ?? DEFAULTS[c].send_time).slice(0, 5) };
      };
      setSettings({ push: byChannel('push'), email: byChannel('email') });
      setFsms((people as { id: string; name: string }[]) || []);
    });
  }, [dealershipId]);

  const save = async (next: Setting) => {
    setSettings((s) => (s ? { ...s, [next.channel]: next } : s));
    setSaving(next.channel);
    setError(null);
    const { error: err } = await supabase.from('fsm_reminder_settings').upsert({
      dealership_id: next.dealership_id,
      channel: next.channel,
      enabled: next.enabled,
      send_time: next.send_time,
      days: next.days,
      excluded_ids: next.excluded_ids,
      updated_at: new Date().toISOString(),
      updated_by: session?.user.id ?? null,
    });
    setSaving(null);
    if (err) { setError(err.message); return; }
    setSavedAt((s) => ({ ...s, [next.channel]: true }));
    setTimeout(() => setSavedAt((s) => ({ ...s, [next.channel]: false })), 2000);
  };

  if (!settings) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Finance Manager reminders</h2>
        <div style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="card" id="reminders" style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0 }}>Finance Manager reminders</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', margin: '6px 0 0', lineHeight: 1.5 }}>
          A daily reminder to enter every delivery from that day's CDK 180 work orders in Pulse. Choose when each is sent and who receives it. Times are Eastern.
        </p>
      </div>

      {(['push', 'email'] as Channel[]).map((c) => {
        const s = settings[c];
        const recipients = fsms.filter((f) => !s.excluded_ids.includes(f.id)).length;
        return (
          <div key={c} className="reminder-panel">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.90625rem' }}>{CHANNEL_COPY[c].title}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.78125rem', marginTop: 2, lineHeight: 1.45 }}>{CHANNEL_COPY[c].blurb}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={s.enabled}
                aria-label={`${CHANNEL_COPY[c].title} reminders ${s.enabled ? 'on' : 'off'}`}
                className={`switch${s.enabled ? ' is-on' : ''}`}
                onClick={() => save({ ...s, enabled: !s.enabled })}
              >
                <span className="switch-knob" />
              </button>
            </div>

            <fieldset disabled={!s.enabled} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, opacity: s.enabled ? 1 : 0.5 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Send at
                  <input
                    type="time"
                    step={900}
                    value={s.send_time}
                    onChange={(e) => e.target.value && save({ ...s, send_time: e.target.value })}
                    style={{ width: 'auto', padding: '6px 8px' }}
                  />
                </label>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>On these days</div>
                <div className="chip-row" role="group" aria-label={`${CHANNEL_COPY[c].title} days`}>
                  {WEEKDAYS.map((d) => {
                    const on = s.days.includes(d.iso);
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        className={`chip${on ? ' is-active' : ''}`}
                        aria-pressed={on}
                        aria-label={d.long}
                        onClick={() => save({ ...s, days: on ? s.days.filter((x) => x !== d.iso) : [...s.days, d.iso].sort() })}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                  Who receives it · {recipients} of {fsms.length}
                </div>
                {fsms.length === 0 && <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>No Finance Managers at this dealership.</div>}
                <div style={{ display: 'grid', gap: 6 }}>
                  {fsms.map((f) => {
                    const on = !s.excluded_ids.includes(f.id);
                    return (
                      <label key={f.id} className="recipient-row">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => save({ ...s, excluded_ids: on ? [...s.excluded_ids, f.id] : s.excluded_ids.filter((x) => x !== f.id) })}
                          style={{ width: 'auto' }}
                        />
                        <span>{f.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', minHeight: 16 }}>
              {saving === c ? 'Saving…' : savedAt[c] ? '✓ Saved' : summary(s, recipients)}
            </div>
          </div>
        );
      })}

      {error && <div style={{ fontSize: '0.8125rem', color: '#a3261b' }}>{error}</div>}
    </div>
  );
}

function summary(s: Setting, recipients: number): string {
  if (!s.enabled) return 'Off — not being sent.';
  if (!s.days.length) return 'No days selected — not being sent.';
  const [h, m] = s.send_time.split(':').map(Number);
  const time = new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const days = s.days.length === 7 ? 'every day'
    : s.days.join(',') === '1,2,3,4,5,6' ? 'Monday to Saturday'
    : s.days.join(',') === '1,2,3,4,5' ? 'Monday to Friday'
    : s.days.map((d) => WEEKDAYS.find((w) => w.iso === d)?.short).join(', ');
  return `Sent at ${time}, ${days}, to ${recipients} Finance Manager${recipients === 1 ? '' : 's'}.`;
}
