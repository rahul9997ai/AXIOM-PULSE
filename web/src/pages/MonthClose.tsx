import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Delivery, MonthClosure } from '@/lib/types';
import { monthLabel, monthRange, previousMonth } from '@/lib/monthClose';

interface ClosureWithFsm extends MonthClosure { fsm_name: string | null; }

export default function MonthClose() {
  const { profile } = useSession();
  const navigate = useNavigate();
  const isFsm = profile?.role === 'FSM';
  const isMaster = profile?.role === 'Master Administrator';

  useEffect(() => {
    if (profile && !isFsm && !isMaster) navigate('/', { replace: true });
  }, [profile, isFsm, isMaster, navigate]);

  if (isMaster) return <ReopenPanel />;
  if (isFsm) return <FsmClosePanel />;
  return null;
}

function FsmClosePanel() {
  const { profile, session } = useSession();
  const { year, month } = previousMonth();
  const label = monthLabel(year, month);

  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState<MonthClosure | null>(null);
  const [undelivered, setUndelivered] = useState<Delivery[]>([]);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const load = async () => {
      setLoading(true);
      const { start, end } = monthRange(year, month);
      const [{ data: closure }, { data: deliveries }] = await Promise.all([
        supabase.from('month_closures').select('*').eq('fsm_id', session.user.id).eq('year', year).eq('month', month).maybeSingle(),
        supabase
          .from('deliveries')
          .select('*, delivery_requirements(*)')
          .eq('fsm_id', session.user.id)
          .neq('status', 'delivered')
          .gte('delivery_at', start.toISOString())
          .lt('delivery_at', end.toISOString())
          .order('delivery_at', { ascending: true }),
      ]);
      setClosed((closure as MonthClosure | null) ?? null);
      setUndelivered((deliveries as Delivery[]) || []);
      setLoading(false);
    };
    load();
  }, [session, year, month]);

  const closeMonth = async () => {
    setClosing(true);
    setError(null);
    const { error } = await supabase.rpc('close_month', { p_year: year, p_month: month });
    setClosing(false);
    if (error) { setError(error.message); return; }
    setClosed({ id: '', dealership_id: profile?.dealership_id ?? '', fsm_id: session!.user.id, year, month, closed_at: new Date().toISOString(), closed_by: session!.user.id });
  };

  const outstandingCount = undelivered.reduce((n, d) => n + (d.delivery_requirements || []).filter((r) => r.status === 'outstanding').length, 0);

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <Link to="/" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>‹ Back to Deliveries</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Close {label}</h1>

      {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}

      {!loading && closed && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 6 }}>{label} is closed</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Closed {new Date(closed.closed_at).toLocaleString()}. Salespeople now see this reflected on their dashboard.
          </div>
        </div>
      )}

      {!loading && !closed && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Summary</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4 }}>
              Review what's still open from {label} before closing it. Closing doesn't change or lock any
              records — it's a confirmation that you've reviewed the month.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <SummaryTile label="Undelivered vehicles" value={undelivered.length} tone={undelivered.length > 0 ? 'warn' : 'ok'} />
              <SummaryTile label="Outstanding requirements" value={outstandingCount} tone={outstandingCount > 0 ? 'warn' : 'ok'} />
            </div>
          </div>

          {undelivered.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0, fontSize: 14 }}>Still not delivered</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {undelivered.map((d) => {
                  const open = (d.delivery_requirements || []).filter((r) => r.status === 'outstanding');
                  return (
                    <Link key={d.id} to={`/delivery/${d.id}`} style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                          {d.customer_name}{d.stock_number ? ` · Stock #${d.stock_number}` : ''}
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {new Date(d.delivery_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {open.length > 0 && (
                        <div style={{ color: '#b45309', fontSize: 12, marginTop: 2 }}>
                          Open: {open.map((r) => r.label).join(', ')}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {error && <div className="card" style={{ fontSize: 13, color: '#a3261b' }}>{error}</div>}

          <button className="btn" disabled={closing} onClick={closeMonth}>
            {closing ? 'Closing…' : `Close ${label}`}
          </button>
        </>
      )}
    </div>
  );
}

function ReopenPanel() {
  const [rows, setRows] = useState<ClosureWithFsm[]>([]);
  const [loading, setLoading] = useState(true);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('month_closures')
      .select('*, profiles!month_closures_fsm_id_fkey(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    const list = ((data as (MonthClosure & { profiles: { name: string } | null })[]) || [])
      .map((r) => ({ ...r, fsm_name: r.profiles?.name ?? null }));
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reopen = async (c: ClosureWithFsm) => {
    if (!window.confirm(`Reopen ${monthLabel(c.year, c.month)} for ${c.fsm_name ?? 'this Finance Manager'}? They'll be prompted to close it again.`)) return;
    setReopeningId(c.id);
    const { error } = await supabase.rpc('reopen_month', { p_closure_id: c.id });
    setReopeningId(null);
    if (error) { setNotice(error.message); return; }
    setNotice(`${monthLabel(c.year, c.month)} reopened for ${c.fsm_name ?? 'that Finance Manager'}.`);
    load();
  };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <Link to="/" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>‹ Back to Deliveries</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Closed Months</h1>
      {notice && <div className="card" style={{ fontSize: 13 }}>{notice}</div>}
      <div className="card">
        {loading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
        {!loading && rows.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No months have been closed yet.</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{monthLabel(c.year, c.month)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {c.fsm_name ?? 'Unknown FSM'} · closed {new Date(c.closed_at).toLocaleDateString()}
                </div>
              </div>
              <button type="button" className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={reopeningId === c.id} onClick={() => reopen(c)}>
                {reopeningId === c.id ? 'Reopening…' : 'Reopen'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' }) {
  const color = tone === 'warn' && value > 0 ? '#b45309' : '#15803d';
  return (
    <div className="card" style={{ flex: 1, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
    </div>
  );
}
