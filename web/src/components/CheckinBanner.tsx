import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { dealershipDateKey, slotLabel } from '@/lib/checkins';
import type { FsmCheckin } from '@/lib/checkins';

// Not dismissible: a Finance Manager with an unconfirmed check-in today sees
// this on every screen until they confirm it. Only the real FSM account —
// a Master previewing the role has no check-ins of its own.
export default function CheckinBanner() {
  const { profile, session } = useSession();
  const { pathname } = useLocation();
  const [pending, setPending] = useState<FsmCheckin | null>(null);

  useEffect(() => {
    if (!session || profile?.role !== 'FSM') { setPending(null); return; }
    supabase
      .from('fsm_checkins')
      .select('*')
      .eq('fsm_id', session.user.id)
      .eq('local_date', dealershipDateKey())
      .is('confirmed_at', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setPending(((data as FsmCheckin[]) || [])[0] ?? null));
  }, [session, profile?.role, pathname]);

  if (!pending || pathname.startsWith('/checkin/')) return null;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 14px', background: 'var(--banner-warn-bg)', borderBottom: '1px solid var(--banner-warn-border)',
      fontSize: 12.5, color: 'var(--banner-warn-fg)',
    }}>
      <span><strong>{slotLabel(pending.slot)} check-in</strong> — confirm every delivery is entered in Pulse.</span>
      <Link to={`/checkin/${pending.id}`} className="btn" style={{ padding: '4px 12px', fontSize: 12 }}>Confirm</Link>
    </div>
  );
}
