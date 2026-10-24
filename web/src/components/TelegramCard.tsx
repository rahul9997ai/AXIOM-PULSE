import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { MANAGER_ROLES } from '@/lib/types';

// Lets a finance manager link their Telegram so trade-in lien reminders also
// arrive there. Connecting opens the Pulse bot with a one-time code; the bot
// links the chat when they tap Start.
export default function TelegramCard() {
  const { profile, refresh } = useSession();
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`)
      .then((r) => r.json()).then((j) => setUsername(j.username ?? null)).catch(() => setUsername(null));
    return () => window.clearInterval(timer.current);
  }, []);

  const connected = !!profile?.telegram_chat_id;
  useEffect(() => { if (connected) { setWaiting(false); window.clearInterval(timer.current); } }, [connected]);

  if (!profile || !MANAGER_ROLES.includes(profile.role) || !username) return null;

  const connect = async () => {
    setError(null);
    const { data: code, error: err } = await supabase.rpc('telegram_link_start');
    if (err || !code) { setError(err?.message ?? 'Could not start the connection.'); return; }
    window.open(`https://t.me/${username}?start=${code}`, '_blank', 'noopener');
    setWaiting(true);
    // The bot links the chat as soon as they tap Start; watch for it for 15 minutes.
    let ticks = 0;
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      refresh();
      if (++ticks > 300) { window.clearInterval(timer.current); setWaiting(false); }
    }, 3000);
  };

  const disconnect = async () => {
    setError(null);
    const { error: err } = await supabase.rpc('telegram_unlink');
    if (err) { setError(err.message); return; }
    await refresh();
  };

  return (
    <div className="card" id="telegram">
      <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 1, marginBottom: 6 }}>TELEGRAM</div>
      <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
        {connected
          ? 'Connected. Trade-in lien reminders are also sent to your Telegram.'
          : 'Optional: get trade-in lien reminders in Telegram too. Tap Connect, then press Start in the chat that opens.'}
      </p>
      {connected ? (
        <button type="button" className="btn secondary" onClick={disconnect}>Disconnect Telegram</button>
      ) : (
        <button type="button" className="btn" onClick={connect} disabled={waiting}>{waiting ? 'Waiting for you to press Start…' : 'Connect Telegram'}</button>
      )}
      {error && <div role="alert" style={{ marginTop: 8, fontSize: '0.75rem', color: '#a3261b' }}>{error}</div>}
    </div>
  );
}
