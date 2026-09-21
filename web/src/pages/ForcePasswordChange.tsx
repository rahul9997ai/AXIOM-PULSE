import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { AxiomLockup } from '@/components/AxiomMark';

export default function ForcePasswordChange() {
  const { refresh } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    setError(null);

    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) { setBusy(false); setError(pwError.message); return; }

    const { error: rpcError } = await supabase.rpc('mark_password_changed');
    if (rpcError) { setBusy(false); setError(rpcError.message); return; }

    await refresh();
    setBusy(false);
  };

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true" />
      <header className="landing-head">
        <AxiomLockup size={40} />
      </header>
      <main className="landing-main">
        <section className="landing-card-wrap">
          <form className="landing-card" onSubmit={submit}>
            <h2>Set Your Password</h2>
            <p className="landing-sub">You're signing in with a temporary password. Choose your own before continuing.</p>
            {error && <div className="landing-err" role="alert">{error}</div>}
            <div className="landing-field">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="landing-field">
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
              {busy ? 'Saving…' : 'Save password and continue'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
