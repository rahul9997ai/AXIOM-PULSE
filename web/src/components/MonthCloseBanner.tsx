import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Delivery } from '@/lib/types';
import { monthLabel, monthRange, previousMonth } from '@/lib/monthClose';

const DISMISS_KEY_PREFIX = 'pulse_month_close_seen_';

// Shown to the real FSM (never a Master previewing the role — closing is
// tied to their own account) when last month had at least one delivery and
// isn't closed yet. Shown to a salesperson, once, as a quiet confirmation
// once their FSM has closed it — no action needed, purely informational —
// or, not dismissible, when they personally still have a vehicle from last
// month that was never marked delivered: the salesperson's own Deliveries
// tab only ever shows *today's* active deliveries, so a stale one from a
// past month would otherwise silently vanish from view with nothing to
// prompt them back to it.
export default function MonthCloseBanner() {
  const { profile, session } = useSession();
  const { year, month } = previousMonth();
  const label = monthLabel(year, month);

  const [fsmNeedsClose, setFsmNeedsClose] = useState(false);
  const [salespersonClosedBy, setSalespersonClosedBy] = useState<string | null>(null);
  const [myUndelivered, setMyUndelivered] = useState<Delivery[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!session || !profile) return;
    const dismissKey = `${DISMISS_KEY_PREFIX}${year}-${month}`;

    if (profile.role === 'FSM') {
      if (!profile.dealership_id) return;
      const { start, end } = monthRange(year, month);
      Promise.all([
        supabase.from('month_closures').select('id').eq('dealership_id', profile.dealership_id).eq('year', year).eq('month', month).maybeSingle(),
        supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('fsm_id', session.user.id).gte('delivery_at', start.toISOString()).lt('delivery_at', end.toISOString()),
      ]).then(([{ data: closure }, { count }]) => {
        setFsmNeedsClose(!closure && (count ?? 0) > 0);
      });
      return;
    }

    if (profile.role === 'Salesperson') {
      const { start, end } = monthRange(year, month);
      supabase
        .from('deliveries')
        .select('*')
        .eq('salesperson_id', session.user.id)
        .neq('status', 'delivered')
        .gte('delivery_at', start.toISOString())
        .lt('delivery_at', end.toISOString())
        .order('delivery_at', { ascending: true })
        .then(({ data }) => setMyUndelivered((data as Delivery[]) || []));

      try { if (localStorage.getItem(dismissKey)) { setDismissed(true); return; } } catch { /* ignore */ }
      if (!profile.dealership_id) return;
      supabase
        .from('month_closures')
        .select('*, profiles!month_closures_fsm_id_fkey(name)')
        .eq('dealership_id', profile.dealership_id)
        .eq('year', year).eq('month', month)
        .maybeSingle()
        .then(({ data }) => {
          const closure = data as { profiles: { name: string } | null } | null;
          if (closure) setSalespersonClosedBy(closure.profiles?.name ?? null);
        });
    }
  }, [session, profile, year, month]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(`${DISMISS_KEY_PREFIX}${year}-${month}`, '1'); } catch { /* ignore */ }
  };

  // Not dismissible, and checked ahead of the dismissed/closed-month flags
  // below — a vehicle from last month that's still not marked delivered
  // needs action every time they open the app until it's actually resolved.
  if (profile?.role === 'Salesperson' && myUndelivered.length > 0) {
    return (
      <div style={{
        padding: '9px 14px', background: 'var(--banner-warn-bg)', borderBottom: '1px solid var(--banner-warn-border)',
        fontSize: 12.5, color: 'var(--banner-warn-fg)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {myUndelivered.length === 1
              ? `1 delivery from ${label} was never marked delivered.`
              : `${myUndelivered.length} deliveries from ${label} were never marked delivered.`}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--banner-warn-fg)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        </div>
        {expanded && (
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {myUndelivered.map((d) => (
              <Link key={d.id} to={`/delivery/${d.id}`} style={{ color: 'var(--banner-warn-fg)', fontWeight: 700, textDecoration: 'underline' }}>
                {d.customer_name}{d.stock_number ? ` · Stock #${d.stock_number}` : ''}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (dismissed) return null;

  if (profile?.role === 'FSM' && fsmNeedsClose) {
    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', background: 'var(--banner-warn-bg)', borderBottom: '1px solid var(--banner-warn-border)',
        fontSize: 12.5, color: 'var(--banner-warn-fg)',
      }}>
        <span><strong>{label}</strong> is ready to close — review and confirm.</span>
        <Link to="/month-close" className="btn" style={{ padding: '4px 12px', fontSize: 12 }}>Review &amp; Close</Link>
      </div>
    );
  }

  if (profile?.role === 'Salesperson' && salespersonClosedBy) {
    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', background: 'var(--banner-ok-bg)', borderBottom: '1px solid var(--banner-ok-border)',
        fontSize: 12.5, color: 'var(--banner-ok-fg)',
      }}>
        <span>{label} closed by {salespersonClosedBy}.</span>
        <button type="button" onClick={dismiss} style={{ background: 'none', border: 'none', color: 'var(--banner-ok-fg)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Got it</button>
      </div>
    );
  }

  return null;
}
