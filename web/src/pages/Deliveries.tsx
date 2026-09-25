import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Delivery } from '@/lib/types';
import { STATUS_LABEL, STATUS_COLOR, MANAGER_ROLES, ROLE_LABEL } from '@/lib/types';
import { CalendarIcon, PinIcon } from '@/components/Icons';
import AdminHome from './AdminHome';

export default function Deliveries() {
  const { profile, session } = useSession();
  const { isMaster, actingRole, actingDealershipId, isAdminMode } = useActingRole();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'delivered'>('active');
  const [customerFilter, setCustomerFilter] = useState('');
  const [fsmFilter, setFsmFilter] = useState('');
  const [salespersonFilter, setSalespersonFilter] = useState('');

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

  const active = rows.filter((d) => d.status !== 'delivered');
  // A salesperson's Deliveries tab is "what's on today" — anything else is a
  // calendar lookup away, on the Calendar tab.
  const todayKey = new Date().toDateString();
  const todaysActive = !isManager ? active.filter((d) => new Date(d.delivery_at).toDateString() === todayKey) : active;
  const visibleAll = (tab === 'delivered' ? rows.filter((d) => d.status === 'delivered') : todaysActive)
    .sort((a, b) => tab === 'delivered'
      ? new Date(b.delivered_at ?? b.delivery_at).getTime() - new Date(a.delivered_at ?? a.delivery_at).getTime()
      : new Date(a.delivery_at).getTime() - new Date(b.delivery_at).getTime());
  // Someone with several deliveries on different dates can pick one customer
  // and see just that delivery instead of scrolling the whole list.
  const customerNames = Array.from(new Set(rows.map((d) => d.customer_name))).sort();
  // Master-only: see every dealership's deliveries at once, or narrow to one
  // finance manager (including their own, when they created deliveries
  // directly) — nobody else gets this filter.
  const fsmOptions = isMaster
    ? Array.from(new Map(rows.map((d) => [d.fsm_id, d.fsm_name || 'Unknown'])).entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
    : [];
  const salespersonOptions = isMaster
    ? Array.from(new Map(rows.map((d) => [d.salesperson_id, d.salesperson_name || 'Unknown'])).entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
    : [];
  const byCustomer = customerFilter ? visibleAll.filter((d) => d.customer_name === customerFilter) : visibleAll;
  const byFsm = isMaster && fsmFilter ? byCustomer.filter((d) => d.fsm_id === fsmFilter) : byCustomer;
  const visible = isMaster && salespersonFilter ? byFsm.filter((d) => d.salesperson_id === salespersonFilter) : byFsm;

  const outstandingCount = active.filter((d) => (d.delivery_requirements || []).some((r) => r.status === 'outstanding')).length;

  if (isAdminMode) return <AdminHome />;

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
          {!isManager && tab === 'active' ? "Today's Deliveries" : 'Deliveries'}
        </h1>
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

      {customerNames.length > 1 && (
        <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
          <option value="">All customers ({customerNames.length})</option>
          {customerNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      )}

      {isMaster && fsmOptions.length > 1 && (
        <select value={fsmFilter} onChange={(e) => setFsmFilter(e.target.value)}>
          <option value="">All Finance Managers</option>
          {fsmOptions.map(([fsmId, name]) => (
            <option key={fsmId} value={fsmId}>{name}{fsmId === session?.user.id ? ' (You)' : ''}</option>
          ))}
        </select>
      )}

      {isMaster && salespersonOptions.length > 1 && (
        <select value={salespersonFilter} onChange={(e) => setSalespersonFilter(e.target.value)}>
          <option value="">All Salespeople</option>
          {salespersonOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      )}

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
          {tab === 'delivered' ? 'No delivered units yet.' : !isManager ? 'Nothing scheduled for today. Check Calendar for upcoming deliveries.' : 'No deliveries scheduled yet.'}
        </div>
      )}

      {visible.map((d) => {
        const sc = STATUS_COLOR[d.status];
        const dt = new Date(d.delivery_at);
        const darkGreen = '#15803d';

        return (
          <Link
            key={d.id}
            to={`/delivery/${d.id}`}
            className="card"
            style={{ display: 'block', borderLeft: `4px solid ${sc.border}`, textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>{d.customer_name}</span>
                  {d.stock_number && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, letterSpacing: 0.3, color: 'var(--accent)',
                      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px',
                    }}>
                      Stock #{d.stock_number}
                    </span>
                  )}
                </div>
                {isManager && d.salesperson_name && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Salesperson: {d.salesperson_name}
                  </div>
                )}
                {isMaster && d.fsm_name && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Finance Manager: {d.fsm_name}{d.fsm_id === session?.user.id ? ' (You)' : ''}
                  </div>
                )}
              </div>
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
                background: sc.bg, color: sc.fg, padding: '4px 9px', borderRadius: 999,
              }}>
                {STATUS_LABEL[d.status]}
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, marginTop: 10,
              padding: '7px 11px', borderRadius: 9, background: '#eafaf0',
            }}>
              <span style={{ color: darkGreen, display: 'flex' }}><CalendarIcon size={16} /></span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: darkGreen }}>
                {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: darkGreen }}>
                {dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--muted)', marginTop: 2, flexShrink: 0 }}><PinIcon size={13} /></span>
              <div style={{ color: 'var(--text)' }}>
                {d.lenders?.name || 'Lender / lessor not selected'}
                {d.lenders?.address && (
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 1 }}>{d.lenders.address}</div>
                )}
              </div>
            </div>
          </Link>
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
