import { useEffect, useState } from 'react';
import { enablePush, isStandaloneDisplay, isIOS, pushSupported, sendTestPush } from '@/lib/push';

type PushState = 'unsupported' | 'ios-install' | 'offer' | 'blocked' | 'enabled';

// Every role needs a way to enable/test push on their own device — a manager
// still uses their own phone and wants to know reminders will actually
// arrive, not just the salesperson. This used to only render on the
// Deliveries page for non-manager roles, so a Master Administrator (who
// never sees a "salesperson" delivery board) had no way to reach it at all.
export default function PushCard() {
  const [pushState, setPushState] = useState<PushState>('offer');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) { setPushState('unsupported'); return; }
    if (isIOS() && !isStandaloneDisplay()) { setPushState('ios-install'); return; }
    if (Notification.permission === 'denied') { setPushState('blocked'); return; }
    if (Notification.permission === 'granted') {
      // Permission being granted doesn't guarantee a subscription row still
      // exists server-side — re-run registration on every visit so a device
      // can self-heal, and surface a failure instead of swallowing it.
      enablePush().catch((e) => setNotice(`Notifications: ${(e as Error).message}`));
      setPushState('enabled');
      return;
    }
    setPushState('offer');
  }, []);

  const onEnablePush = async () => {
    try { await enablePush(); setPushState('enabled'); setNotice('Notifications enabled. Delivery reminders arrive even when Pulse is closed.'); }
    catch (e) { setNotice((e as Error).message); }
  };

  const onTestPush = async () => {
    try { const { sent } = await sendTestPush(); setNotice(`Test notification sent to ${sent} device(s). Close the app to verify background delivery.`); }
    catch (e) { setNotice((e as Error).message); }
  };

  return (
    <>
      {pushState === 'offer' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Enable Notifications</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Get delivery reminders and urgent alerts even when Pulse is closed.</p>
          <button className="btn" onClick={onEnablePush}>Enable notifications</button>
        </div>
      )}
      {pushState === 'ios-install' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Enable Notifications</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            On iPhone/iPad, add Axiom Pulse to your Home Screen first, then open it from there to enable notifications.
          </p>
        </div>
      )}
      {pushState === 'blocked' && (
        <div className="card">
          <h3 style={{ marginTop: 0, color: '#a3261b' }}>Notifications Are Blocked</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {isIOS()
              ? 'Notifications for Axiom Pulse were previously turned off on this iPhone. Open iOS Settings, scroll down to Axiom Pulse, and turn Notifications on — then come back to this screen.'
              : 'Notifications for Axiom Pulse are blocked in this browser. Enable them in your browser or site settings, then come back to this screen.'}
          </p>
        </div>
      )}
      {pushState === 'enabled' && (
        <div className="card">
          <div style={{ color: '#15803d', fontWeight: 700, fontSize: 13 }}>Background push enabled on this device.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn secondary" onClick={onTestPush}>Send test notification</button>
            <button className="btn secondary" onClick={onEnablePush}>Re-sync notifications</button>
          </div>
        </div>
      )}
      {notice && <div className="card" style={{ fontSize: 13 }}>{notice}</div>}
    </>
  );
}
