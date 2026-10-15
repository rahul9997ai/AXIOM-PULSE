import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CHECKIN_SLOTS, dealershipDateKey, formatDealershipTime, slotLabel } from '@/lib/checkins';
import type { FsmCheckin } from '@/lib/checkins';

const DAYS = 7;

// The last week of Finance Manager check-ins at one dealership, for GMs and
// Masters: every 9AM / 3PM / 8PM slot, confirmed (and when) or missed.
export default function CheckinLog({ dealershipId }: { dealershipId: string }) {
  const [fsms, setFsms] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<FsmCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const today = dealershipDateKey();
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('profiles').select('id, name').eq('dealership_id', dealershipId).eq('role', 'FSM').eq('pulse_enabled', true).order('name'),
      supabase.from('fsm_checkins').select('*').eq('dealership_id', dealershipId).gte('local_date', days[0]),
    ]).then(([{ data: f }, { data: c }]) => {
      setFsms((f as { id: string; name: string }[]) || []);
      setRows((c as FsmCheckin[]) || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealershipId, today]);

  return (
    <div className="card" id="checkins">
      <h3 style={{ marginTop: 0 }}>Delivery check-ins</h3>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4 }}>
        Finance Managers confirm at 9 AM, 3 PM and 8 PM that every work order sent in CDK is entered in Pulse.
        Missed check-ins are reported to GMs and Masters the next morning.
      </p>
      {loading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
      {!loading && fsms.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No Finance Managers at this dealership.</div>}
      <div style={{ display: 'grid', gap: 14 }}>
        {fsms.map((f) => {
          const mine = rows.filter((r) => r.fsm_id === f.id);
          const due = mine.filter((r) => r.local_date < today || r.confirmed_at);
          const confirmed = mine.filter((r) => r.confirmed_at).length;
          const missed = mine.filter((r) => !r.confirmed_at && r.local_date < today).length;
          return (
            <div key={f.id} style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <strong style={{ fontSize: 14 }}>{f.name}</strong>
                <span style={{ fontSize: 12.5, color: missed ? '#b42318' : 'var(--muted)', fontWeight: 700 }}>
                  {due.length ? `${confirmed}/${due.length} confirmed` : 'No check-ins yet'}{missed ? ` · ${missed} missed` : ''}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))`, gap: 4 }}>
                {days.map((day) => (
                  <div key={day} style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)' }}>
                      {new Date(`${day}T12:00:00Z`).toLocaleDateString([], { weekday: 'narrow', timeZone: 'UTC' })}
                      {new Date(`${day}T12:00:00Z`).getUTCDate()}
                    </span>
                    {CHECKIN_SLOTS.map(({ slot }) => {
                      const r = mine.find((x) => x.local_date === day && x.slot === slot);
                      const state = !r ? 'none' : r.confirmed_at ? 'ok' : day < today ? 'missed' : 'open';
                      const title = !r ? `${slotLabel(slot)} — not sent`
                        : r.confirmed_at ? `${slotLabel(slot)} — confirmed ${formatDealershipTime(r.confirmed_at)}`
                        : state === 'missed' ? `${slotLabel(slot)} — missed` : `${slotLabel(slot)} — awaiting confirmation`;
                      return <span key={slot} className={`checkin-mark is-${state}`} title={title} aria-label={title}>{state === 'ok' ? '✓' : state === 'missed' ? '✕' : ''}</span>;
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {fsms.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
          <span><span className="checkin-mark is-ok" style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}>✓</span>Confirmed</span>
          <span><span className="checkin-mark is-missed" style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}>✕</span>Missed</span>
          <span><span className="checkin-mark is-open" style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }} />Awaiting</span>
          <span style={{ marginLeft: 'auto' }}>Rows: 9 AM · 3 PM · 8 PM</span>
        </div>
      )}
    </div>
  );
}
