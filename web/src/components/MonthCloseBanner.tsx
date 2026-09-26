import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { monthLabel, monthRange, previousMonth } from '@/lib/monthClose';

const DISMISS_KEY_PREFIX = 'pulse_month_close_seen_';

// Shown to the real FSM (never a Master previewing the role — closing is
// tied to their own account) when last month had at least one delivery and
// isn't closed yet. Shown to a salesperson, once, as a quiet confirmation
// once their FSM has closed it — no action needed, purely informational.
export default function MonthCloseBanner() {
  const { profile, session } = useSession();
  const { year, month } = previousMonth();
  const label = monthLabel(year, month);

  const [fsmNeedsClose, setFsmNeedsClose] = useState(false);
  const [salespersonClosedBy, setSalespersonClosedBy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!session || !profile) return;
    const dismissKey = `${DISMISS_KEY_PREFIX}${year}-${month}`;

    if (profile.role === 'FSM') {
      const { start, end } = monthRange(year, month);
      Promise.all([
        supabase.from('month_closures').select('id').eq('fsm_id', session.user.id).eq('year', year).eq('month', month).maybeSingle(),
        supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('fsm_id', session.user.id).gte('delivery_at', start.toISOString()).lt('delivery_at', end.toISOString()),
      ]).then(([{ data: closure }, { count }]) => {
        setFsmNeedsClose(!closure && (count ?? 0) > 0);
      });
      return;
    }

    if (profile.role === 'Salesperson') {
      try { if (localStorage.getItem(dismissKey)) { setDismissed(true); return; } } catch { /* ignore */ }
      supabase
        .from('deliveries')
        .select('fsm_id, fsm_name')
        .eq('salesperson_id', session.user.id)
        .gte('delivery_at', monthRange(year, month).start.toISOString())
        .lt('delivery_at', monthRange(year, month).end.toISOString())
        .then(async ({ data }) => {
          const fsmIds = Array.from(new Set((data || []).map((d) => d.fsm_id).filter(Boolean)));
          if (fsmIds.length === 0) return;
          const { data: closures } = await supabase.from('month_closures').select('fsm_id').eq('year', year).eq('month', month).in('fsm_id', fsmIds);
          if (closures && closures.length > 0) {
            const closedFsm = (data || []).find((d) => d.fsm_id === closures[0].fsm_id);
            setSalespersonClosedBy(closedFsm?.fsm_name ?? null);
          }
        });
    }
  }, [session, profile, year, month]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(`${DISMISS_KEY_PREFIX}${year}-${month}`, '1'); } catch { /* ignore */ }
  };

  if (dismissed) return null;

  if (profile?.role === 'FSM' && fsmNeedsClose) {
    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', background: '#fef3e2', borderBottom: '1px solid #f5d59a', fontSize: 12.5,
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
        padding: '9px 14px', background: '#eafaf0', borderBottom: '1px solid #bfe8cf', fontSize: 12.5,
      }}>
        <span>{label} closed by {salespersonClosedBy}.</span>
        <button type="button" onClick={dismiss} style={{ background: 'none', border: 'none', color: '#15803d', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Got it</button>
      </div>
    );
  }

  return null;
}
