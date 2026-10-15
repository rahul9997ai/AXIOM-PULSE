import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { confirmCheckin, dealershipMidnight, formatDealershipTime, slotLabel } from '@/lib/checkins';
import type { FsmCheckin } from '@/lib/checkins';

interface EnteredRow { id: string; customer_name: string; stock_number: string | null; created_at: string }

// Opened from a check-in notification (or the banner). Shows what the
// Finance Manager has entered today so they can sanity-check it against
// CDK, then records their confirmation with a timestamp.
export default function CheckinPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const [checkin, setCheckin] = useState<FsmCheckin | null>(null);
  const [entered, setEntered] = useState<EnteredRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !session) return;
    supabase.from('fsm_checkins').select('*').eq('id', id).maybeSingle().then(async ({ data }) => {
      const c = data as FsmCheckin | null;
      setCheckin(c);
      if (c) {
        const { data: rows } = await supabase
          .from('deliveries')
          .select('id, customer_name, stock_number, created_at')
          .eq('fsm_id', c.fsm_id)
          .gte('created_at', dealershipMidnight(c.local_date).toISOString())
          .order('created_at', { ascending: true });
        setEntered((rows as EnteredRow[]) || []);
      }
      setLoading(false);
    });
  }, [id, session]);

  const confirm = async () => {
    if (!checkin) return;
    setBusy(true);
    const { confirmedAt, error: err } = await confirmCheckin(checkin.id);
    setBusy(false);
    if (err) { setError(err); return; }
    setCheckin({ ...checkin, confirmed_at: confirmedAt ?? new Date().toISOString() });
  };

  if (loading) return <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>Loading…</div>;
  if (!checkin) {
    return (
      <div className="card-3d tint-blue" style={{ textAlign: 'center' }}>
        This check-in couldn't be found. <Link to="/">Back to deliveries</Link>
      </div>
    );
  }

  const isMine = checkin.fsm_id === session?.user.id;
  const dateLabel = new Date(`${checkin.local_date}T12:00:00Z`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card-3d tint-blue" style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {slotLabel(checkin.slot)} check-in · {dateLabel}
        </div>
        <h2 style={{ margin: 0, fontSize: 20 }}>Are all your deliveries entered?</h2>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          Every work order you've sent in CDK should have its delivery in Pulse, so the salesperson has the details right away.
          Your confirmation is recorded with the time.
        </p>
      </div>

      <div className="card-3d tint-blue" style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>
          Entered by you that day · {entered.length}
        </div>
        {entered.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No deliveries entered yet that day.</div>}
        {entered.map((d) => (
          <Link key={d.id} to={`/delivery/${d.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: 'inherit', textDecoration: 'none', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10 }}>
            <span style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.customer_name}{d.stock_number ? <span style={{ color: 'var(--muted)', fontWeight: 600 }}> · #{d.stock_number}</span> : null}
            </span>
            <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12.5 }}>
              entered {formatDealershipTime(d.created_at)}
            </span>
          </Link>
        ))}
      </div>

      {error && <div className="card-3d tint-blue" style={{ fontSize: 13, color: '#a3261b' }}>{error}</div>}

      {checkin.confirmed_at ? (
        <div className="card-3d tint-blue" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>
          ✓ Confirmed at {formatDealershipTime(checkin.confirmed_at)}
        </div>
      ) : isMine ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <button type="button" className="btn" disabled={busy} onClick={confirm}>
            {busy ? 'Confirming…' : 'Yes — every delivery is entered'}
          </button>
          <button type="button" className="btn secondary" onClick={() => navigate('/new')}>
            Not yet — enter a delivery now
          </button>
        </div>
      ) : (
        <div className="card-3d tint-blue" style={{ textAlign: 'center', fontWeight: 700, color: '#b45309' }}>
          Not confirmed
        </div>
      )}
    </div>
  );
}
