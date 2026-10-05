import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Delivery } from '@/lib/types';

// Not dismissible, same as MonthCloseBanner's undelivered warning — the
// sold date drives hat-trick bonus tracking and is the salesperson's own to
// enter, so this keeps surfacing on every visit until every one of their
// deliveries has it, rather than letting it be missed once and forgotten.
// Never shown to a Master previewing the role: this is about the real
// signed-in salesperson's own missing data, not whoever they're viewing.
export default function SoldDateBanner() {
  const { profile, session } = useSession();
  const [missing, setMissing] = useState<Delivery[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!session || profile?.role !== 'Salesperson') { setMissing([]); return; }
    supabase
      .from('deliveries')
      .select('*')
      .eq('salesperson_id', session.user.id)
      .is('sold_at', null)
      .neq('status', 'cancelled')
      .order('delivery_at', { ascending: true })
      .then(({ data }) => setMissing((data as Delivery[]) || []));
  }, [session, profile?.role]);

  if (missing.length === 0) return null;

  return (
    <div style={{
      padding: '9px 14px', background: 'var(--banner-warn-bg)', borderBottom: '1px solid var(--banner-warn-border)',
      fontSize: 12.5, color: 'var(--banner-warn-fg)',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          {missing.length === 1
            ? '1 delivery is missing a sold date.'
            : `${missing.length} deliveries are missing a sold date.`}
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
          {missing.map((d) => (
            <Link key={d.id} to={`/delivery/${d.id}`} style={{ color: 'var(--banner-warn-fg)', fontWeight: 700, textDecoration: 'underline' }}>
              {d.customer_name}{d.stock_number ? ` · Stock #${d.stock_number}` : ''}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
