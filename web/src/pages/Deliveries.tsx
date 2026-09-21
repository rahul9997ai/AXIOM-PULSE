import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Delivery } from '@/lib/types';
import { STATUS_LABEL, MANAGER_ROLES } from '@/lib/types';
import { formatCents } from '@/lib/money';
import { enablePush, isStandaloneDisplay, isIOS, pushSupported, sendTestPush } from '@/lib/push';

export default function Deliveries() {
  const { profile, session } = useSession();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushState, setPushState] = useState<'unsupported' | 'ios-install' | 'offer' | 'enabled'>('offer');
  const [notice, setNotice] = useState<string | null>(null);
  const [exceptionFor, setExceptionFor] = useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [tab, setTab] = useState<'active' | 'delivered'>('active');

  const isManager = profile ? MANAGER_ROLES.includes(profile.role) : false;

  const load = useCallback(async () => {
    if (!profile) return;
    let query = supabase
      .from('deliveries')
      .select('*, delivery_requirements(*), lenders(name, address)')
      .order('delivery_at', { ascending: true });
    if (!isManager) query = query.eq('salesperson_id', session?.user.id);
    const { data, error } = await query;
    if (!error) setRows((data as Delivery[]) || []);
    setLoading(false);
  }, [profile, isManager, session?.user.id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: any change to deliveries or their requirements refreshes the list,
  // so the FSM sees salesperson progress and the salesperson sees FSM edits live.
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('pulse-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requirements' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, load]);

  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    if (isIOS() && !isStandaloneDisplay()) { setPushState('ios-install'); return; }
    if (Notification.permission === 'granted') { setPushState('enabled'); return; }
    setPushState('offer');
  }, []);

  const resolveRequirement = async (id: string, status: 'completed' | 'exception', reason?: string) => {
    const { error } = await supabase.rpc('set_requirement_status', {
      p_requirement_id: id,
      p_status: status,
      p_exception_reason: reason ?? null,
    });
    if (error) setNotice(error.message);
    else { setExceptionFor(null); setExceptionReason(''); load(); }
  };

  const complete = async (id: string) => {
    const { error } = await supabase.rpc('complete_delivery', { p_delivery_id: id });
    if (error) setNotice(error.message);
    else load();
  };

  const deleteDelivery = async (d: Delivery) => {
    if (!window.confirm(`Permanently delete the delivery record for ${d.customer_name}? This can't be undone.`)) return;
    const { error } = await supabase.from('deliveries').delete().eq('id', d.id);
    if (error) setNotice(error.message);
    else load();
  };

  const onEnablePush = async () => {
    try { await enablePush(); setPushState('enabled'); setNotice('Notifications enabled. Delivery reminders arrive even when Pulse is closed.'); }
    catch (e) { setNotice((e as Error).message); }
  };

  const onTestPush = async () => {
    try { const { sent } = await sendTestPush(); setNotice(`Test notification sent to ${sent} device(s). Close the app to verify background delivery.`); }
    catch (e) { setNotice((e as Error).message); }
  };

  const visible = rows
    .filter((d) => (tab === 'delivered' ? d.status === 'delivered' : d.status !== 'delivered'))
    .sort((a, b) => tab === 'delivered'
      ? new Date(b.delivered_at ?? b.delivery_at).getTime() - new Date(a.delivered_at ?? a.delivery_at).getTime()
      : new Date(a.delivery_at).getTime() - new Date(b.delivery_at).getTime());

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Deliveries</h1>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
          {isManager ? 'Manager view' : 'Salesperson view'}
        </div>
      </div>

      {!isManager && pushState === 'offer' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Enable Delivery Notifications</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Get reminded of upcoming deliveries even when Pulse is closed.</p>
          <button className="btn" onClick={onEnablePush}>Enable notifications</button>
        </div>
      )}
      {!isManager && pushState === 'ios-install' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Enable Delivery Notifications</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            On iPhone/iPad, add Axiom Pulse to your Home Screen first, then open it from there to enable notifications.
          </p>
        </div>
      )}
      {!isManager && pushState === 'enabled' && (
        <div className="card">
          <div style={{ color: '#15803d', fontWeight: 700, fontSize: 13 }}>Background push enabled on this device.</div>
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={onTestPush}>Send test notification</button>
        </div>
      )}
      {notice && <div className="card" style={{ fontSize: 13 }}>{notice}</div>}

      <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', borderRadius: 12, padding: 4 }}>
        {(['active', 'delivered'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, border: 'none', borderRadius: 9, padding: '8px 0', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab === t ? '0 1px 3px rgba(20,50,100,0.12)' : 'none',
            }}
          >
            {t === 'active' ? 'Active' : 'Delivered'}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
      {!loading && visible.length === 0 && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>
          {tab === 'delivered' ? 'No delivered units yet.' : 'No deliveries scheduled yet.'}
        </div>
      )}

      {visible.map((d) => {
        const requirements = d.delivery_requirements || [];
        const open = requirements.filter((r) => r.status === 'outstanding');
        const canComplete = !isManager && d.status !== 'delivered' && d.status !== 'cancelled';

        return (
          <div key={d.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{d.customer_name}</div>
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>{d.vehicle}{d.vin ? ` · VIN ${d.vin}` : ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {STATUS_LABEL[d.status]}
                </span>
                {isManager && d.status !== 'delivered' && d.status !== 'cancelled' && (
                  <Link to={`/edit/${d.id}`} className="btn secondary" style={{ textDecoration: 'none', padding: '3px 10px', fontSize: 11 }}>
                    Edit
                  </Link>
                )}
                {isManager && d.status === 'delivered' && (
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: '3px 10px', fontSize: 11, borderColor: '#dc2626', color: '#dc2626' }}
                    onClick={() => deleteDelivery(d)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 8 }}>{new Date(d.delivery_at).toLocaleString()}</div>
            {d.status === 'delivered' && d.delivered_at && (
              <div style={{ color: '#15803d', fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                Delivered {new Date(d.delivered_at).toLocaleString()}
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              {d.lenders?.name || 'Lender / lessor not selected'}
              {d.lenders?.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(d.lenders.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', color: 'var(--accent)', fontSize: 13, marginTop: 2, textDecoration: 'none' }}
                >
                  {d.lenders.address}
                </a>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
              Approval: <strong style={{ color: 'var(--text)' }}>{d.approval_status}</strong>
            </div>
            {d.due_on_delivery && d.due_on_delivery_amount_cents != null && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                {d.due_on_delivery_type === 'refund' ? 'Refund to customer' : 'Collect from customer'}: <strong>{formatCents(d.due_on_delivery_amount_cents)}</strong>
              </div>
            )}
            {d.fsm_notes && (
              <div style={{ marginTop: 10, fontSize: 13, fontStyle: 'italic', color: 'var(--muted)' }}>“{d.fsm_notes}”</div>
            )}

            {requirements.length > 0 && (
              <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                {requirements.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 13,
                      color: r.status === 'completed' ? '#15803d' : r.status === 'exception' ? '#b45309' : 'var(--accent)',
                      fontWeight: 700,
                    }}>
                      {r.status === 'completed' ? '✓' : r.status === 'exception' ? '!' : '•'} {r.label}
                      {r.status === 'exception' && r.exception_reason ? ` — ${r.exception_reason}` : ''}
                    </span>
                    {!isManager && r.status === 'outstanding' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => resolveRequirement(r.id, 'completed')}>Done</button>
                        <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setExceptionFor(r.id)}>Exception</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {exceptionFor && requirements.some((r) => r.id === exceptionFor) && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <textarea
                  placeholder="Reason this couldn't be completed"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  rows={2}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn"
                    style={{ flex: 1 }}
                    disabled={!exceptionReason.trim()}
                    onClick={() => resolveRequirement(exceptionFor, 'exception', exceptionReason.trim())}
                  >
                    Save exception
                  </button>
                  <button className="btn secondary" onClick={() => { setExceptionFor(null); setExceptionReason(''); }}>Cancel</button>
                </div>
              </div>
            )}

            {canComplete && open.length === 0 && (
              <button className="btn" style={{ marginTop: 14, width: '100%' }} onClick={() => complete(d.id)}>
                Mark delivered
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
