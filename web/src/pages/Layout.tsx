import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const MANAGER_ROLES = ['FSM', 'General Manager', 'Master Administrator'];

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const canCreate = profile ? MANAGER_ROLES.includes(profile.role) : false;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
        <div className="brand" style={{ fontSize: 18 }}>
          AXIOM <span className="pulse">Pulse</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canCreate && (
            <Link to="/new" className="btn secondary" style={{ textDecoration: 'none', padding: '8px 12px', fontSize: 13 }}>
              + New
            </Link>
          )}
          <button
            className="btn secondary"
            style={{ padding: '8px 12px', fontSize: 13 }}
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: '0 18px 24px' }}>{children}</main>
    </div>
  );
}
