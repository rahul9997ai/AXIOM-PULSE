import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Delivery } from '@/lib/types';
import { enablePush, isStandaloneDisplay, isIOS, pushSupported, sendTestPush } from '@/lib/push';

const MANAGER_ROLES = ['FSM', 'General Manager', 'Master Administrator'];

export default function Deliveries() {
  const { profile, session } = useSession();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushState, setPushState] = useState<'unsupported' | 'ios-install' | 'offer' | 'enabled'>('offer');
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    let query = supabase
      .from('deliveries')
      .select('*, delivery_requirements(*)')
      .order('delivery_at', { ascending: true });
    if (!MANAGER_ROLES.includes(profile.role)) {
      query = query.eq('salesperson_id', session?.user.id);
    }
    const { data, error } = await query;
    if (!error) setRows((data as Delivery[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.role]);

  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    if (isIOS() && !isStandaloneDisplay()) { setPushState('ios-install'); return; }
    if (Notification.permission === 'granted') { setPushState('enabled'); return; }
    setPushState('offer');
  }, []);

  const complete = async (id: string) => {
    const { error } = await supabase.rpc('complete_delivery', { p_delivery_id: id });
    if (error) setNotice(error.message);
    else load();
  };

  const onEnablePush = async () => {
    try {
      await enablePush();
      setPushState('enabled');
      setNotice('Notifications enabled. Delivery reminders arrive even when Pulse is closed.');
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const onTestPush = async () => {
    try {
      const { sent } = await sendTestPush();
      setNotice(`Test notification sent to ${sent} device(s). Close the app to verify background delivery.`);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const isManager = profile ? MANAGER_ROLES.includes(profile.role) : false;

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ letterSpacing: 2, fontSize: 20 }}>DELIVERY PULSE</h1>
      <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{isManager ? 'MANAGER VIEW' : 'SALESPERSON VIEW'}</div>

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
          <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 13 }}>Background push enabled on this device.</div>
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={onTestPush}>Send test notification</button>
        </div>
      )}
      {notice && <div className="card" style={{ fontSize: 13 }}>{notice}</div>}

      {loading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
      {!loading && rows.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>No deliveries scheduled yet.</div>}

      {rows.map((d) => {
        const open = (d.delivery_requirements || []).filter((r) => !r.completed);
        return (
          <div key={d.id} className="card">
            <div style={{ fontWeight: 800, fontSize: 17 }}>{d.customer_name}</div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{d.vehicle}</div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{new Date(d.delivery_at).toLocaleString()}</div>
            <div style={{ marginTop: 8 }}>{d.lender_name || 'Lender / lessor not selected'}</div>
            <div style={{ color: 'var(--accent)', marginTop: 10, fontWeight: 700, whiteSpace: 'pre-line' }}>
              {open.length ? open.map((r) => `• ${r.label}`).join('\n') : '✓ Nothing outstanding'}
            </div>
            {!isManager && d.status !== 'delivered' && (
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
