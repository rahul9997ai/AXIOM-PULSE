import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AxiomLockup } from '@/components/AxiomMark';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true" />
      <header className="landing-head">
        <AxiomLockup size={40} />
        <p className="ax-tagline" style={{ marginTop: 6 }}>AI eXecutive Intelligence &amp; Operations Management</p>
        <div className="ax-sig" style={{ marginTop: 2 }}>by Rahul Champaneri</div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-label"><span /> Delivery Coordination</div>
          <h1>The Pulse of<br /><em>Every Delivery.</em></h1>
          <p className="landing-lead">
            From FSM handoff to customer delivery — every requirement, every
            reminder, tracked in real time.
          </p>
        </section>

        <section className="landing-card-wrap">
          <form className="landing-card" onSubmit={submit}>
            <h2>Welcome Back</h2>
            <p className="landing-sub">Sign in to Axiom Pulse</p>
            {error && <div className="landing-err" role="alert">{error}</div>}
            <div className="landing-field">
              <UserIcon />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="landing-field">
              <LockIcon />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="landing-eye" aria-label="Show or hide password" onClick={() => setShowPassword((s) => !s)}>
                <EyeIcon />
              </button>
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="landing-note">
              Your Finance Manager or dealership admin provides your account.
              You cannot self-register.
            </p>
          </form>
        </section>
      </main>

      <footer className="landing-foot">
        <span className="landing-tagline">From FSM's Mind to FSM's Desk</span>
      </footer>
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="8" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 017.6 0v2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
