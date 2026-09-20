import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 360, display: 'grid', gap: 12 }}>
        <div className="brand" style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>
          AXIOM <span className="pulse">Pulse</span>
        </div>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
          Your Finance Manager or dealership admin provides your account. You cannot self-register.
        </p>
      </form>
    </div>
  );
}
