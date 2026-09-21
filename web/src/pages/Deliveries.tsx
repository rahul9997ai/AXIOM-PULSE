import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Delivery } from '@/lib/types';
import { STATUS_LABEL, STATUS_COLOR, MANAGER_ROLES, ROLE_LABEL } from '@/lib/types';
import { formatCents } from '@/lib/money';
import { CalendarIcon, PinIcon, DollarIcon, CarIcon, CheckCircleIcon, AlertIcon, CircleIcon } from '@/components/Icons';
import AdminHome from './AdminHome';
import PushCard from '@/components/PushCard';

export default function Deliveries() {
  const { profile, session } = useSession();
  const { isMaster, actingRole, actingDealershipId, isAdminMode } = useActingRole();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [exceptionFor, setExceptionFor] = useState<string | null>(null);
  const [exceptionReason, setExceptionReason] = useState('');
  const [tab, setTab] = useState<'active' | 'delivered'>('active');
  const [notifyFor, setNotifyFor] = useState<string | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');

  // A Master Administrator has no operational role of their own — the delivery
  // board only makes sense once they've chosen a role+dealership to preview.
  const effectiveRole = isMaster ? actingRole : profile?.role;
  const isManager = effectiveRole ? MANAGER_ROLES.includes(effectiveRole) : false;

  const load = useCallback(async () => {
    if (!profile || isAdminMode) return;
    let query = supabase
      .from('deliveries')
      .select('*, delivery_requirements(*), lenders(name, address)')
      .order('delivery_at', { ascending: true });
    if (isMaster) {
      if (!actingDealershipId) { setRows([]); setLoading(false); return; }
      query = query.eq('dealership_id', actingDealershipId);
    } else if (!isManager) {
      query = query.eq('salesperson_id', session?.user.id);
    }
    const { data, error } = await query;
    if (!error) setRows((data as Delivery[]) || []);
    setLoading(false);
  }, [profile, isManager, isMaster, isAdminMode, actingDealershipId, session?.user.id]);

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

  const sendUrgentNotify = async (d: Delivery) => {
    const open = (d.delivery_requirements || []).filter((r) => r.status === 'outstanding').map((r) => r.label);
    const body = notifyMessage.trim() || (open.length
      ? `Still needed: ${open.join(', ')}.`
      : `Please check the ${d.customer_name} delivery.`);
    const { data, error } = await supabase.functions.invoke('send-webpush', {
      body: {
        profile_ids: [d.salesperson_id],
        title: `Urgent: ${d.customer_name}`,
        body,
        data: { url: '/', deliveryId: d.id, type: 'urgent' },
      },
    });
    if (error) {
      setNotice(error.message);
    } else if (!data?.sent) {
      setNotice(
        `Sent, but the salesperson has no device enrolled for push yet. On iPhone, they need iOS 16.4+, ` +
        `Pulse added to the Home Screen (not just a Safari tab), opened from that icon, and "Enable notifications" tapped in the app.`,
      );
    } else {
      setNotice(`Notification sent to ${data.sent} device(s).`);
    }
    setNotifyFor(null);
    setNotifyMessage('');
  };

  const active = rows.filter((d) => d.status !== 'delivered');
  const visible = (tab === 'delivered' ? rows.filter((d) => d.status === 'delivered') : active)
    .sort((a, b) => tab === 'delivered'
      ? new Date(b.delivered_at ?? b.delivery_at).getTime() - new Date(a.delivered_at ?? a.delivery_at).getTime()
      : new Date(a.delivery_at).getTime() - new Date(b.delivery_at).getTime());

  const outstandingCount = active.filter((d) => (d.delivery_requirements || []).some((r) => r.status === 'outstanding')).length;

  if (isAdminMode) return <AdminHome />;

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Deliveries</h1>
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
          {effectiveRole ? ROLE_LABEL[effectiveRole] : ''}{isMaster ? ' (previewed by Master Administrator)' : ''}
        </div>
      </div>

      {isManager && !loading && (
        <div style={{ display: 'flex', gap: 10 }}>
          <StatTile label="Active" value={active.length} />
          <StatTile label="Outstanding" value={outstandingCount} tone={outstandingCount > 0 ? 'warn' : 'ok'} />
          <StatTile label="Delivered" value={rows.filter((d) => d.status === 'delivered').length} />
        </div>
      )}

      {!isManager && <PushCard />}
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
        const sc = STATUS_COLOR[d.status];

        return (
          <div key={d.id} className="card" style={{ borderLeft: `4px solid ${sc.border}`, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{d.customer_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', marginTop: 4, fontSize: 13.5 }}>
                  <CarIcon size={14} />
                  {d.vehicle}{d.vin ? ` · VIN ${d.vin}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
                  background: sc.bg, color: sc.fg, padding: '4px 10px', borderRadius: 999,
                }}>
                  {STATUS_LABEL[d.status]}
                </span>
                {isManager && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/edit/${d.id}`} className="btn secondary" style={{ textDecoration: 'none', padding: '3px 10px', fontSize: 11 }}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ padding: '3px 10px', fontSize: 11 }}
                      onClick={() => { setNotifyFor(notifyFor === d.id ? null : d.id); setNotifyMessage(''); }}
                    >
                      Notify
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ padding: '3px 10px', fontSize: 11, borderColor: '#dc2626', color: '#dc2626' }}
                      onClick={() => deleteDelivery(d)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', marginTop: 10, fontSize: 13.5 }}>
              <CalendarIcon />
              {new Date(d.delivery_at).toLocaleString()}
            </div>
            {d.status === 'delivered' && d.delivered_at && (
              <div style={{ color: '#15803d', fontSize: 13, fontWeight: 700, marginTop: 4, marginLeft: 21 }}>
                Delivered {new Date(d.delivered_at).toLocaleString()}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, fontSize: 13.5 }}>
              <span style={{ color: 'var(--muted)', marginTop: 1 }}><PinIcon /></span>
              <div>
                {d.lenders?.name || 'Lender / lessor not selected'}
                {d.lenders?.address && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(d.lenders.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', color: 'var(--accent)', fontSize: 12.5, marginTop: 1, textDecoration: 'none' }}
                  >
                    {d.lenders.address}
                  </a>
                )}
              </div>
            </div>

            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', marginLeft: 21 }}>
              Approval: <strong style={{ color: 'var(--text)' }}>{d.approval_status}</strong>
            </div>

            {d.due_on_delivery && d.due_on_delivery_amount_cents != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13.5 }}>
                <span style={{ color: 'var(--muted)' }}><DollarIcon /></span>
                {d.due_on_delivery_type === 'refund' ? 'Refund to customer' : 'Collect from customer'}: <strong>{formatCents(d.due_on_delivery_amount_cents)}</strong>
              </div>
            )}
            {d.fsm_notes && (
              <div style={{ marginTop: 10, fontSize: 13, fontStyle: 'italic', color: 'var(--muted)' }}>“{d.fsm_notes}”</div>
            )}

            {requirements.length > 0 && (
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {requirements.map((r) => {
                  const color = r.status === 'completed' ? '#15803d' : r.status === 'exception' ? '#b45309' : 'var(--accent)';
                  const ReqIcon = r.status === 'completed' ? CheckCircleIcon : r.status === 'exception' ? AlertIcon : CircleIcon;
                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color, fontWeight: 700 }}>
                        <ReqIcon />
                        {r.label}
                        {r.status === 'exception' && r.exception_reason ? ` — ${r.exception_reason}` : ''}
                      </span>
                      {!isManager && r.status === 'outstanding' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => resolveRequirement(r.id, 'completed')}>Done</button>
                          <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setExceptionFor(r.id)}>Exception</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {notifyFor === d.id && (
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <textarea
                  placeholder="Urgent message to the salesperson (optional — defaults to outstanding requirements)"
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={2}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => sendUrgentNotify(d)}>
                    Send urgent notification
                  </button>
                  <button className="btn secondary" onClick={() => { setNotifyFor(null); setNotifyMessage(''); }}>Cancel</button>
                </div>
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

function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' && value > 0 ? '#b45309' : tone === 'ok' ? '#15803d' : 'var(--ink)';
  return (
    <div className="card" style={{ flex: 1, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
    </div>
  );
}
