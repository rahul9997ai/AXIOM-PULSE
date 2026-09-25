import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useActingRole } from '@/lib/actingRole';
import type { Delivery } from '@/lib/types';
import { STATUS_COLOR, MANAGER_ROLES } from '@/lib/types';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const { profile, session } = useSession();
  const { isMaster, actingRole, actingDealershipId } = useActingRole();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState(() => dateKey(new Date()));

  const effectiveRole = isMaster ? actingRole : profile?.role;
  const isManager = effectiveRole ? MANAGER_ROLES.includes(effectiveRole) : false;

  const load = useCallback(async () => {
    if (!profile) return;
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
  }, [profile, isManager, isMaster, actingDealershipId, session?.user.id]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, Delivery[]>();
    for (const d of rows) {
      const key = dateKey(new Date(d.delivery_at));
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = cursor.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));

  const selectedDeliveries = byDay.get(selected) || [];

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Calendar</h1>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button type="button" className="btn secondary" style={{ padding: '4px 10px' }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>‹</button>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel}</div>
          <button type="button" className="btn secondary" style={{ padding: '4px 10px' }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{w}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const key = dateKey(date);
            const dayDeliveries = byDay.get(key) || [];
            const isSelected = key === selected;
            const isToday = key === todayKey;
            const hasOutstanding = dayDeliveries.some((d) => (d.delivery_requirements || []).some((r) => r.status === 'outstanding'));
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(key)}
                style={{
                  aspectRatio: '1', border: isToday ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  borderRadius: 8, background: isSelected ? 'var(--accent)' : 'var(--surface)',
                  color: isSelected ? '#fff' : 'var(--ink)', fontSize: 13, fontWeight: isToday ? 800 : 600,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                }}
              >
                {date.getDate()}
                {dayDeliveries.length > 0 && (
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: isSelected ? '#fff' : hasOutstanding ? '#f59e0b' : '#22c55e',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          {new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
        {!loading && selectedDeliveries.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>No deliveries this day.</div>
        )}
        {selectedDeliveries.map((d) => {
          const sc = STATUS_COLOR[d.status];
          return (
            <Link
              key={d.id}
              to={`/delivery/${d.id}`}
              className="card"
              style={{ display: 'block', borderLeft: `4px solid ${sc.border}`, marginBottom: 10, textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{d.customer_name}</span>
                  {d.stock_number && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 800, color: 'var(--accent)',
                      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 6px',
                    }}>
                      #{d.stock_number}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>
                  {new Date(d.delivery_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                {d.lenders?.name || 'Lender / lessor not selected'}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
